const LIVE_API = "https://branko-krivokuca-photography.netlify.app";
const GALLERY_CATEGORIES = {
  landscape: { emptyKey: "emptyLandscape", columns: "2" },
  architecture: { emptyKey: "emptyArchitecture", columns: "2" },
  wildlife: { emptyKey: "emptyWildlife", columns: "2" },
  people: { emptyKey: "emptyPeople", columns: "3" },
};

function liveApi(path) {
  return LIVE_API + path;
}

const form = document.querySelector("#contact-form");
const statusEl = document.querySelector("#form-status");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = lightbox ? lightbox.querySelector("img") : null;
const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector("#site-nav");
const pageGallery = document.querySelector("#category-gallery");

if (pageGallery) {
  loadCategoryPage();
}

if (menuToggle && header && siteNav) {
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
}

if (form && statusEl) {
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
}

if (lightbox && lightboxImage) {
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".gallery button[data-src]");
    if (!button) return;
    lightboxImage.src = button.dataset.src;
    lightboxImage.alt = button.dataset.title || "";
    lightbox.showModal();
  });
}

document.addEventListener("contextmenu", (event) => {
  if (event.target.closest(".gallery, .lightbox, .category-card")) event.preventDefault();
});

document.addEventListener("dragstart", (event) => {
  if (event.target.closest(".gallery, .lightbox, .category-card")) event.preventDefault();
});

function categoryFromPath() {
  const match = location.pathname.match(/\/gallery\/([^/]+)\/?$/);
  return match ? match[1] : "";
}

function photoCategory(photo) {
  return photo.category === "portraits" ? "people" : photo.category;
}

async function loadCategoryPage() {
  const id = categoryFromPath();
  const meta = GALLERY_CATEGORIES[id];
  if (!meta) {
    location.replace("/");
    return;
  }

  pageGallery.dataset.category = id;
  pageGallery.dataset.columns = meta.columns;
  const titleEl = document.querySelector("#gallery-title");
  if (titleEl) {
    titleEl.dataset.i18n = id;
    titleEl.textContent = t(id);
  }
  document.title = `${t(id)} — Branko Krivokuca`;
  document.querySelectorAll("#site-nav a[href^='/gallery/']").forEach((link) => {
    if (link.getAttribute("href") === `/gallery/${id}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  try {
    const photos = await loadPhotos();
    const items = photos.filter((photo) => photoCategory(photo) === id);
    if (!items.length) {
      pageGallery.innerHTML = `<p class="gallery-empty" data-i18n-empty="${meta.emptyKey}">${t(meta.emptyKey)}</p>`;
      return;
    }
    pageGallery.innerHTML = items.map(photoCard).join("");
  } catch {
    pageGallery.innerHTML = `<p class="gallery-empty" data-i18n-empty="galleryError">${t("galleryError")}</p>`;
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
