const { getStore } = require("@netlify/blobs");

const STORE_NAME = "photos";
const INDEX_KEY = "index";
const REMOVED_KEY = "removed";

let currentEvent = null;

function useEvent(event) {
  currentEvent = event;
}

function store() {
  const options = { name: STORE_NAME };
  const uncached = uncachedEdgeURL();
  if (uncached) {
    options.consistency = "strong";
    options.uncachedEdgeURL = uncached;
  }
  return getStore(options);
}

function uncachedEdgeURL() {
  if (!currentEvent || !currentEvent.blobs) return "";
  try {
    const data = JSON.parse(Buffer.from(currentEvent.blobs, "base64").toString("utf8"));
    return data.uncached_url || data.uncachedURL || data.uncachedEdgeURL || "";
  } catch {
    return "";
  }
}

function metaKey(id) {
  return `meta/${id}`;
}

function fileKey(id) {
  return `file/${id}`;
}

async function listPhotos() {
  const s = store();
  const fromIndex = (await s.get(INDEX_KEY, { type: "json" })) || [];
  const items = Array.isArray(fromIndex) ? [...fromIndex] : [];
  const seen = new Set(items.map((photo) => photo && photo.id).filter(Boolean));

  const listed = await s.list({ prefix: "meta/" });
  for (const blob of listed?.blobs || []) {
    const value = await s.get(blob.key, { type: "json" });
    if (value && value.id && !seen.has(value.id)) {
      seen.add(value.id);
      items.push(value);
    }
  }

  const removed = new Set(await listRemoved());
  items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return items.filter((photo) => photo && photo.id && !removed.has(photo.id));
}

async function listRemoved() {
  const ids = (await store().get(REMOVED_KEY, { type: "json" })) || [];
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
}

async function addPhoto({ id, title, category, mime, buffer }) {
  const photo = {
    id,
    title,
    category,
    src: `/api/photos/${id}/file`,
    createdAt: new Date().toISOString(),
    mime,
  };
  const s = store();
  await s.set(fileKey(id), buffer, { metadata: { contentType: mime } });
  await s.setJSON(metaKey(id), photo);
  const items = (await s.get(INDEX_KEY, { type: "json" })) || [];
  const next = [photo, ...(Array.isArray(items) ? items.filter((entry) => entry && entry.id !== id) : [])];
  await s.setJSON(INDEX_KEY, next);
  return photo;
}

async function getPhotoFile(id) {
  const s = store();
  const data = await s.get(fileKey(id), { type: "arrayBuffer" });
  if (!data) return null;
  const items = await listPhotos();
  const meta = items.find((photo) => photo.id === id) || { id, mime: "image/jpeg" };
  return { meta, buffer: Buffer.from(data) };
}

async function setPhotoCategory({ id, category, title, src }) {
  const removed = await listRemoved();
  if (removed.includes(id)) return null;

  const s = store();
  const items = (await s.get(INDEX_KEY, { type: "json" })) || [];
  const list = Array.isArray(items) ? items : [];
  const index = list.findIndex((photo) => photo && photo.id === id);

  if (index >= 0) {
    const next = { ...list[index], category };
    list[index] = next;
    await s.setJSON(INDEX_KEY, list);
    const meta = await s.get(metaKey(id), { type: "json" });
    if (meta) await s.setJSON(metaKey(id), { ...meta, category });
    return next;
  }

  const existing = await s.get(metaKey(id), { type: "json" });
  if (existing && existing.id) {
    const next = { ...existing, category };
    await s.setJSON(metaKey(id), next);
    await s.setJSON(INDEX_KEY, [next, ...list]);
    return next;
  }

  if (!src) return null;
  const photo = {
    id,
    title: title || "Untitled",
    category,
    src,
    createdAt: new Date().toISOString(),
  };
  await s.setJSON(metaKey(id), photo);
  await s.setJSON(INDEX_KEY, [photo, ...list]);
  return photo;
}

async function deletePhoto(id) {
  const s = store();
  const items = (await s.get(INDEX_KEY, { type: "json" })) || [];
  const list = Array.isArray(items) ? items : [];
  const next = list.filter((photo) => photo && photo.id !== id);
  const leftover = await s.get(metaKey(id), { type: "json" });
  await s.setJSON(INDEX_KEY, next);
  await s.delete(fileKey(id));
  if (leftover) await s.delete(metaKey(id));
  const removed = await listRemoved();
  if (!removed.includes(id)) {
    removed.push(id);
    await s.setJSON(REMOVED_KEY, removed);
  }
  return true;
}

module.exports = {
  useEvent,
  listPhotos,
  listRemoved,
  addPhoto,
  getPhotoFile,
  setPhotoCategory,
  deletePhoto,
};
