(function () {
  "use strict";

  const BRAND_LOGO = "/branding/lmsgen-logo-light.png";
  const header = document.querySelector(".global-header-c");
  const logo = document.querySelector(".nav-logo");
  const menuButton = document.querySelector(".global-nav-menu-btn.w-nav-button");
  const onHome = document.body.classList.contains("lmsgen-page-home");

  function setLogo() {
    if (!logo) return;
    if (logo.getAttribute("src") !== BRAND_LOGO) logo.setAttribute("src", BRAND_LOGO);
    logo.setAttribute("alt", "LMSGEN");
  }

  function applyHeaderState() {
    setLogo();
    if (!header) return;
    const menuOpen = Boolean(menuButton && menuButton.classList.contains("w--open"));
    header.classList.toggle("sticky", menuOpen || window.scrollY > 16);
  }

  if (menuButton) {
    new MutationObserver(applyHeaderState).observe(menuButton, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  window.addEventListener("scroll", applyHeaderState, { passive: true });
  window.addEventListener("resize", applyHeaderState);
  applyHeaderState();

  document.querySelectorAll(".btn-primary.arrow").forEach((arrowButton) => {
    const form = arrowButton.closest("form");
    if (!form) return;
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
