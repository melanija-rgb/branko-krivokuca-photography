const LIVE_API = "https://branko-krivokuca-photography.netlify.app";

function liveApi(path) {
  return LIVE_API + path;
}

const loginView = document.querySelector("#login-view");
const studioView = document.querySelector("#studio-view");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const inbox = document.querySelector("#inbox");
const adminGallery = document.querySelector("#admin-gallery");
const uploadForm = document.querySelector("#upload-form");
const uploadStatus = document.querySelector("#upload-status");

boot();

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.classList.remove("error");
  loginStatus.textContent = "";

  const password = new FormData(loginForm).get("password");
  try {
    const response = await fetch(liveApi("/api/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      loginStatus.classList.add("error");
      loginStatus.textContent = payload.error || "Could not sign in.";
      return;
    }

    showStudio();
  } catch {
    loginStatus.classList.add("error");
    loginStatus.textContent = "Could not sign in.";
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch(liveApi("/api/logout"), { method: "POST", credentials: "include" });
  studioView.hidden = true;
  loginView.hidden = false;
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  uploadStatus.classList.remove("error");
  uploadStatus.textContent = "Uploading…";

  try {
    const form = new FormData(uploadForm);
    const file = form.get("photo");
    if (!(file instanceof File) || !file.size) {
      throw new Error("Choose an image to upload.");
    }

    const image = await prepareImage(file);
    const response = await fetch(liveApi("/api/photos"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        category: form.get("category"),
        title: form.get("title"),
        mime: image.mime,
        data: image.data,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Upload failed.");
    }

    uploadForm.reset();
    uploadStatus.textContent = "Added to the gallery.";
    loadPhotos();
  } catch (error) {
    uploadStatus.classList.add("error");
    uploadStatus.textContent = error.message || "Upload failed.";
  }
});

inbox.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === "read") {
    await fetch(liveApi(`/api/inquiries/${id}/read`), { method: "POST", credentials: "include" });
  }
  if (action === "delete") {
    await fetch(liveApi(`/api/inquiries/${id}`), { method: "DELETE", credentials: "include" });
  }
  loadInquiries();
});

adminGallery.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-photo-id]");
  if (!button) return;
  await fetch(liveApi(`/api/photos/${button.dataset.photoId}`), {
    method: "DELETE",
    credentials: "include",
  });
  loadPhotos();
});

async function boot() {
  try {
    const session = await fetch(liveApi("/api/session"), { credentials: "include" }).then((res) => res.json());
    if (session.authenticated) showStudio();
  } catch {
    /* stay on the login screen */
  }
}

function showStudio() {
  loginView.hidden = true;
  studioView.hidden = false;
  loadInquiries();
  loadPhotos();
}

async function loadInquiries() {
  const response = await fetch(liveApi("/api/inquiries"), { credentials: "include" }).catch(() => null);
  const items = response ? await response.json().catch(() => []) : [];
  if (!response || !response.ok || !Array.isArray(items) || !items.length) {
    inbox.innerHTML = `<p class="empty">No messages yet.</p>`;
    return;
  }

  inbox.innerHTML = items
    .map((item) => {
      const name = `${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}`;
      const when = new Date(item.createdAt).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      return `
        <article class="message ${item.read ? "" : "new"}">
          <header>
            <strong>${name}</strong>
            <time>${when}</time>
          </header>
          <a href="mailto:${escapeAttr(item.email)}">${escapeHtml(item.email)}</a>
          <p>${escapeHtml(item.message)}</p>
          <footer>
            ${item.read ? "" : `<button class="ghost" type="button" data-action="read" data-id="${item.id}">Mark read</button>`}
            <button class="ghost" type="button" data-action="delete" data-id="${item.id}">Delete</button>
          </footer>
        </article>
      `;
    })
    .join("");
}

async function loadPhotos() {
  const photos = await fetchPhotoList();
  if (!Array.isArray(photos)) return;
  const groups = [
    { id: "landscape", label: "Landscape" },
    { id: "architecture", label: "Architecture" },
    { id: "portraits", label: "Portraits" },
  ];

  adminGallery.innerHTML = groups
    .map(({ id, label }) => {
      const items = photos.filter((photo) => photo.category === id);
      const body = items.length
        ? `<div class="admin-gallery-grid">${items.map(photoFigure).join("")}</div>`
        : `<p class="empty">No photographs in this series yet.</p>`;
      return `<div class="admin-series"><h3>${label}</h3>${body}</div>`;
    })
    .join("");
}

async function fetchPhotoList() {
  const [catalog, builtIn] = await Promise.all([
    fetchCatalog(liveApi("/api/photos")),
    fetchJson("/photos.json"),
  ]);
  const removed = new Set(catalog.removed);
  const seen = new Set();
  const merged = [];
  for (const photo of [...catalog.photos, ...builtIn]) {
    if (!photo || !photo.id || seen.has(photo.id) || removed.has(photo.id)) continue;
    seen.add(photo.id);
    merged.push(photo);
  }
  return merged;
}

async function fetchCatalog(url) {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return { photos: [], removed: [] };
    const data = await response.json();
    if (Array.isArray(data)) return { photos: data, removed: [] };
    return {
      photos: Array.isArray(data.photos) ? data.photos : [],
      removed: Array.isArray(data.removed) ? data.removed : [],
    };
  } catch {
    return { photos: [], removed: [] };
  }
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function photoFigure(photo) {
  return `
    <figure>
      <img src="${escapeAttr(photoSrc(photo.src))}" alt="" />
      <figcaption>
        <button class="ghost" type="button" data-photo-id="${photo.id}">Remove</button>
      </figcaption>
    </figure>
  `;
}

function photoSrc(src) {
  if (String(src || "").startsWith("/api/")) return liveApi(src);
  return src;
}

async function prepareImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) throw new Error("Please upload a JPG, PNG, WEBP, or GIF image.");

  const max = 2000;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  let quality = 0.82;
  let blob = await canvasToJpeg(canvas, quality);
  if (blob.size > 3.2 * 1024 * 1024) blob = await canvasToJpeg(canvas, 0.68);
  if (blob.size > 3.2 * 1024 * 1024) blob = await canvasToJpeg(canvas, 0.52);

  return { mime: "image/jpeg", data: await blobToBase64(blob) };
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not prepare the image."));
    }, "image/jpeg", quality);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(blob);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
