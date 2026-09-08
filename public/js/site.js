const LIVE_API = "https://branko-krivokuca-photography.netlify.app";

function liveApi(path) {
  return LIVE_API + path;
}

const form = document.querySelector("#contact-form");
const statusEl = document.querySelector("#form-status");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = lightbox.querySelector("img");
const series = [
  { id: "landscape", emptyKey: "emptyLandscape" },
  { id: "architecture", emptyKey: "emptyArchitecture" },
  { id: "portraits", emptyKey: "emptyPortraits" },
];

loadGallery();

const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector("#site-nav");

menuToggle.addEventListener("click", () => {
  const open = header.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", t(open ? "closeMenu" : "openMenu"));
});

siteNav.addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  header.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", t("openMenu"));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.classList.remove("error");
  statusEl.textContent = t("sending");

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch(liveApi("/api/inquiries"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || t("sendError"));

    form.reset();
    statusEl.textContent = t("thankYou");
  } catch (error) {
    statusEl.classList.add("error");
    statusEl.textContent = error.message;
  }
});

document.querySelector("main").addEventListener("click", (event) => {
  const button = event.target.closest(".gallery button[data-src]");
  if (!button) return;
  lightboxImage.src = button.dataset.src;
  lightboxImage.alt = button.dataset.title || "";
  lightbox.showModal();
});

document.addEventListener("contextmenu", (event) => {
  if (event.target.closest(".gallery, .lightbox")) event.preventDefault();
});

document.addEventListener("dragstart", (event) => {
  if (event.target.closest(".gallery, .lightbox")) event.preventDefault();
});

async function loadGallery() {
  try {
    const photos = await loadPhotos();
    series.forEach(({ id, emptyKey }) => {
      const gallery = document.querySelector(`#${id} .gallery`);
      const items = photos.filter((photo) => photo.category === id);
      if (!items.length) {
        gallery.innerHTML = `<p class="gallery-empty" data-i18n-empty="${emptyKey}">${t(emptyKey)}</p>`;
        return;
      }
      gallery.innerHTML = items.map(photoCard).join("");
    });
  } catch {
    series.forEach(({ id }) => {
      const gallery = document.querySelector(`#${id} .gallery`);
      gallery.innerHTML = `<p class="gallery-empty" data-i18n-empty="galleryError">${t("galleryError")}</p>`;
    });
  }
}

async function loadPhotos() {
  const [builtIn, catalog] = await Promise.all([
    fetch("/photos.json").then((response) => (response.ok ? response.json() : [])).catch(() => []),
    fetch(liveApi("/api/photos")).then((response) => (response.ok ? response.json() : [])).catch(() => []),
  ]);
  const uploaded = Array.isArray(catalog) ? catalog : catalog && Array.isArray(catalog.photos) ? catalog.photos : [];
  const removed = new Set(!Array.isArray(catalog) && catalog && Array.isArray(catalog.removed) ? catalog.removed : []);
  if (!Array.isArray(builtIn) && !Array.isArray(uploaded)) throw new Error("Gallery unavailable");
  const seen = new Set();
  const merged = [];
  for (const photo of [...uploaded, ...(Array.isArray(builtIn) ? builtIn : [])]) {
    if (!photo || !photo.id || seen.has(photo.id) || removed.has(photo.id)) continue;
    seen.add(photo.id);
    merged.push(photo);
  }
  if (!merged.length && !Array.isArray(builtIn)) throw new Error("Gallery unavailable");
  return merged;
}

function gallerySrc(src) {
  if (String(src || "").startsWith("/api/")) return liveApi(src);
  return src;
}

function photoCard(photo) {
  return `
    <article>
      <button type="button" data-src="${escapeAttr(gallerySrc(photo.src))}" data-title="${escapeAttr(photo.title)}">
        <img src="${escapeAttr(gallerySrc(photo.src))}" alt="" draggable="false" />
      </button>
    </article>
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
