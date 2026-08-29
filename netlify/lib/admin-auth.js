const crypto = require("crypto");

const COOKIE_NAME = "bk_admin";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "branko-studio";
const SESSION_SECRET = process.env.SESSION_SECRET || "krivokuca-local-session";

function corsHeaders(event) {
  const origin = String((event && event.headers && (event.headers.origin || event.headers.Origin)) || "");
  const allowed =
    origin === "https://branko-krivokuca-photography.netlify.app" ||
    origin === "http://localhost:3000" ||
    origin === "http://127.0.0.1:3000" ||
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173" ||
    /\.netlify\.app$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://branko-krivokuca-photography.netlify.app",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

function optionsResponse(event) {
  return { statusCode: 204, headers: corsHeaders(event), body: "" };
}

function json(statusCode, body, extraHeaders = {}, event) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...(event ? corsHeaders(event) : {}),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function cookieHeader(event) {
  const headers = event.headers || {};
  return headers.cookie || headers.Cookie || "";
}

function isSecureRequest(event) {
  const headers = event.headers || {};
  const proto = headers["x-forwarded-proto"] || headers["X-Forwarded-Proto"] || "";
  return String(proto).split(",")[0].trim() === "https";
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function secureEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function makeToken() {
  const expiry = String(Date.now() + COOKIE_MAX_AGE_MS);
  return `${expiry}.${sign(expiry)}`;
}

function sessionCookie(token, secure) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${Math.floor(COOKIE_MAX_AGE_MS / 1000)}`,
  ];
  if (secure) parts.push("SameSite=None", "Secure");
  else parts.push("SameSite=Lax");
  return parts.join("; ");
}

function clearCookie(secure) {
  const parts = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "Max-Age=0"];
  if (secure) parts.push("SameSite=None", "Secure");
  else parts.push("SameSite=Lax");
  return parts.join("; ");
}

function isAdmin(event) {
  const match = cookieHeader(event)
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  const token = match.slice(COOKIE_NAME.length + 1);
  const [expiry, signature] = String(token).split(".");
  if (!expiry || !signature) return false;
  if (Number(expiry) < Date.now()) return false;
  return secureEqual(signature, sign(expiry));
}

module.exports = {
  ADMIN_PASSWORD,
  json,
  corsHeaders,
  optionsResponse,
  parseBody,
  isSecureRequest,
  secureEqual,
  makeToken,
  sessionCookie,
  clearCookie,
  isAdmin,
};
