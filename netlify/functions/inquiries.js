const crypto = require("crypto");
const { connectLambda } = require("@netlify/blobs");
const { json, optionsResponse, parseBody, isAdmin } = require("../lib/admin-auth");
const {
  listInquiries,
  addInquiry,
  markInquiryRead,
  deleteInquiry,
} = require("../lib/inquiries-store");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse(event);
  connectLambda(event);
  const path = requestPath(event);
  const method = event.httpMethod;

  if (method === "POST" && isCollectionPath(path)) {
    return createInquiry(event);
  }
  if (method === "GET" && isCollectionPath(path)) {
    return listForAdmin(event);
  }

  const readMatch = path.match(/\/inquiries\/([^/]+)\/read\/?$/);
  if (method === "POST" && readMatch) {
    return readInquiry(event, decodeURIComponent(readMatch[1]));
  }

  const itemMatch = path.match(/\/inquiries\/([^/]+)\/?$/);
  if (method === "DELETE" && itemMatch) {
    return removeInquiry(event, decodeURIComponent(itemMatch[1]));
  }

  return json(404, { error: "Not found." }, {}, event);
};

async function createInquiry(event) {
  const data = parseRequestBody(event);
  if (String(data["bot-field"] || "").trim()) {
    return json(201, { ok: true }, {}, event);
  }

  const firstName = cleanText(data.firstName, 60);
  const lastName = cleanText(data.lastName, 60);
  const email = String(data.email || "")
    .trim()
    .toLowerCase();
  const message = cleanText(data.message, 4000);

  if (!firstName || !lastName || !message) {
    return json(400, { error: "Please fill in your name and message." }, {}, event);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: "Please enter a valid email address." }, {}, event);
  }

  const entry = await addInquiry({
    id: crypto.randomUUID(),
    firstName,
    lastName,
    email,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  });

  return json(201, { ok: true, id: entry.id }, {}, event);
}

async function listForAdmin(event) {
  if (!isAdmin(event)) return json(401, { error: "Please sign in." }, {}, event);
  return json(200, await listInquiries(), {}, event);
}

async function readInquiry(event, id) {
  if (!isAdmin(event)) return json(401, { error: "Please sign in." }, {}, event);
  const item = await markInquiryRead(id);
  if (!item) return json(404, { error: "Message not found." }, {}, event);
  return json(200, item, {}, event);
}

async function removeInquiry(event, id) {
  if (!isAdmin(event)) return json(401, { error: "Please sign in." }, {}, event);
  const removed = await deleteInquiry(id);
  if (!removed) return json(404, { error: "Message not found." }, {}, event);
  return json(200, { ok: true }, {}, event);
}

function isCollectionPath(path) {
  return /\/inquiries\/?$/.test(path);
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

function parseRequestBody(event) {
  const headers = event.headers || {};
  const contentType = String(headers["content-type"] || headers["Content-Type"] || "").toLowerCase();
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return parseBody(event);
}

function cleanText(value, max) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
