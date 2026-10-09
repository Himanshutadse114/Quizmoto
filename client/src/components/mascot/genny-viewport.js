// Keep fixed help inside the visible screen when the keyboard/address bar moves.
// Shared by the platform and static website; no device sniffing or page scaling.
export function watchGuideViewport(panel) {
  const win = panel.ownerDocument.defaultView;
  const viewport = win.visualViewport;
  const update = () => {
    const height = viewport?.height || win.innerHeight;
    const bottom = Math.max(0, win.innerHeight - height - (viewport?.offsetTop || 0));
    panel.style.setProperty('--genny-visible-height', `${height}px`);
    panel.style.setProperty('--genny-visible-bottom', `${bottom}px`);
    panel.dataset.gennyKeyboard = String(bottom > 100 && (viewport?.scale || 1) === 1);
  };
  update();
  win.addEventListener('resize', update);
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  return () => {
    win.removeEventListener('resize', update);
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
  };
}
