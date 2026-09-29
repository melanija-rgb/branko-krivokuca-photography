const LIVE_API = "https://branko-krivokuca-photography.netlify.app";

function liveApi(path) {
  return LIVE_API + path;
}

const form = document.querySelector("#contact-form");
const statusEl = document.querySelector("#form-status");
const contactDialog = document.querySelector("#contact-dialog");
const socialDialog = document.querySelector("#social-dialog");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = lightbox.querySelector("img");
const categoryGrid = document.querySelector("#category-grid");
const galleriesSection = document.querySelector("#galleries");
const galleryView = document.querySelector("#gallery-view");
const hero = document.querySelector("#hero");
const heroPhotos = [...hero.querySelectorAll(".hero-photo")];
const galleryTitle = document.querySelector("#gallery-title");
const galleryEl = galleryView.querySelector(".gallery");

const GALLERIES = [
  { id: "landscape", emptyKey: "emptyLandscape", coverId: "landscape-sunset" },
  { id: "architecture", emptyKey: "emptyArchitecture", coverId: "arch-kalemegdan" },
  { id: "wildlife", emptyKey: "emptyWildlife", coverId: "landscape-deer" },
  { id: "people", emptyKey: "emptyPeople", coverId: "portrait-daisy" },
];

// Swap the hero by editing this list. Ids are resolved from the photo store when present.
const HERO = [
  { id: "landscape-milky-way", src: "/images/landscape-milky-way.png" },
  { id: "landscape-sunset", src: "/images/landscape-sunset.png" },
  { id: "landscape-canyon", src: "/images/landscape-canyon.png" },
  { id: "landscape-snow", src: "/images/landscape-snow.png" },
];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let heroTimer = 0;
let heroKey = "";

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
  const link = event.target.closest("a");
  if (!link) return;
  header.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", t("openMenu"));
  const href = link.getAttribute("href");
  if (href === "#contact" || href === "#social") {
    event.preventDefault();
    openSheet(href === "#contact" ? contactDialog : socialDialog);
  }
});

document.querySelectorAll(".sheet-dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
});

if (location.hash === "#contact") openSheet(contactDialog);
if (location.hash === "#social") openSheet(socialDialog);

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
  if (event.target.closest(".gallery, .lightbox, .category-tile, .hero")) event.preventDefault();
});

document.addEventListener("dragstart", (event) => {
  if (event.target.closest(".gallery, .lightbox, .category-tile, .hero")) event.preventDefault();
});

categoryGrid.addEventListener("pointerdown", (event) => {
  const tile = event.target.closest(".category-tile");
  if (tile) tile.classList.add("is-hot");
});

categoryGrid.addEventListener("pointerup", clearHotTile);
categoryGrid.addEventListener("pointercancel", clearHotTile);
categoryGrid.addEventListener("pointerleave", clearHotTile);

function clearHotTile() {
  categoryGrid.querySelectorAll(".category-tile.is-hot").forEach((tile) => tile.classList.remove("is-hot"));
}

syncHeaderHeight();
window.addEventListener("resize", syncHeaderHeight);
startHero();

window.addEventListener("hashchange", () => {
  if (location.hash === "#contact") {
    openSheet(contactDialog);
    return;
  }
  if (location.hash === "#social") {
    openSheet(socialDialog);
    return;
  }
  showView(true);
});

function openSheet(dialog) {
  [contactDialog, socialDialog].forEach((other) => {
    if (other !== dialog && other.open) other.close();
  });
  if (!dialog.open) dialog.showModal();
}

async function loadGallery() {
  try {
    photos = await loadPhotos();
    photosReady = true;
    renderOverview();
    startHero();
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
  categoryGrid.innerHTML = GALLERIES.map((gallery, index) => {
    const items = photosIn(gallery.id);
    const cover = items.find((photo) => photo.id === gallery.coverId) || items[0];
    const image = cover
      ? `<img src="${escapeAttr(gallerySrc(cover.src))}" alt="" draggable="false" />`
      : "";
    return `
      <a class="category-tile" href="#${gallery.id}" data-accent="${gallery.id}" style="--reveal: ${index * 110}ms">
        <span class="category-tile-photo">${image}</span>
        <span class="category-tile-panel">
          <span class="category-tile-label" data-i18n="${gallery.id}">${t(gallery.id)}</span>
        </span>
      </a>
    `;
  }).join("");
  revealTiles();
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

  hero.hidden = Boolean(gallery);

  if (!gallery) {
    galleriesSection.hidden = false;
    galleryView.hidden = true;
    delete galleryView.dataset.accent;
    if (scroll) requestAnimationFrame(() => scrollToHash());
    return;
  }

  galleriesSection.hidden = true;
  galleryView.hidden = false;
  galleryView.dataset.accent = gallery.id;
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

function syncHeaderHeight() {
  if (header.classList.contains("is-open")) return;
  document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
}

function revealTiles() {
  const tiles = [...categoryGrid.querySelectorAll(".category-tile")];
  if (reducedMotion || !("IntersectionObserver" in window)) {
    tiles.forEach((tile) => tile.classList.add("is-in"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.28 }
  );
  tiles.forEach((tile) => observer.observe(tile));
}

function resolvedHeroSources() {
  return HERO.map((item) => {
    const photo = photos.find((entry) => entry.id === item.id);
    if (photosReady && !photo) return "";
    return photo ? gallerySrc(photo.src) : item.src;
  }).filter(Boolean);
}

function startHero() {
  const sources = resolvedHeroSources();
  if (!sources.length) return;
  const key = sources.join("|");
  if (key === heroKey) return;
  heroKey = key;
  clearInterval(heroTimer);

  let index = 0;
  const [current, incoming] = heroPhotos;
  primeHeroPhoto(current, sources[0], true);
  if (sources.length < 2 || reducedMotion) return;

  const preload = new Image();
  preload.src = sources[1];

  heroTimer = setInterval(() => {
    index = (index + 1) % sources.length;
    const enter = heroPhotos.find((photo) => !photo.classList.contains("is-on"));
    const leave = heroPhotos.find((photo) => photo.classList.contains("is-on"));
    const src = sources[index];
    const reveal = () => {
      enter.classList.remove("is-zoom");
      void enter.offsetWidth;
      enter.classList.add("is-on", "is-zoom");
      leave.classList.remove("is-on");
    };
    if (enter.getAttribute("src") === src && enter.complete) reveal();
    else {
      enter.onload = () => {
        enter.onload = null;
        reveal();
      };
      enter.src = src;
    }
    const next = new Image();
    next.src = sources[(index + 1) % sources.length];
  }, 7600);
}

function primeHeroPhoto(photo, src, active) {
  photo.src = src;
  photo.classList.toggle("is-on", active);
  photo.classList.toggle("is-zoom", active && !reducedMotion);
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
