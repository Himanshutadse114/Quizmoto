(function () {
  "use strict";

  const BRAND_LOGO = "/branding/lmsgen-logo-light.png";
  const header = document.querySelector(".global-header-c");
  const logo = document.querySelector(".nav-logo");
  const menuButton = document.querySelector(".global-nav-menu-btn.w-nav-button");
  const desktopMenu = document.querySelector(".global-header-nav-w.w-nav-menu");
  const onHome = document.body.classList.contains("lmsgen-page-home");
  const mobileQuery = window.matchMedia("(max-width: 991px)");
  let mobileMenuOpen = false;

  function setLogo() {
    if (!logo) return;
    if (logo.getAttribute("src") !== BRAND_LOGO) logo.setAttribute("src", BRAND_LOGO);
    logo.setAttribute("alt", "LMSGEN");
  }

  function applyHeaderState() {
    setLogo();
    if (!header) return;
    header.classList.toggle("sticky", mobileMenuOpen || window.scrollY > 16);
  }

  function ensureMobileDropdown() {
    if (!header || !menuButton || !desktopMenu) return null;

    let dropdown = document.getElementById("lmsgen-mobile-dropdown");
    if (dropdown) return dropdown;

    const style = document.createElement("style");
    style.id = "lmsgen-mobile-dropdown-style";
    style.textContent = `
      #lmsgen-mobile-dropdown {
        display: none;
      }

      @media (max-width: 991px) {
        .global-header-c {
          overflow: visible !important;
        }

        .global-nav-menu-btn.w-nav-button {
          position: relative !important;
          z-index: 2147483002 !important;
          pointer-events: auto !important;
          cursor: pointer !important;
        }

        #lmsgen-mobile-dropdown {
          position: fixed;
          left: 0;
          right: 0;
          width: 100vw;
          max-height: calc(100dvh - var(--lmsgen-mobile-nav-top, 70px));
          padding: 14px 20px 24px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          overflow-y: auto;
          overscroll-behavior: contain;
          background: #ffffff;
          color: #003f3a;
          border-top: 1px solid rgba(0, 63, 58, 0.12);
          box-shadow: 0 18px 42px rgba(0, 63, 58, 0.16);
          z-index: 2147483000;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transform: translateY(-14px);
          transition: opacity 180ms ease, transform 180ms ease, visibility 180ms ease;
        }

        #lmsgen-mobile-dropdown[data-open="true"] {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateY(0);
        }

        #lmsgen-mobile-dropdown .lmsgen-mobile-nav-link {
          width: 100%;
          min-height: 54px;
          padding: 14px 2px;
          display: flex;
          align-items: center;
          color: #003f3a !important;
          border-bottom: 1px solid rgba(0, 63, 58, 0.12);
          font-family: "Montserrat", Arial, sans-serif;
          font-size: 17px;
          font-weight: 600;
          line-height: 1.3;
          text-decoration: none !important;
          text-transform: none;
          box-sizing: border-box;
        }

        #lmsgen-mobile-dropdown .lmsgen-mobile-nav-link:active,
        #lmsgen-mobile-dropdown .lmsgen-mobile-nav-link:focus-visible {
          color: #007c73 !important;
        }

        #lmsgen-mobile-dropdown .lmsgen-mobile-nav-cta {
          min-height: 52px;
          margin-top: 22px;
          padding: 14px 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #004b45;
          color: #ffffff !important;
          font-family: "Montserrat", Arial, sans-serif;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.2;
          text-decoration: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    dropdown = document.createElement("nav");
    dropdown.id = "lmsgen-mobile-dropdown";
    dropdown.setAttribute("aria-label", "Mobile navigation");
    dropdown.setAttribute("data-open", "false");

    const seen = new Set();
    desktopMenu.querySelectorAll("a[href]").forEach((sourceLink) => {
      const href = sourceLink.getAttribute("href");
      const label = (sourceLink.textContent || "").replace(/\s+/g, " ").trim();
      if (!href || !label || seen.has(href)) return;
      if (sourceLink.closest(".mobile-btn-c")) return;
      seen.add(href);

      const link = document.createElement("a");
      link.className = "lmsgen-mobile-nav-link";
      link.href = href;
      link.textContent = label;
      dropdown.appendChild(link);
    });

    if (!seen.has("/")) {
      const home = document.createElement("a");
      home.className = "lmsgen-mobile-nav-link";
      home.href = "/";
      home.textContent = "Home";
      dropdown.insertBefore(home, dropdown.firstChild);
    }

    const cta = document.createElement("a");
    cta.className = "lmsgen-mobile-nav-cta";
    cta.href = "/login";
    cta.textContent = "Explore LMSGEN";
    dropdown.appendChild(cta);

    document.body.appendChild(dropdown);

    dropdown.addEventListener("click", (event) => {
      if (event.target.closest("a[href]")) setMobileMenuOpen(false);
    });

    return dropdown;
  }

  function syncMobileDropdownTop() {
    if (!header) return;
    const rect = header.getBoundingClientRect();
    const top = Math.max(0, Math.round(rect.bottom || rect.height || 70));
    document.documentElement.style.setProperty("--lmsgen-mobile-nav-top", `${top}px`);
    const dropdown = document.getElementById("lmsgen-mobile-dropdown");
    if (dropdown) dropdown.style.top = `${top}px`;
  }

  function setMobileMenuOpen(shouldOpen) {
    const dropdown = ensureMobileDropdown();
    const open = Boolean(shouldOpen && mobileQuery.matches && dropdown);
    mobileMenuOpen = open;

    if (menuButton) {
      menuButton.classList.toggle("w--open", open);
      menuButton.setAttribute("aria-expanded", open ? "true" : "false");
      menuButton.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    }

    if (dropdown) {
      syncMobileDropdownTop();
      dropdown.setAttribute("data-open", open ? "true" : "false");
      dropdown.setAttribute("aria-hidden", open ? "false" : "true");
    }

    if (open) document.body.style.setProperty("overflow", "hidden", "important");
    else document.body.style.removeProperty("overflow");

    applyHeaderState();
  }

  function initialiseMobileNavigation() {
    if (!menuButton || !desktopMenu) return;

    menuButton.style.setProperty("pointer-events", "auto", "important");
    menuButton.style.setProperty("cursor", "pointer", "important");
    menuButton.setAttribute("role", "button");
    menuButton.setAttribute("tabindex", "0");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-controls", "lmsgen-mobile-dropdown");
    menuButton.setAttribute("aria-label", "Open navigation menu");

    ensureMobileDropdown();
    syncMobileDropdownTop();

    const toggle = (event) => {
      if (!mobileQuery.matches) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      setMobileMenuOpen(!mobileMenuOpen);
    };

    menuButton.addEventListener("click", toggle, true);
    menuButton.addEventListener(
      "keydown",
      (event) => {
        if (!mobileQuery.matches || (event.key !== "Enter" && event.key !== " ")) return;
        toggle(event);
      },
      true,
    );

    document.addEventListener("click", (event) => {
      if (!mobileMenuOpen) return;
      const dropdown = document.getElementById("lmsgen-mobile-dropdown");
      if (dropdown && dropdown.contains(event.target)) return;
      if (menuButton.contains(event.target)) return;
      setMobileMenuOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileMenuOpen) setMobileMenuOpen(false);
    });
  }

  initialiseMobileNavigation();

  window.addEventListener("scroll", () => {
    if (mobileMenuOpen) syncMobileDropdownTop();
    applyHeaderState();
  }, { passive: true });

  window.addEventListener("resize", () => {
    syncMobileDropdownTop();
    if (!mobileQuery.matches && mobileMenuOpen) setMobileMenuOpen(false);
    applyHeaderState();
  });

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", (event) => {
      if (!event.matches) setMobileMenuOpen(false);
      else syncMobileDropdownTop();
    });
  }

  applyHeaderState();

  document.querySelectorAll(".btn-primary.arrow").forEach((arrowButton) => {
    const form = arrowButton.closest("form");
    if (!form || form.id === "wf-form-Contact-Form") return;
    const submitButton = form.querySelector(
      'input[type="submit"], button[type="submit"], .btn-primary.submit',
    );
    if (!submitButton) return;
    arrowButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else submitButton.click();
    });
  });

  if (onHome) {
    applyHomePlatformCopy();
    insertHomeQuizmotoSection();
  }

  function applyHomePlatformCopy() {
    const cards = document.querySelectorAll(".hp-platf-card-inner");
    if (!cards.length) return;

    document.querySelectorAll(".hp-platf-card-inner-icon").forEach((icon) => {
      icon.style.display = "none";
    });

    const headingMap = {
      "Create Training Faster with AI": "Create with AI in minutes",
      "Engage Learners with Quizmoto": "Engage teams with live Quizmoto",
      "Publish on LMSGEN and invite your team": "Engage teams with live Quizmoto",
      "Track Progress with Clear Analytics": "Publish SCORM or track in LMSGEN",
      "Or export SCORM to your own LMS": "Publish SCORM or track in LMSGEN",
    };

    document.querySelectorAll(".platform-h2").forEach((el) => {
      const key = (el.textContent || "").replace(/\u2028/g, "").trim();
      if (headingMap[key]) el.textContent = headingMap[key];
    });

    document.querySelectorAll(".hp-platf-stats-cta-c .paragraph-l").forEach((el) => {
      el.textContent =
        "Create a course with AI. Invite learners to LMSGEN. Or host a live Quizmoto quiz — players join with a code and compete in realtime.";
    });

    const buttonMap = {
      LEARN: "CREATE",
      ENGAGE: "PLAY",
      COURSE: "PUBLISH",
      PUBLISH: "CREATE",
      INVITE: "PLAY",
      EXPORT: "PUBLISH",
    };

    document.querySelectorAll(".nhp-platf-btn-inner div").forEach((el) => {
      const key = (el.textContent || "").trim();
      if (buttonMap[key]) el.textContent = buttonMap[key];
    });

    const cardCopy = {
      "AI Course Studio": {
        title: "AI Course Studio",
        body: "Upload a brief or document. AI builds slides, a quiz and a SCORM course you can publish.",
      },
      "Learner Workspace": {
        title: "Learner Hub",
        body: "Share an invite link. Learners open the course and you see who started or finished.",
      },
      "Learner Hub": {
        title: "Learner Hub",
        body: "Share an invite link. Learners open the course and you see who started or finished.",
      },
      "Quizmoto Ready": {
        title: "Live Quizmoto",
        body: "A separate live-quiz feature. Host a session, share a join code or link and everyone plays the same questions in realtime.",
      },
      "Live Quizmoto": {
        title: "Live Quizmoto",
        body: "A separate live-quiz feature. Host a session, share a join code or link and everyone plays the same questions in realtime.",
      },
      "SCORM Course": {
        title: "SCORM Delivery",
        body: "Publish inside LMSGEN or export a SCORM package to another compatible LMS.",
      },
      "Content Library": {
        title: "SCORM Delivery",
        body: "Publish inside LMSGEN or export a SCORM package to another compatible LMS.",
      },
      "Learner Progress": {
        title: "Invites & Access",
        body: "Admins publish. Learners join from an invite. Progress is tracked automatically.",
      },
      "Access Control": {
        title: "Invites & Access",
        body: "Admins publish. Learners join from an invite. Progress is tracked automatically.",
      },
      "Learning Analytics": {
        title: "Analytics & Reports",
        body: "Completion, score and time on course — live dashboard plus PDF and Excel reports.",
      },
      "Analytics & Reports": {
        title: "Analytics & Reports",
        body: "Completion, score and time on course — live dashboard plus PDF and Excel reports.",
      },
    };

    cards.forEach((card) => {
      const titleEl = card.querySelector(".hp-platf-card-inner-title");
      if (!titleEl) return;
      const key = (titleEl.textContent || "").replace(/\u2028/g, "").trim();
      const next = cardCopy[key];
      if (!next) return;
      titleEl.textContent = next.title;
      const bodyEl = card.querySelector(".hp-platf-card-inner-text-c > div:last-child");
      if (bodyEl && bodyEl !== titleEl) bodyEl.textContent = next.body;
    });
  }

  function insertHomeQuizmotoSection() {
    if (document.querySelector(".lmsgen-quizmoto-home")) return;

    const card = document.querySelector(".hp-platform-card-w");
    const section = card && card.closest("section");
    if (!section) return;

    const block = document.createElement("section");
    block.className = "lmsgen-quizmoto-home";
    block.id = "quizmoto";
    block.innerHTML =
      '<div class="lmsgen-qm-inner">' +
        '<div class="lmsgen-qm-copy">' +
          '<p class="lmsgen-qm-kicker">Live quiz · separate from the SCORM player</p>' +
          '<h2>Quizmoto is LMSGEN’s live quiz engine</h2>' +
          '<p class="lmsgen-qm-lead">Quizmoto is a dedicated live-quiz feature in the same workspace. The host starts a session, shares a join code or link and every player answers the same questions in realtime.</p>' +
          '<ul class="lmsgen-qm-steps">' +
            '<li><strong>Host</strong> opens Quizmoto and starts a live quiz.</li>' +
            '<li><strong>Players</strong> join with a code, QR or copied link.</li>' +
            '<li><strong>Play</strong> with a countdown, live answers, podium and downloadable reports.</li>' +
          '</ul>' +
          '<div class="lmsgen-qm-actions">' +
            '<a class="lmsgen-qm-btn" href="/login">Host a live quiz</a>' +
            '<a class="lmsgen-qm-link" href="/solutions#quizmoto-engagement">See it on Solutions</a>' +
          '</div>' +
        '</div>' +
        '<div class="lmsgen-qm-visual">' +
          '<img src="/landing/images/lmsgen/11-quizmoto-live.svg?v=20260903" alt="Quizmoto live quiz — join code, realtime play and podium" />' +
        '</div>' +
      '</div>';

    const host =
      section.parentElement && section.parentElement.classList.contains("pin-spacer")
        ? section.parentElement
        : section;
    host.insertAdjacentElement("afterend", block);

    const following = block.nextElementSibling;
    if (following) following.classList.add("lmsgen-after-qm");

    const refresh = () => window.ScrollTrigger && window.ScrollTrigger.refresh();
    if (window.requestAnimationFrame) requestAnimationFrame(refresh);
    else refresh();
    window.addEventListener("load", refresh, { once: true });
  }
})();
