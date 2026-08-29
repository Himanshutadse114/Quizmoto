(function(){"use strict";const c=document.querySelector(".global-nav-menu-btn.w-nav-button"),s=document.querySelector(".global-nav-menu-icon"),r=document.querySelector(".nav-logo"),n=document.querySelector(".global-header-c"),a=document.querySelector(".btn-primary.nav-bar.w-button.secondary"),l=document.querySelector(".global-header-nav-w"),i=document.querySelectorAll(".global-nav-link"),d=document.querySelector(".navbar-scroll"),u=document.querySelector(".local-dropdown"),y=document.querySelector(".local-dropdown-c");function o(){if(!d)return;const e=d.offsetTop;window.scrollY>=e||c.classList.contains("w--open")?(s.classList.add("sticky"),r.classList.add("sticky"),n.classList.add("sticky"),a.classList.remove("secondary"),l.classList.add("sticky"),u.classList.add("sticky"),y.classList.add("sticky"),i.forEach(function(t){t.classList.add("sticky")})):(s.classList.remove("sticky"),r.classList.remove("sticky"),n.classList.remove("sticky"),a.classList.add("secondary"),l.classList.remove("sticky"),u.classList.remove("sticky"),y.classList.remove("sticky"),i.forEach(function(t){t.classList.remove("sticky")}))}new MutationObserver(o).observe(c,{attributes:!0,attributeFilter:["class"]}),window.addEventListener("scroll",o),o();const m=document.querySelectorAll('[cd="book-a-demo"]'),b=document.querySelectorAll('[cd="close-book"]');m.forEach(e=>{e.addEventListener("click",()=>{document.querySelector(".book-demo-s").classList.add("active")})}),b.forEach(e=>{e.addEventListener("click",()=>{document.querySelector(".book-demo-s").classList.remove("active")})});const arrow=document.querySelector(".btn-primary.arrow");arrow&&arrow.addEventListener("click",()=>{const submit=document.querySelector(".btn-primary.submit");submit&&submit.click()});

  const hide=document.createElement("style");
  hide.textContent=".sl-features-key-c{display:none!important}";
  document.head.appendChild(hide);
  const keyBlock=document.querySelector(".sl-features-key-c");
  if(keyBlock){
    const wrap=keyBlock.parentElement;
    const prev=wrap&&wrap.previousElementSibling;
    if(prev&&prev.classList.contains("global-separator")) prev.remove();
    if(wrap) wrap.remove();
    else keyBlock.remove();
  }

  const ART_BASE="/landing/images/lmsgen/";
  const css=document.createElement("link");
  css.rel="stylesheet";
  css.href="/landing/css/lmsgen-advantage-assets.css?v=20260830b";
  document.head.appendChild(css);

  const art=[
    [".sl-hero-img", ART_BASE+"01-hero-course-studio.svg", "LMSGEN course studio — AI authoring, SCORM delivery and learner tracking"],
    ["#ai-course-authoring .sl-feat-common-img", ART_BASE+"02-ai-from-documents.svg", "LMSGEN turns documents into structured courses"],
    ["#scorm-ready-delivery .sl-feat-common-img", ART_BASE+"10-scorm-package.svg", "SCORM-ready package delivery"],
    ["#quizmoto-engagement .sl-feat-common-img", ART_BASE+"11-quizmoto-live.svg", "Quizmoto live quiz — separate realtime feature"],
    ["#learning-analytics .sl-feat-common-img", ART_BASE+"04-tracking-dashboard.svg", "LMSGEN learner tracking dashboard"],
    ["#admin-access .sl-feat-common-img", ART_BASE+"07-safety-audience.svg", "Admin and audience access controls"],
    [".sl-feat-templ-cards-c .sl-features-key-card-w:nth-child(1) .sl-featkey-card-img img", ART_BASE+"13-brand-templates.svg", "Create on-brand courses from source documents"],
    [".sl-feat-templ-cards-c .sl-features-key-card-w:nth-child(2) .sl-featkey-card-img img", ART_BASE+"14-studio-scale.svg", "LMSGEN course studio at scale"],
    [".nsl-local-graph-cards-row .nsl-local-graph-card:nth-child(1) .nsl-local-graph-card-img-c img", ART_BASE+"15-self-paced.svg", "Self-paced course template"],
    [".nsl-local-graph-cards-row .nsl-local-graph-card:nth-child(2) .nsl-local-graph-card-img-c img", ART_BASE+"16-bulk-assign.svg", "Bulk-assign a course from a share link"],
    [".nsl-local-graph-card.parallel .nsl-local-graph-card-img-c img", ART_BASE+"17-learning-paths.svg", "Personalized learning paths"],
    ["#learner-management .sl-feat-common-img", ART_BASE+"18-learner-mgmt.svg", "Learner access and reporting dashboard"]
  ];
  function applySrc(img, src, alt){
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.setAttribute("src", src);
    img.src = src;
    if(alt) img.alt = alt;
    img.loading = img.classList.contains("sl-hero-img") ? "eager" : "lazy";
    img.style.opacity = "1";
  }
  art.forEach(function(item){
    document.querySelectorAll(item[0]).forEach(function(img){
      applySrc(img, item[1], item[2]);
    });
  });
  const og=document.querySelector('meta[property="og:image"]');
  if(og) og.setAttribute("content", ART_BASE+"08-og-banner.svg");

  const Q_HEAD = "Quizmoto — a separate live-quiz feature";
  const Q_BODY = "Quizmoto is a separate feature in your LMSGEN workspace. Conduct live quizzes where participants join with a code and play in realtime — it is not the SCORM course player.";
  const section = document.querySelector("#quizmoto-engagement");
  if(section){
    const h = section.querySelector("h3");
    const p = section.querySelector("p");
    if(h) h.textContent = Q_HEAD;
    if(p) p.textContent = Q_BODY;
  }
  document.querySelectorAll("p, h3, .paragraph-s, .paragraph-m, .paragraph-l").forEach(function(el){
    const t = (el.textContent || "").trim();
    if(t === "Turn passive training into active participation with live Quizmoto quizzes and game-based sessions."){
      el.textContent = "Quizmoto is a separate live-quiz feature. Run realtime quizzes in your workspace — users join and play together, live.";
    }
    if(t === "Add live Quizmoto quizzes and game-based checks to any course, for any team."){
      el.textContent = "Use Quizmoto as its own live-quiz tool in the same workspace. Host a session, share a join code, and play in realtime.";
    }
    if(t === "Run fast, competitive live quizzes that make training more memorable."){
      el.textContent = Q_BODY;
    }
    if(t === "Quizmoto, Live"){
      el.textContent = Q_HEAD;
    }
  });
})();
