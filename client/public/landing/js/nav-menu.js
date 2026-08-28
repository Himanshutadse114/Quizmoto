(function () {
  "use strict";

  const BRAND_LOGO_LIGHT = "/branding/lmsgen-logo-light.png";
  const BRAND_LOGO_DARK = "/branding/lmsgen-logo-dark.png";

  // Pretty URLs (/, /solutions, /about, /blog, /contact) are rewritten to
  // their built documents by the host's static routing, so plain <a> links
  // to those paths already work as normal full-page navigations - no
  // client-side history rewriting or click interception needed here.

  const menuButton = document.querySelector(".global-nav-menu-btn.w-nav-button");
  const menuIcon = document.querySelector(".global-nav-menu-icon");
  const logo = document.querySelector(".nav-logo");
  const header = document.querySelector(".global-header-c");
  const navButton = document.querySelector(".btn-primary.nav-bar.w-button.secondary");
  const navMenu = document.querySelector(".global-header-nav-w");
  const navLinks = document.querySelectorAll(".global-nav-link");
  const stickySentinel = document.querySelector(".navbar-scroll");
  const languageToggle = document.querySelector(".local-dropdown");
  const languageMenu = document.querySelector(".local-dropdown-c");

  function setMarketingLogo(sticky) {
    if (!logo) return;
    const nextSrc = sticky ? BRAND_LOGO_LIGHT : BRAND_LOGO_DARK;
    if (logo.getAttribute("src") !== nextSrc) logo.setAttribute("src", nextSrc);
    logo.setAttribute("alt", "LMSGEN");
  }

  function applyStickyState() {
    if (!header) {
      setMarketingLogo(false);
      return;
    }

    const sticky = stickySentinel
      ? window.scrollY >= stickySentinel.offsetTop ||
        Boolean(menuButton && menuButton.classList.contains("w--open"))
      : Boolean(menuButton && menuButton.classList.contains("w--open"));

    setMarketingLogo(sticky);
    if (menuIcon) menuIcon.classList.toggle("sticky", sticky);
    if (logo) logo.classList.toggle("sticky", sticky);
    header.classList.toggle("sticky", sticky);
    if (navMenu) navMenu.classList.toggle("sticky", sticky);
    if (languageToggle) languageToggle.classList.toggle("sticky", sticky);
    if (languageMenu) languageMenu.classList.toggle("sticky", sticky);
    navLinks.forEach((navLink) => navLink.classList.toggle("sticky", sticky));
    if (navButton) navButton.classList.toggle("secondary", !sticky);
  }

  if (menuButton) {
    new MutationObserver(applyStickyState).observe(menuButton, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  window.addEventListener("scroll", applyStickyState, { passive: true });
  applyStickyState();

  // The legacy demo modal is no longer used. Close controls remain harmless if
  // an older cached document still contains the modal markup.
  document.querySelectorAll('[cd="close-book"]').forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".book-demo-s.active").forEach((modal) => {
        modal.classList.remove("active");
      });
    });
  });

  // Keep arrow-style form controls functional without relying on one global form.
  document.querySelectorAll(".btn-primary.arrow").forEach((arrowButton) => {
    const form = arrowButton.closest("form");
    if (!form) return;

    const submitButton = form.querySelector(
      'input[type="submit"], button[type="submit"], .btn-primary.submit',
    );
    if (!submitButton) return;

    arrowButton.addEventListener("click", (event) => {
      event.preventDefault();
      submitButton.click();
    });
  });
})();
