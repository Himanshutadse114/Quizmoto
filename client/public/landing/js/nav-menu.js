(function () {
  "use strict";

  const BRAND_LOGO_BLACK = "/branding/lmsgen-logo-light.png";
  const BRAND_LOGO_WHITE = "/branding/lmsgen-logo-dark.png";

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

  function headerIsLight(sticky) {
    if (!header) return sticky;
    if (sticky) return true;
    if (header.classList.contains("white")) return true;
    if (header.classList.contains("lemon")) return true;
    if (header.classList.contains("turquoise")) return true;
    try {
      const bg = window.getComputedStyle(header).backgroundColor || "";
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return lum > 0.55;
      }
    } catch (e) {}
    return false;
  }

  function setMarketingLogo(useBlack) {
    if (!logo) return;
    const nextSrc = useBlack ? BRAND_LOGO_BLACK : BRAND_LOGO_WHITE;
    if (logo.getAttribute("src") !== nextSrc) logo.setAttribute("src", nextSrc);
    logo.setAttribute("alt", "LMSGEN");
  }

  function applyStickyState() {
    if (!header) {
      setMarketingLogo(false);
      return;
    }

    const menuOpen = Boolean(menuButton && menuButton.classList.contains("w--open"));
    const sticky = stickySentinel
      ? window.scrollY >= stickySentinel.offsetTop || menuOpen
      : menuOpen;

    setMarketingLogo(headerIsLight(sticky));
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

  document.querySelectorAll('[cd="close-book"]').forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".book-demo-s.active").forEach((modal) => {
        modal.classList.remove("active");
      });
    });
  });

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
