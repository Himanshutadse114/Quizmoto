(function () {
  "use strict";

  const staticToFriendly = new Map([
    ["/landing/index.html", "/"],
    ["/landing/solutions/index.html", "/solutions"],
    ["/landing/about/index.html", "/about"],
    ["/landing/blog/index.html", "/blog"],
    ["/landing/contact/index.html", "/contact"],
  ]);

  const friendlyToStatic = new Map(
    Array.from(staticToFriendly.entries(), ([staticPath, friendlyPath]) => [friendlyPath, staticPath]),
  );

  // Static marketing pages can be opened directly on any host. Keep the public
  // URL clean without forcing the page back through the React router.
  const friendlyPath = staticToFriendly.get(window.location.pathname);
  if (friendlyPath) {
    window.history.replaceState(
      window.history.state,
      "",
      `${friendlyPath}${window.location.search}${window.location.hash}`,
    );
  }

  // Marketing-to-marketing navigation goes straight to the prebuilt document,
  // avoiding the React Suspense fallback and the old iframe remount.
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const anchor = event.target.closest("a[href]");
    if (!anchor) return;

    let url;
    try {
      url = new URL(anchor.href, window.location.origin);
    } catch {
      return;
    }

    if (url.origin !== window.location.origin) return;
    const staticPath = friendlyToStatic.get(url.pathname);
    if (!staticPath) return;

    event.preventDefault();
    window.location.assign(`${staticPath}${url.search}${url.hash}`);
  });

  // Warm the other marketing documents once the current page is interactive.
  const prefetchMarketingPages = () => {
    friendlyToStatic.forEach((staticPath) => {
      if (staticPath === window.location.pathname) return;
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "document";
      link.href = staticPath;
      document.head.appendChild(link);
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(prefetchMarketingPages, { timeout: 1600 });
  } else {
    window.setTimeout(prefetchMarketingPages, 600);
  }

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
