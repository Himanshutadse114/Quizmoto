import { useLayoutEffect } from 'react';

const BRAND_REPLACEMENTS = [
  [/\bAtelora\b/g, 'LMSGEN'],
  [/\bATELORA\b/g, 'LMSGEN'],
];

const BRAND_LOGO_LIGHT = '/branding/lmsgen-logo-light.webp';
const BRAND_LOGO_DARK = '/branding/lmsgen-logo-dark.webp';
const LEGACY_LOGO_SUFFIX = '/atelora-logo.svg';

const TEXT_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE']);
const BRAND_ATTRIBUTES = ['alt', 'title', 'aria-label', 'placeholder', 'content'];

function replaceBrand(value) {
  if (!value || typeof value !== 'string') return value;
  return BRAND_REPLACEMENTS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value);
}

function rewriteLegacyBrandHref(element) {
  if (!(element instanceof HTMLAnchorElement)) return;
  const rawHref = element.getAttribute('href');
  if (!rawHref || !rawHref.startsWith('/atelora')) return;
  element.setAttribute('href', rawHref.replace(/^\/atelora/, '/lmsgen'));
}

function brandLogoImage(element) {
  if (!(element instanceof HTMLImageElement)) return;

  const rawSrc = element.getAttribute('src') || '';
  const isKnownBrandLogo =
    element.dataset.lmsgenBrandLogo === '1' ||
    rawSrc.endsWith(LEGACY_LOGO_SUFFIX) ||
    rawSrc === BRAND_LOGO_LIGHT ||
    rawSrc === BRAND_LOGO_DARK;

  if (!isKnownBrandLogo) return;

  element.dataset.lmsgenBrandLogo = '1';
  element.alt = 'LMSGEN';

  const lightTheme = Boolean(element.closest('.scorm-theme-light'));
  const nextSrc = lightTheme ? BRAND_LOGO_LIGHT : BRAND_LOGO_DARK;
  if (rawSrc !== nextSrc) element.setAttribute('src', nextSrc);
}

function refreshBrandLogos() {
  document
    .querySelectorAll(
      `img[data-lmsgen-brand-logo="1"], img[src$="${LEGACY_LOGO_SUFFIX}"], img[src="${BRAND_LOGO_LIGHT}"], img[src="${BRAND_LOGO_DARK}"]`,
    )
    .forEach(brandLogoImage);
}

function brandElement(element) {
  if (!(element instanceof Element)) return;

  for (const attribute of BRAND_ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) continue;
    const current = element.getAttribute(attribute);
    const next = replaceBrand(current);
    if (next !== current) element.setAttribute(attribute, next);
  }

  rewriteLegacyBrandHref(element);
  brandLogoImage(element);
}

function brandSubtree(root) {
  if (!root) return;

  if (root.nodeType === Node.TEXT_NODE) {
    const parentTag = root.parentElement?.tagName;
    if (!parentTag || TEXT_SKIP_TAGS.has(parentTag)) return;
    const current = root.nodeValue || '';
    const next = replaceBrand(current);
    if (next !== current) root.nodeValue = next;
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

  if (root instanceof Element) brandElement(root);

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );

  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parentTag = node.parentElement?.tagName;
      if (!parentTag || !TEXT_SKIP_TAGS.has(parentTag)) {
        const current = node.nodeValue || '';
        const next = replaceBrand(current);
        if (next !== current) node.nodeValue = next;
      }
    } else if (node instanceof Element) {
      brandElement(node);
    }
    node = walker.nextNode();
  }
}

function brandDocumentMetadata() {
  document.title = replaceBrand(document.title);
  document.querySelectorAll('meta[content]').forEach(brandElement);
}

export default function BrandRuntime() {
  useLayoutEffect(() => {
    brandDocumentMetadata();
    brandSubtree(document.body);
    refreshBrandLogos();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          brandSubtree(mutation.target);
          continue;
        }

        if (mutation.type === 'attributes') {
          brandElement(mutation.target);
          continue;
        }

        mutation.addedNodes.forEach(brandSubtree);
      }
      brandDocumentMetadata();
      refreshBrandLogos();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...BRAND_ATTRIBUTES, 'href', 'src', 'class'],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
