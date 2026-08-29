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

  const response = await fetch("/api/photos", {
    method: "POST",
    body: new FormData(uploadForm),
  });
  const payload = await response.json();

  if (!response.ok) {
    uploadStatus.classList.add("error");
    uploadStatus.textContent = payload.error || "Upload failed.";
    return;
  }

  uploadForm.reset();
  uploadStatus.textContent = "Added to the gallery.";
  loadPhotos();
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
  await fetch(`/api/photos/${button.dataset.photoId}`, { method: "DELETE" });
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
  const sources = ["/api/photos", "/photos.json"];
  for (const url of sources) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (Array.isArray(data)) return data;
    } catch {
      /* try the next source */
    }
  }
  return [];
}

function photoFigure(photo) {
  return `
    <figure>
      <img src="${escapeAttr(photo.src)}" alt="" />
      <figcaption>
        <button class="ghost" type="button" data-photo-id="${photo.id}">Remove</button>
      </figcaption>
    </figure>
  `;
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
