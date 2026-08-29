const { getStore } = require("@netlify/blobs");

const STORE_NAME = "photos";
const INDEX_KEY = "index";

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

  items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return items;
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

async function deletePhoto(id) {
  const s = store();
  const items = (await s.get(INDEX_KEY, { type: "json" })) || [];
  const list = Array.isArray(items) ? items : [];
  const next = list.filter((photo) => photo && photo.id !== id);
  const inIndex = next.length !== list.length;
  const leftover = await s.get(metaKey(id), { type: "json" });
  if (!inIndex && !leftover) return false;
  await s.setJSON(INDEX_KEY, next);
  await s.delete(fileKey(id));
  if (leftover) await s.delete(metaKey(id));
  return true;
}

module.exports = {
  useEvent,
  listPhotos,
  addPhoto,
  getPhotoFile,
  deletePhoto,
};
