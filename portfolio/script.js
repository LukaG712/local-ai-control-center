const languageButtons = document.querySelectorAll("[data-language]");
const localizedElements = document.querySelectorAll("[data-nl][data-en]");
const nav = document.querySelector("#site-nav");
const menuToggle = document.querySelector(".menu-toggle");
const screenshot = document.querySelector("#project-shot");
const galleryButtons = document.querySelectorAll(".gallery-thumb");

function setLanguage(language) {
  const selected = language === "en" ? "en" : "nl";
  document.documentElement.lang = selected;

  for (const element of localizedElements) {
    element.textContent = element.dataset[selected];
  }

  for (const button of languageButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.language === selected),
    );
  }

  const selectedImage = document.querySelector(".gallery-thumb.selected");
  if (selectedImage && screenshot) {
    screenshot.alt =
      selected === "nl" ? selectedImage.dataset.altNl : selectedImage.dataset.altEn;
  }

  document.querySelector("nav").setAttribute(
    "aria-label",
    selected === "nl" ? "Hoofdnavigatie" : "Main navigation",
  );
  menuToggle.setAttribute(
    "aria-label",
    selected === "nl"
      ? menuToggle.getAttribute("aria-expanded") === "true"
        ? "Menu sluiten"
        : "Menu openen"
      : menuToggle.getAttribute("aria-expanded") === "true"
        ? "Close menu"
        : "Open menu",
  );

  try {
    localStorage.setItem("portfolio-language", selected);
  } catch {
    // Language selection still applies until the page is closed.
  }
}

for (const button of languageButtons) {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
}

for (const button of galleryButtons) {
  button.addEventListener("click", () => {
    screenshot.src = button.dataset.image;
    screenshot.alt =
      document.documentElement.lang === "nl"
        ? button.dataset.altNl
        : button.dataset.altEn;
    for (const item of galleryButtons) {
      const active = item === button;
      item.classList.toggle("selected", active);
      item.setAttribute("aria-pressed", String(active));
    }
  });
}

menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(open));
  nav.classList.toggle("open", open);
  menuToggle.setAttribute(
    "aria-label",
    document.documentElement.lang === "nl"
      ? open
        ? "Menu sluiten"
        : "Menu openen"
      : open
        ? "Close menu"
        : "Open menu",
  );
});

nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    setLanguage(document.documentElement.lang);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && nav.classList.contains("open")) {
    nav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    setLanguage(document.documentElement.lang);
    menuToggle.focus();
  }
});

document.querySelector("#year").textContent = String(new Date().getFullYear());
let initialLanguage = "nl";
try {
  initialLanguage = localStorage.getItem("portfolio-language") || "nl";
} catch {
  // Use Dutch by default when local storage is unavailable.
}
setLanguage(initialLanguage);
