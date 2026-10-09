// Static-page entry point. The React shell owns iframe instances.
import { createAvatar } from '@bible-strong/avatar-web';
import definition from './genny.avatar.json';
import mascotCss from './mascot.css';
import { mountGenny } from './genny-runtime.js';

if (window.self === window.top && !document.querySelector('.lmsgen-mascot')) {
  const style = document.createElement('style');
  style.id = 'genny-mascot-styles';
  style.textContent = mascotCss;
  document.head.appendChild(style);
  let mascot = mountGenny({ document, createAvatar, definition });
  mascot.bindDocument(document);
  window.addEventListener('pagehide', () => mascot.destroy());
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    mascot = mountGenny({ document, createAvatar, definition });
    mascot.bindDocument(document);
  });
}
