const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");

loadEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT) || 5173;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "branko-studio";
const SESSION_SECRET = process.env.SESSION_SECRET || "krivokuca-local-session";
const COOKIE_NAME = "bk_admin";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CATEGORIES = ["landscape", "architecture", "portraits"];

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const PHOTOS_FILE = path.join(DATA_DIR, "photos.json");
const INQUIRIES_FILE = path.join(DATA_DIR, "inquiries.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_FILE)) fs.writeFileSync(PHOTOS_FILE, "[]");
if (!fs.existsSync(INQUIRIES_FILE)) fs.writeFileSync(INQUIRIES_FILE, "[]");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = safeExt(file.originalname) || ".jpg";
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error("Please upload a JPG, PNG, WEBP, or GIF image."));
  },
});

app.get("/api/photos", (_req, res) => {
  res.json(readJson(PHOTOS_FILE).map(normalizePhoto));
});

app.post("/api/inquiries", (req, res) => {
  const firstName = cleanText(req.body.firstName, 60);
  const lastName = cleanText(req.body.lastName, 60);
  const email = String(req.body.email || "").trim().toLowerCase();
  const message = cleanText(req.body.message, 4000);

  if (!firstName || !lastName || !message) {
    return res.status(400).json({ error: "Please fill in your name and message." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const inquiries = readJson(INQUIRIES_FILE);
  inquiries.unshift({
    id: crypto.randomUUID(),
    firstName,
    lastName,
    email,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  });
  writeJson(INQUIRIES_FILE, inquiries);
  res.status(201).json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const password = String(req.body.password || "");
  if (!secureEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  res.setHeader("Set-Cookie", sessionCookie(makeToken()));
  res.json({ ok: true });
});

app.post("/api/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  res.json({ authenticated: isAdmin(req) });
});

app.get("/api/inquiries", requireAdmin, (_req, res) => {
  res.json(readJson(INQUIRIES_FILE));
});

app.post("/api/inquiries/:id/read", requireAdmin, (req, res) => {
  const inquiries = readJson(INQUIRIES_FILE);
  const item = inquiries.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Message not found." });
  item.read = true;
  writeJson(INQUIRIES_FILE, inquiries);
  res.json(item);
});

app.delete("/api/inquiries/:id", requireAdmin, (req, res) => {
  const inquiries = readJson(INQUIRIES_FILE).filter((entry) => entry.id !== req.params.id);
  writeJson(INQUIRIES_FILE, inquiries);
  res.json({ ok: true });
});

app.post("/api/photos", requireAdmin, (req, res) => {
  upload.single("photo")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Upload failed." });
    if (!req.file) return res.status(400).json({ error: "Choose an image to upload." });

    const category = normalizeCategory(req.body.category);
    if (!category) {
      return res.status(400).json({ error: "Choose Landscape, Architecture, or Portraits." });
    }

    const photos = readJson(PHOTOS_FILE);
    const photo = {
      id: crypto.randomUUID(),
      title: cleanText(req.body.title, 80) || "Untitled",
      category,
      src: `/uploads/${req.file.filename}`,
      createdAt: new Date().toISOString(),
    };
    photos.unshift(photo);
    writeJson(PHOTOS_FILE, photos);
    res.status(201).json(photo);
  });
});

app.delete("/api/photos/:id", requireAdmin, (req, res) => {
  const photos = readJson(PHOTOS_FILE);
  const photo = photos.find((entry) => entry.id === req.params.id);
  if (!photo) return res.status(404).json({ error: "Photo not found." });

  if (photo.src.startsWith("/uploads/")) {
    const filePath = path.join(UPLOADS_DIR, path.basename(photo.src));
    fs.rmSync(filePath, { force: true });
  }

  writeJson(
    PHOTOS_FILE,
    photos.filter((entry) => entry.id !== req.params.id)
  );
  res.json({ ok: true });
});

app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.listen(PORT, () => {
  console.log(`Branko Krivokuca site running at http://localhost:${PORT}`);
});

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Please sign in." });
  next();
}

function isAdmin(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return false;
  const [expiry, signature] = String(token).split(".");
  if (!expiry || !signature) return false;
  if (Number(expiry) < Date.now()) return false;
  return secureEqual(signature, sign(expiry));
}

function makeToken() {
  const expiry = String(Date.now() + COOKIE_MAX_AGE_MS);
  return `${expiry}.${sign(expiry)}`;
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(COOKIE_MAX_AGE_MS / 1000)}`;
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};
  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  });
  return cookies;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function normalizePhoto(photo) {
  return {
    ...photo,
    category: normalizeCategory(photo.category) || "landscape",
  };
}

function normalizeCategory(value) {
  const category = String(value || "")
    .trim()
    .toLowerCase();
  return CATEGORIES.includes(category) ? category : "";
}

function cleanText(value, max) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeExt(name) {
  const ext = path.extname(name || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : "";
}

function secureEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    });
}
