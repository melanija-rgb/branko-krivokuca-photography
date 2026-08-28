const form = document.querySelector("#contact-form");
const statusEl = document.querySelector("#form-status");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = lightbox.querySelector("img");
const series = [
  { id: "landscape", empty: "Landscape photographs will appear here." },
  { id: "architecture", empty: "Architecture photographs will appear here." },
  { id: "portraits", empty: "Portraits will appear here." },
];

loadGallery();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.classList.remove("error");
  statusEl.textContent = "Sending…";

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    if (isLocalHost()) {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not send the message.");
    } else {
      const body = new URLSearchParams(data);
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) throw new Error("Could not send the message.");
    }

    form.reset();
    statusEl.textContent = "Thank you. Branko will get back to you.";
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

async function loadGallery() {
  try {
    const photos = await loadPhotos();
    series.forEach(({ id, empty }) => {
      const gallery = document.querySelector(`#${id} .gallery`);
      const items = photos.filter((photo) => photo.category === id);
      if (!items.length) {
        gallery.innerHTML = `<p class="gallery-empty">${empty}</p>`;
        return;
      }
      gallery.innerHTML = items.map(photoCard).join("");
    });
  } catch {
    series.forEach(({ id }) => {
      const gallery = document.querySelector(`#${id} .gallery`);
      gallery.innerHTML = `<p class="gallery-empty">The gallery could not be loaded.</p>`;
    });
  }
}

async function loadPhotos() {
  if (isLocalHost()) {
    const response = await fetch("/api/photos");
    if (response.ok) return response.json();
  }
  const response = await fetch("/photos.json");
  if (!response.ok) throw new Error("Gallery unavailable");
  return response.json();
}

function isLocalHost() {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

function photoCard(photo) {
  return `
    <article>
      <button type="button" data-src="${escapeAttr(photo.src)}" data-title="${escapeAttr(photo.title)}">
        <img src="${escapeAttr(photo.src)}" alt="" />
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
