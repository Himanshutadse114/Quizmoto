(function(){"use strict";const c=document.querySelector(".global-nav-menu-btn.w-nav-button"),s=document.querySelector(".global-nav-menu-icon"),r=document.querySelector(".nav-logo"),n=document.querySelector(".global-header-c"),a=document.querySelector(".btn-primary.nav-bar.w-button.secondary"),l=document.querySelector(".global-header-nav-w"),i=document.querySelectorAll(".global-nav-link"),d=document.querySelector(".navbar-scroll"),u=document.querySelector(".local-dropdown"),y=document.querySelector(".local-dropdown-c");
  const LOGO_BLACK="/branding/lmsgen-logo-light.png";
  const LOGO_WHITE="/branding/lmsgen-logo-dark.png";
  function headerIsLight(sticky){
    if(!n) return sticky;
    if(sticky) return true;
    if(n.classList.contains("white")||n.classList.contains("lemon")||n.classList.contains("turquoise")) return true;
    try{
      const bg=window.getComputedStyle(n).backgroundColor||"";
      const m=bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if(m){
        const R=Number(m[1]),G=Number(m[2]),B=Number(m[3]);
        return (0.299*R+0.587*G+0.114*B)/255>0.55;
      }
    }catch(e){}
    return false;
  }
  function setLogo(useBlack){
    if(!r) return;
    const next=useBlack?LOGO_BLACK:LOGO_WHITE;
    if(r.getAttribute("src")!==next) r.setAttribute("src", next);
    r.setAttribute("alt","LMSGEN");
  }
  function o(){
    if(!n){ setLogo(false); return; }
    const menuOpen=c&&c.classList.contains("w--open");
    const sticky=d? (window.scrollY>=d.offsetTop||menuOpen) : !!menuOpen;
    setLogo(headerIsLight(sticky));
    if(s) s.classList.toggle("sticky", sticky);
    if(r) r.classList.toggle("sticky", sticky);
    n.classList.toggle("sticky", sticky);
    if(a) a.classList.toggle("secondary", !sticky);
    if(l) l.classList.toggle("sticky", sticky);
    if(u) u.classList.toggle("sticky", sticky);
    if(y) y.classList.toggle("sticky", sticky);
    i.forEach(function(t){ t.classList.toggle("sticky", sticky); });
  }
  if(c) new MutationObserver(o).observe(c,{attributes:!0,attributeFilter:["class"]});
  window.addEventListener("scroll",o,{passive:true});
  o();
  const m=document.querySelectorAll('[cd="book-a-demo"]'),b=document.querySelectorAll('[cd="close-book"]');
  m.forEach(e=>{e.addEventListener("click",()=>{const el=document.querySelector(".book-demo-s"); if(el) el.classList.add("active")})});
  b.forEach(e=>{e.addEventListener("click",()=>{document.querySelectorAll(".book-demo-s.active").forEach(function(el){el.classList.remove("active")})})});
  const arrow=document.querySelector(".btn-primary.arrow");
  arrow&&arrow.addEventListener("click",()=>{const submit=document.querySelector(".btn-primary.submit");submit&&submit.click()});

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
  const ART_VER="?v=20260830c";
  const css=document.createElement("link");
  css.rel="stylesheet";
  css.href="/landing/css/lmsgen-advantage-assets.css"+ART_VER;
  document.head.appendChild(css);

  const art=[
    [".sl-hero-img", ART_BASE+"01-hero-course-studio.svg", "LMSGEN course studio — AI authoring, SCORM delivery and learner tracking"],
    ["#ai-course-authoring .sl-feat-common-img", ART_BASE+"02-ai-from-documents.svg", "LMSGEN turns documents into structured courses"],
    ["#scorm-ready-delivery .sl-feat-common-img", ART_BASE+"10-scorm-package.svg", "Publish in LMSGEN or export a SCORM package"],
    ["#quizmoto-engagement .sl-feat-common-img", ART_BASE+"11-quizmoto-live.svg", "Quizmoto live quiz — separate realtime feature"],
    ["#learning-analytics .sl-feat-common-img", ART_BASE+"04-tracking-dashboard.svg", "LMSGEN learner tracking dashboard"],
    ["#admin-access .sl-feat-common-img", ART_BASE+"12-admin-roles.svg", "Admin roles, approvals and access controls"],
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
    img.setAttribute("src", src+ART_VER);
    img.src = src+ART_VER;
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
  if(og) og.setAttribute("content", ART_BASE+"08-og-banner.svg"+ART_VER);

  const Q_HEAD = "Quizmoto — a separate live-quiz feature";
  const Q_BODY = "Quizmoto is a separate feature in your LMSGEN workspace. Conduct live quizzes where participants join with a code and play in realtime — it is not the SCORM course player.";
  const SCORM_HEAD = "SCORM-Ready Delivery";
  const SCORM_BODY = "LMSGEN has its own LMS — publish a course and start tracking learners right away. You can also export the course as SCORM and add it to your own LMS.";
  const section = document.querySelector("#quizmoto-engagement");
  if(section){
    const h = section.querySelector("h3");
    const p = section.querySelector("p");
    if(h) h.textContent = Q_HEAD;
    if(p) p.textContent = Q_BODY;
  }
  const scorm = document.querySelector("#scorm-ready-delivery");
  if(scorm){
    const h = scorm.querySelector("h3");
    const p = scorm.querySelector("p");
    if(h) h.textContent = SCORM_HEAD;
    if(p) p.textContent = SCORM_BODY;
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
    if(t === "Package and deliver standards-ready SCORM courses through any LMS in minutes."){
      el.textContent = SCORM_BODY;
    }
  });
})();
