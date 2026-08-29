const { getStore } = require("@netlify/blobs");

const STORE_NAME = "inquiries";
const LEGACY_LIST_KEY = "messages";

function store() {
  return getStore(STORE_NAME);
}

async function listInquiries() {
  const s = store();
  const listed = await s.list();
  const blobs = listed?.blobs || [];
  const items = [];

  for (const blob of blobs) {
    const value = await s.get(blob.key, { type: "json" });
    if (blob.key === LEGACY_LIST_KEY && Array.isArray(value)) {
      items.push(...value);
      continue;
    }
    if (value && value.id) items.push(value);
  }

  items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return items;
}

async function addInquiry(entry) {
  await store().setJSON(entry.id, entry);
  return entry;
}

async function markInquiryRead(id) {
  const item = (await store().get(id, { type: "json" })) || (await listInquiries()).find((entry) => entry.id === id);
  if (!item) return null;
  item.read = true;
  await store().setJSON(id, item);
  await removeFromLegacyList(id);
  return item;
}

async function deleteInquiry(id) {
  const s = store();
  const existing = await s.get(id, { type: "json" });
  const inLegacy = await removeFromLegacyList(id);
  if (existing) await s.delete(id);
  return Boolean(existing) || inLegacy;
}

async function removeFromLegacyList(id) {
  const s = store();
  const legacy = await s.get(LEGACY_LIST_KEY, { type: "json" });
  if (!Array.isArray(legacy)) return false;
  const next = legacy.filter((entry) => entry.id !== id);
  if (next.length === legacy.length) return false;
  if (next.length) await s.setJSON(LEGACY_LIST_KEY, next);
  else await s.delete(LEGACY_LIST_KEY);
  return true;
}

module.exports = {
  listInquiries,
  addInquiry,
  markInquiryRead,
  deleteInquiry,
};
