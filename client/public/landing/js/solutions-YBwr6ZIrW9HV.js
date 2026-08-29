(function(){"use strict";const c=document.querySelector(".global-nav-menu-btn.w-nav-button"),s=document.querySelector(".global-nav-menu-icon"),r=document.querySelector(".nav-logo"),n=document.querySelector(".global-header-c"),a=document.querySelector(".btn-primary.nav-bar.w-button.secondary"),l=document.querySelector(".global-header-nav-w"),i=document.querySelectorAll(".global-nav-link"),d=document.querySelector(".navbar-scroll"),u=document.querySelector(".local-dropdown"),y=document.querySelector(".local-dropdown-c");function o(){if(!d)return;const e=d.offsetTop;window.scrollY>=e||c.classList.contains("w--open")?(s.classList.add("sticky"),r.classList.add("sticky"),n.classList.add("sticky"),a.classList.remove("secondary"),l.classList.add("sticky"),u.classList.add("sticky"),y.classList.add("sticky"),i.forEach(function(t){t.classList.add("sticky")})):(s.classList.remove("sticky"),r.classList.remove("sticky"),n.classList.remove("sticky"),a.classList.add("secondary"),l.classList.remove("sticky"),u.classList.remove("sticky"),y.classList.remove("sticky"),i.forEach(function(t){t.classList.remove("sticky")}))}new MutationObserver(o).observe(c,{attributes:!0,attributeFilter:["class"]}),window.addEventListener("scroll",o),o();const m=document.querySelectorAll('[cd="book-a-demo"]'),b=document.querySelectorAll('[cd="close-book"]');m.forEach(e=>{e.addEventListener("click",()=>{document.querySelector(".book-demo-s").classList.add("active")})}),b.forEach(e=>{e.addEventListener("click",()=>{document.querySelector(".book-demo-s").classList.remove("active")})});const arrow=document.querySelector(".btn-primary.arrow");arrow&&arrow.addEventListener("click",()=>{const submit=document.querySelector(".btn-primary.submit");submit&&submit.click()});

  const css=document.createElement("link");
  css.rel="stylesheet";
  css.href="../css/lmsgen-advantage-assets.css";
  document.head.appendChild(css);

  const art=[
    [".sl-hero-img","../images/lmsgen/01-hero-course-studio.svg","LMSGEN course studio — AI authoring, SCORM delivery and learner tracking"],
    ["#ai-human-control .sl-featkey-card-img img","../images/lmsgen/03-course-editor.svg","LMSGEN course editor"],
    [".sl-features-key-cards-c .sl-features-key-card-w:nth-child(2) .sl-featkey-card-img img","../images/lmsgen/05-share-link-mobile.svg","Share a course link from mobile"],
    [".sl-features-key-cards-c .sl-features-key-card-w:nth-child(3) .sl-featkey-card-img img","../images/lmsgen/07-safety-audience.svg","LMSGEN for security-awareness and workplace teams"],
    [".sl-features-key-banner-img-w img","../images/lmsgen/06-how-it-works-steps.svg","LMSGEN how it works — draft, edit, publish and track"],
    ["#ai-course-authoring .sl-feat-common-img","../images/lmsgen/02-ai-from-documents.svg","LMSGEN turns documents into structured courses"],
    ["#scorm-ready-delivery .sl-feat-common-img","../images/lmsgen/03-course-editor.svg","LMSGEN SCORM-ready course editor"],
    ["#quizmoto-engagement .sl-feat-common-img","../images/lmsgen/05-share-link-mobile.svg","Share live Quizmoto and course links"],
    ["#learning-analytics .sl-feat-common-img","../images/lmsgen/04-tracking-dashboard.svg","LMSGEN learner tracking dashboard"],
    ["#admin-access .sl-feat-common-img","../images/lmsgen/07-safety-audience.svg","Admin and audience access controls"],
    [".sl-feat-templ-cards-c .sl-features-key-card-w:nth-child(1) .sl-featkey-card-img img","../images/lmsgen/02-ai-from-documents.svg","Create on-brand courses from source documents"],
    [".sl-feat-templ-cards-c .sl-features-key-card-w:nth-child(2) .sl-featkey-card-img img","../images/lmsgen/01-hero-course-studio.svg","LMSGEN course studio at scale"],
    [".nsl-local-graph-cards-row .nsl-local-graph-card:nth-child(1) .nsl-local-graph-card-img-c img","../images/lmsgen/03-course-editor.svg","Self-paced course template"],
    [".nsl-local-graph-cards-row .nsl-local-graph-card:nth-child(2) .nsl-local-graph-card-img-c img","../images/lmsgen/05-share-link-mobile.svg","Bulk-assign a course from a share link"],
    [".nsl-local-graph-card.parallel .nsl-local-graph-card-img-c img","../images/lmsgen/06-how-it-works-steps.svg","Personalized learning paths"],
    ["#learner-management .sl-feat-common-img","../images/lmsgen/04-tracking-dashboard.svg","Learner access and reporting dashboard"]
  ];
  art.forEach(function(item){
    document.querySelectorAll(item[0]).forEach(function(img){
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.src=item[1];
      if(item[2]) img.alt=item[2];
    });
  });
  const og=document.querySelector('meta[property="og:image"]');
  if(og) og.setAttribute("content","../images/lmsgen/08-og-banner.svg");
})();
