const LIVE_API = "https://branko-krivokuca-photography.netlify.app";

function liveApi(path) {
  return LIVE_API + path;
}

const form = document.querySelector("#contact-form");
const statusEl = document.querySelector("#form-status");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = lightbox.querySelector("img");
const categoryGrid = document.querySelector("#category-grid");
const galleriesSection = document.querySelector("#galleries");
const galleryView = document.querySelector("#gallery-view");
const galleryTitle = document.querySelector("#gallery-title");
const galleryEl = galleryView.querySelector(".gallery");

const GALLERIES = [
  { id: "landscape", emptyKey: "emptyLandscape", coverId: "landscape-sunset" },
  { id: "architecture", emptyKey: "emptyArchitecture", coverId: "arch-kalemegdan" },
  { id: "wildlife", emptyKey: "emptyWildlife", coverId: "landscape-deer" },
  { id: "people", emptyKey: "emptyPeople", coverId: "portrait-daisy" },
];

let photos = [];
let photosReady = false;

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
  if (event.target.closest(".gallery, .lightbox, .category-tile")) event.preventDefault();
});

document.addEventListener("dragstart", (event) => {
  if (event.target.closest(".gallery, .lightbox, .category-tile")) event.preventDefault();
});

window.addEventListener("hashchange", () => showView(true));

async function loadGallery() {
  try {
    photos = await loadPhotos();
    photosReady = true;
    renderOverview();
    showView(Boolean(currentGallery()));
  } catch {
    photosReady = false;
    const error = `<p class="gallery-empty" data-i18n-empty="galleryError">${t("galleryError")}</p>`;
    categoryGrid.innerHTML = error;
    galleryEl.innerHTML = error;
  }
}

function photoCategory(photo) {
  if (!photo) return "";
  return photo.category === "portraits" ? "people" : photo.category;
}

function photosIn(id) {
  return photos.filter((photo) => photoCategory(photo) === id);
}

function renderOverview() {
  categoryGrid.innerHTML = GALLERIES.map((gallery) => {
    const items = photosIn(gallery.id);
    const cover = items.find((photo) => photo.id === gallery.coverId) || items[0];
    const image = cover
      ? `<img src="${escapeAttr(gallerySrc(cover.src))}" alt="" draggable="false" />`
      : "";
    return `
      <a class="category-tile" href="#${gallery.id}">
        <span class="category-tile-photo">${image}</span>
        <span class="category-tile-panel">
          <span class="category-tile-label" data-i18n="${gallery.id}">${t(gallery.id)}</span>
        </span>
      </a>
    `;
  }).join("");
}

function currentGallery() {
  const hash = location.hash.replace(/^#/, "");
  return GALLERIES.find((gallery) => gallery.id === hash) || null;
}

function showView(scroll) {
  const gallery = currentGallery();
  document.querySelectorAll("nav a[data-gallery]").forEach((link) => {
    link.classList.toggle("is-active", Boolean(gallery && link.dataset.gallery === gallery.id));
  });

  if (!gallery) {
    galleriesSection.hidden = false;
    galleryView.hidden = true;
    if (scroll) requestAnimationFrame(() => scrollToHash());
    return;
  }

  galleriesSection.hidden = true;
  galleryView.hidden = false;
  galleryTitle.dataset.i18n = gallery.id;
  galleryTitle.textContent = t(gallery.id);
  galleryEl.dataset.category = gallery.id;

  if (photosReady) {
    const items = photosIn(gallery.id);
    galleryEl.innerHTML = items.length
      ? items.map(photoCard).join("")
      : `<p class="gallery-empty" data-i18n-empty="${gallery.emptyKey}">${t(gallery.emptyKey)}</p>`;
  }

  if (scroll) requestAnimationFrame(() => galleryView.scrollIntoView({ block: "start" }));
}

function scrollToHash() {
  const hash = location.hash.replace(/^#/, "");
  if (!hash || hash === "top") {
    window.scrollTo({ top: 0 });
    return;
  }
  const target = document.getElementById(hash);
  if (target) target.scrollIntoView();
}

async function loadPhotos() {
  const [builtIn, catalog] = await Promise.all([
    fetch("/photos.json").then((response) => (response.ok ? response.json() : [])).catch(() => []),
    fetch(liveApi("/api/photos")).then((response) => (response.ok ? response.json() : [])).catch(() => []),
  ]);
  const uploaded = Array.isArray(catalog) ? catalog : catalog && Array.isArray(catalog.photos) ? catalog.photos : [];
  const removed = new Set(!Array.isArray(catalog) && catalog && Array.isArray(catalog.removed) ? catalog.removed : []);
  const builtIns = Array.isArray(builtIn) ? builtIn : [];
  if (!builtIns.length && !uploaded.length) throw new Error("Gallery unavailable");
  return mergePhotos(builtIns, uploaded, removed);
}

function mergePhotos(builtIns, uploaded, removed) {
  const builtInIds = new Set(builtIns.map((photo) => photo && photo.id).filter(Boolean));
  const overrides = new Map();
  const uploadedOnly = [];
  for (const photo of uploaded) {
    if (!photo || !photo.id || removed.has(photo.id)) continue;
    if (builtInIds.has(photo.id)) overrides.set(photo.id, photo);
    else uploadedOnly.push(photo);
  }

  const seen = new Set();
  const merged = [];
  for (const photo of uploadedOnly) {
    if (seen.has(photo.id)) continue;
    seen.add(photo.id);
    merged.push(photo);
  }
  for (const photo of builtIns) {
    if (!photo || !photo.id || removed.has(photo.id) || seen.has(photo.id)) continue;
    seen.add(photo.id);
    const override = overrides.get(photo.id);
    merged.push(
      override
        ? { ...photo, ...override, src: photo.src, category: override.category || photo.category }
        : photo
    );
  }
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
