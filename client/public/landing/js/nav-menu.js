(function () {
  "use strict";

  const refreshCssId = "atelora-home-refresh-css";
  if (!document.getElementById(refreshCssId)) {
    const link = document.createElement("link");
    link.id = refreshCssId;
    link.rel = "stylesheet";
    link.href = "/landing/css/atelora-home-refresh.css";
    document.head.appendChild(link);
  }

  document.body.classList.add("atelora-site-refresh");

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

  function applyStickyState() {
    if (!stickySentinel || !header) return;

    const sticky =
      window.scrollY >= stickySentinel.offsetTop ||
      Boolean(menuButton && menuButton.classList.contains("w--open"));

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

  const arrowButton = document.querySelector(".btn-primary.arrow");
  const submitButton = document.querySelector(".btn-primary.submit");
  if (arrowButton && submitButton) {
    arrowButton.addEventListener("click", (event) => {
      event.preventDefault();
      submitButton.click();
    });
  }

  function refreshHomepage() {
    const hero = document.querySelector(".hp-hero-s");
    if (!hero) return;

    document.body.classList.add("atelora-home-refresh");

    const kicker = hero.querySelector(".caption.text-color-lemon");
    const heading = hero.querySelector(".hp-hero-h1");
    const paragraph = hero.querySelector(".hp-hero-p");

    if (kicker) kicker.textContent = "One workspace for modern learning teams";
    if (heading) heading.textContent = "Create, deliver and measure learning in one place.";
    if (paragraph) {
      paragraph.textContent =
        "Build SCORM-ready courses with AI, run live Quizmoto sessions, manage learners and track progress from one connected Atelora workspace.";
    }

    const secondaryCta = hero.querySelector(".hp-hero-cta-c .btn-primary.hp-hero.outline div");
    if (secondaryCta) secondaryCta.textContent = "See solutions";

    const ctaRow = hero.querySelector(".hp-hero-cta-c");
    if (ctaRow && !hero.querySelector(".atelora-hero-signals")) {
      const signals = document.createElement("div");
      signals.className = "atelora-hero-signals";
      signals.innerHTML =
        "<span>AI Course Studio</span><span>Live Quizmoto</span><span>Learning Analytics</span>";
      ctaRow.insertAdjacentElement("afterend", signals);
    }

    const visual = document.querySelector(".hp-hero-img-c.new");
    if (visual && !visual.querySelector(".atelora-hero-product")) {
      const product = document.createElement("div");
      product.className = "atelora-hero-product";
      product.innerHTML =
        '<div class="atelora-product-shell">' +
        '<div class="atelora-product-chrome">' +
        '<span class="atelora-window-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<span class="atelora-product-title">Atelora workspace</span>' +
        '<span class="atelora-product-chip">Platform preview</span>' +
        "</div>" +
        '<div class="atelora-product-media">' +
        '<img src="/atelora-marketing/hero.webp" alt="Atelora learning platform dashboard" loading="eager" decoding="async" />' +
        "</div>" +
        "</div>";
      visual.appendChild(product);
    }
  }

  refreshHomepage();
})();
