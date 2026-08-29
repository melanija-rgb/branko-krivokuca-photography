const I18N = {
  en: {
    title: "Branko Krivokuca — Photographer",
    thanksTitle: "Thank you — Branko Krivokuca",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    gallery: "Gallery",
    landscape: "Landscape",
    architecture: "Architecture",
    portraits: "Portraits",
    social: "Social",
    contact: "Contact",
    photographer: "Photographer",
    headline: "Landscape and nature photographer.",
    roles: "Climber · Mountaineer",
    lede: "Prints available. Work is shown in three series below.",
    series: "Series",
    connect: "Connect",
    socialMedia: "Social media",
    contactIntro:
      "If you would like to book a session, order a print, or discuss a project, write to Branko here.",
    honeypot: "Don’t fill this",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    whatWouldYouLike: "What would you like?",
    messagePlaceholder: "Tell Branko about the service or project you have in mind.",
    sendMessage: "Send message",
    sending: "Sending…",
    thankYou: "Thank you. Branko will get back to you.",
    sendError: "Could not send the message.",
    errName: "Please fill in your name and message.",
    errEmail: "Please enter a valid email address.",
    factPortraits: "📸 Portraits and events",
    factDm: "📩 For photography services, send a DM",
    emptyLandscape: "Landscape photographs will appear here.",
    emptyArchitecture: "Architecture photographs will appear here.",
    emptyPortraits: "Portraits will appear here.",
    galleryError: "The gallery could not be loaded.",
    close: "Close",
    thanksHeading: "Thank you.",
    thanksLede: "Branko will get back to you.",
    backToSite: "Back to the site",
    langGroup: "Language",
  },
  sr: {
    title: "Branko Krivokuca — Fotograf",
    thanksTitle: "Hvala — Branko Krivokuca",
    openMenu: "Otvori meni",
    closeMenu: "Zatvori meni",
    gallery: "Galerija",
    landscape: "Pejzaž",
    architecture: "Arhitektura",
    portraits: "Portreti",
    social: "Društvene",
    contact: "Kontakt",
    photographer: "Fotograf",
    headline: "Fotograf pejzaža i prirode.",
    roles: "Penjač · Planinar",
    lede: "Printovi su dostupni. Radovi su prikazani u tri serije ispod.",
    series: "Serija",
    connect: "Poveži se",
    socialMedia: "Društvene mreže",
    contactIntro:
      "Ako želite da zakažete termin, naručite print ili razgovarate o projektu, pišite Branku ovdje.",
    honeypot: "Ovo ne popunjavajte",
    firstName: "Ime",
    lastName: "Prezime",
    email: "E-pošta",
    whatWouldYouLike: "Šta želite?",
    messagePlaceholder: "Recite Branku koju uslugu ili projekat imate na umu.",
    sendMessage: "Pošalji poruku",
    sending: "Šalje se…",
    thankYou: "Hvala. Branko će vam se javiti.",
    sendError: "Poruka se nije mogla poslati.",
    errName: "Unesite ime i poruku.",
    errEmail: "Unesite ispravnu e-poštu.",
    factPortraits: "📸 Portreti i događaji",
    factDm: "📩 Za usluge fotografisanja javite se u DM",
    emptyLandscape: "Ovdje će se pojaviti pejzažne fotografije.",
    emptyArchitecture: "Ovdje će se pojaviti arhitektonske fotografije.",
    emptyPortraits: "Ovdje će se pojaviti portreti.",
    galleryError: "Galerija se nije mogla učitati.",
    close: "Zatvori",
    thanksHeading: "Hvala.",
    thanksLede: "Branko će vam se javiti.",
    backToSite: "Nazad na sajt",
    langGroup: "Jezik",
  },
};

function currentLang() {
  return localStorage.getItem("bk-lang") === "sr" ? "sr" : "en";
}

function t(key) {
  const lang = currentLang();
  return I18N[lang][key] || I18N.en[key] || key;
}

function applyLanguage(lang) {
  const next = lang === "sr" ? "sr" : "en";
  localStorage.setItem("bk-lang", next);
  document.documentElement.lang = next === "sr" ? "sr-Latn" : "en";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const open = el.getAttribute("aria-expanded") === "true";
    const key = open && el.dataset.i18nAriaOpen ? el.dataset.i18nAriaOpen : el.dataset.i18nAria;
    el.setAttribute("aria-label", t(key));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    document.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll(".lang-switch").forEach((group) => {
    group.setAttribute("aria-label", t("langGroup"));
  });
  document.querySelectorAll(".lang-switch [data-lang]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.lang === next);
  });
  document.querySelectorAll(".gallery-empty").forEach((el) => {
    if (el.dataset.i18nEmpty) el.textContent = t(el.dataset.i18nEmpty);
  });

  window.dispatchEvent(new Event("bk-lang"));
}

document.querySelectorAll(".lang-switch [data-lang]").forEach((btn) => {
  btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
});

applyLanguage(currentLang());
