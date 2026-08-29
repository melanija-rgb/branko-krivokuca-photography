const crypto = require("crypto");
const { connectLambda } = require("@netlify/blobs");
const { json, optionsResponse, parseBody, isAdmin, corsHeaders } = require("../lib/admin-auth");
const { useEvent, listPhotos, listRemoved, addPhoto, getPhotoFile, deletePhoto } = require("../lib/photos-store");

const CATEGORIES = ["landscape", "architecture", "portraits"];
const ALLOWED_MIME = {
  "image/jpeg": true,
  "image/jpg": true,
  "image/png": true,
  "image/webp": true,
  "image/gif": true,
};
const MAX_BYTES = 4.5 * 1024 * 1024;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse(event);
  connectLambda(event);
  useEvent(event);

  const path = requestPath(event);
  const method = event.httpMethod;

  if (method === "GET" && isCollectionPath(path)) {
    const [photos, removed] = await Promise.all([listPhotos(), listRemoved()]);
    return json(200, { photos, removed }, {}, event);
  }

  const fileMatch = path.match(/\/photos\/([^/]+)\/file\/?$/);
  if (method === "GET" && fileMatch) {
    return serveFile(event, decodeURIComponent(fileMatch[1]));
  }

  if (method === "POST" && isCollectionPath(path)) {
    return uploadPhoto(event);
  }

  const itemMatch = path.match(/\/photos\/([^/]+)\/?$/);
  if (method === "DELETE" && itemMatch) {
    return removePhoto(event, decodeURIComponent(itemMatch[1]));
  }

  return json(404, { error: "Not found." }, {}, event);
};

async function uploadPhoto(event) {
  if (!isAdmin(event)) return json(401, { error: "Please sign in." }, {}, event);

  const data = parseBody(event);
  const category = CATEGORIES.includes(data.category) ? data.category : "";
  if (!category) {
    return json(400, { error: "Choose Landscape, Architecture, or Portraits." }, {}, event);
  }

  const mime = String(data.mime || "").toLowerCase();
  if (!ALLOWED_MIME[mime]) {
    return json(400, { error: "Please upload a JPG, PNG, WEBP, or GIF image." }, {}, event);
  }

  const buffer = decodeImage(data.data);
  if (!buffer) return json(400, { error: "Choose an image to upload." }, {}, event);
  if (buffer.length > MAX_BYTES) {
    return json(400, { error: "That photo is too large. Try a smaller image." }, {}, event);
  }

  const photo = await addPhoto({
    id: crypto.randomUUID(),
    title: cleanText(data.title, 80) || "Untitled",
    category,
    mime: mime === "image/jpg" ? "image/jpeg" : mime,
    buffer,
  });

  return json(201, photo, {}, event);
}

async function serveFile(event, id) {
  const file = await getPhotoFile(id);
  if (!file) return json(404, { error: "Photo not found." }, {}, event);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": file.meta.mime || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      ...corsHeaders(event),
    },
    isBase64Encoded: true,
    body: file.buffer.toString("base64"),
  };
}

async function removePhoto(event, id) {
  if (!isAdmin(event)) return json(401, { error: "Please sign in." }, {}, event);
  const removed = await deletePhoto(id);
  if (!removed) return json(404, { error: "Photo not found." }, {}, event);
  return json(200, { ok: true }, {}, event);
}

function isCollectionPath(path) {
  return /\/photos\/?$/.test(path);
}

function requestPath(event) {
  if (event.rawUrl) {
    try {
      return new URL(event.rawUrl).pathname;
    } catch {
      /* fall through */
    }
  }
  return event.path || "";
}

function decodeImage(value) {
  const raw = String(value || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  if (!raw) return null;
  try {
    const buffer = Buffer.from(raw, "base64");
    return buffer.length ? buffer : null;
  } catch {
    return null;
  }
}

function cleanText(value, max) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
