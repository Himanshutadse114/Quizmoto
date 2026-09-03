(function () {
  "use strict";

  // Compatibility shim for older exported HTML that still references nav-menu.js.
  // All navigation behaviour now lives in lmsgen-nav.js. Never load page CSS or
  // remove page content from this compatibility entry point.
  if (document.querySelector('script[src*="lmsgen-nav.js"]')) return;

  const script = document.createElement("script");
  script.src = "/landing/js/lmsgen-nav.js?v=20260903a";
  script.defer = true;
  document.head.appendChild(script);
})();
