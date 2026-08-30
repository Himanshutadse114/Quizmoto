(function () {
  "use strict";

  const BRAND_LOGO_BLACK = "/branding/lmsgen-logo-light.png";
  const BRAND_LOGO_WHITE = "/branding/lmsgen-logo-dark.png";
  const STICKY_AFTER = 48;

  const cssHref = "/landing/css/lmsgen-advantage-assets.css?v=20260830w";
  if (!document.querySelector('link[href*="lmsgen-advantage-assets.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    document.head.appendChild(link);
  } else {
    document.querySelectorAll('link[href*="lmsgen-advantage-assets.css"]').forEach((el) => {
      el.href = cssHref;
    });
  }

  const hide = document.createElement("style");
  hide.textContent = ".ab-hero-carousel-w,.ab-hero-img,.ab-hero-carousel-slide{display:none!important}";
  document.head.appendChild(hide);
  const aboutCarousel = document.querySelector(".ab-hero-carousel-w");
  if (aboutCarousel) aboutCarousel.remove();

  const menuButton = document.querySelector(".global-nav-menu-btn.w-nav-button");
  const menuIcon = document.querySelector(".global-nav-menu-icon");
  const logo = document.querySelector(".nav-logo");
  const header = document.querySelector(".global-header-c");
  const navButton = document.querySelector(".btn-primary.nav-bar.w-button.secondary");
  const navMenu = document.querySelector(".global-header-nav-w");
  const navLinks = document.querySelectorAll(".global-nav-link");
  const languageToggle = document.querySelector(".local-dropdown");
  const languageMenu = document.querySelector(".local-dropdown-c");
  const onHome = document.body.classList.contains("atelora-home-refresh");

  function headerIsLight(sticky) {
    if (!header) return sticky;
    if (sticky) return true;
    if (onHome) return false;
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
    const sticky = menuOpen || window.scrollY > STICKY_AFTER;

    if (menuIcon) menuIcon.classList.toggle("sticky", sticky);
    if (logo) logo.classList.toggle("sticky", sticky);
    header.classList.toggle("sticky", sticky);
    if (navMenu) navMenu.classList.toggle("sticky", sticky);
    if (languageToggle) languageToggle.classList.toggle("sticky", sticky);
    if (languageMenu) languageMenu.classList.toggle("sticky", sticky);
    navLinks.forEach((navLink) => navLink.classList.toggle("sticky", sticky));
    if (navButton) navButton.classList.toggle("secondary", !sticky);

    if (onHome) {
      setMarketingLogo(sticky);
    } else {
      setMarketingLogo(headerIsLight(sticky));
    }
  }

  if (menuButton) {
    new MutationObserver(applyStickyState).observe(menuButton, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  window.addEventListener("scroll", applyStickyState, { passive: true });
  window.addEventListener("resize", applyStickyState);
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

  applyHomePlatformCopy();
  insertHomeQuizmotoSection();

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
        "Create a course with AI. Invite learners to LMSGEN. Or host a live Quizmoto quiz \u2014 players join with a code and compete in realtime.";
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
        body: "A separate live-quiz feature. Host a session, share a join code or link, and everyone plays the same questions in realtime.",
      },
      "Live Quizmoto": {
        title: "Live Quizmoto",
        body: "A separate live-quiz feature. Host a session, share a join code or link, and everyone plays the same questions in realtime.",
      },
      "SCORM Course": {
        title: "SCORM Delivery",
        body: "Publish inside LMSGEN, or export a SCORM package to Moodle, Docebo or any LMS.",
      },
      "Content Library": {
        title: "SCORM Delivery",
        body: "Publish inside LMSGEN, or export a SCORM package to Moodle, Docebo or any LMS.",
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
        body: "Completion, score and time on course \u2014 live dashboard plus PDF and Excel reports.",
      },
      "Analytics & Reports": {
        title: "Analytics & Reports",
        body: "Completion, score and time on course \u2014 live dashboard plus PDF and Excel reports.",
      },
    };

    document.querySelectorAll(".hp-platf-card-inner").forEach((card) => {
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
    if (!onHome) return;
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
          '<p class="lmsgen-qm-kicker">Live quiz \u00b7 separate from the SCORM player</p>' +
          '<h2>Quizmoto is LMSGEN\u2019s live quiz engine</h2>' +
          '<p class="lmsgen-qm-lead">Quizmoto is not the course player. It is a dedicated live-quiz feature in the same workspace. The host starts a session, shares a join code or link, and every player answers the same questions in realtime \u2014 classroom, all-hands, or remote.</p>' +
          '<ul class="lmsgen-qm-steps">' +
            '<li><strong>Host</strong> opens Quizmoto and starts a live quiz.</li>' +
            '<li><strong>Players</strong> join with a code, QR, or copied link \u2014 no LMS login needed.</li>' +
            '<li><strong>Play</strong> with a countdown, live answers, podium, then downloadable reports.</li>' +
          '</ul>' +
          '<div class="lmsgen-qm-actions">' +
            '<a class="lmsgen-qm-btn" href="/login">Host a live quiz</a>' +
            '<a class="lmsgen-qm-link" href="/landing/solutions/#quizmoto-engagement">See it on Solutions</a>' +
          '</div>' +
        '</div>' +
        '<div class="lmsgen-qm-visual">' +
          '<img src="/landing/images/lmsgen/11-quizmoto-live.svg?v=20260830w" alt="Quizmoto live quiz \u2014 join code, realtime play, podium" />' +
        '</div>' +
      '</div>';

    const host =
      section.parentElement && section.parentElement.classList.contains("pin-spacer")
        ? section.parentElement
        : section;
    host.insertAdjacentElement("afterend", block);

    const following = block.nextElementSibling;
    if (following) following.classList.add("lmsgen-after-qm");

    // Inserting this section after GSAP ScrollTrigger has already measured
    // and pinned the horizontal-scroll platform section above leaves its
    // pin-spacer sized for the old (shorter) page - refresh recalculates
    // pin start/end and spacer height against the real, current layout.
    // Without this the page renders far taller than its content (a stale
    // pin-spacer can reserve thousands of extra pixels) and scrolling past
    // the platform section jumps erratically.
    const refresh = () => window.ScrollTrigger && window.ScrollTrigger.refresh();
    if (window.requestAnimationFrame) requestAnimationFrame(refresh);
    else refresh();
    window.addEventListener("load", refresh, { once: true });
  }
})();
