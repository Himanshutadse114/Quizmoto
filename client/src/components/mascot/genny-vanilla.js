// Static-page entry point. The React shell owns iframe instances.
import { createAvatar } from '@bible-strong/avatar-web';
import definition from './genny.avatar.json';
import mascotCss from './mascot.css';
import guideCss from './genny-guide.css';
import { mountGenny } from './genny-runtime.js';
import { mountSiteGuide } from './genny-site-guide.js';
import { GENNY_WEBSITE_TOPICS } from './genny-personas.js';
import { readMotionPreference } from './genny-motion.js';

if (window.self === window.top && !document.querySelector('.lmsgen-mascot')) {
  const style = document.createElement('style');
  style.id = 'genny-mascot-styles';
  style.textContent = mascotCss + guideCss;
  document.head.appendChild(style);
  let mascot;
  let guide;
  let hoverEnabled = true;
  let motionPreference = readMotionPreference(window);
  try { hoverEnabled = localStorage.getItem('lmsgen-genny-hover') !== 'off'; } catch { /* optional storage */ }
  const mountMascot = () => {
    mascot?.destroy();
    mascot = mountGenny({ document, createAvatar, definition, topics: GENNY_WEBSITE_TOPICS, hoverEnabled, motionPreference, onActivate: () => guide.open(), onTopic: (topic) => guide.select(topic) });
    document.querySelector('.lmsgen-mascot')?.classList.add('lmsgen-mascot-site');
    mascot.bindDocument(document);
  };
  const mount = () => {
    guide = mountSiteGuide(document, {
      onOpen: () => {
        if (!document.querySelector('.lmsgen-mascot')) {
          try { sessionStorage.removeItem('lmsgen-mascot-dismissed'); } catch { /* optional storage */ }
          mountMascot();
        }
      },
      onHoverChange: (enabled) => { hoverEnabled = enabled; mountMascot(); },
      onMotionChange: (preference) => { motionPreference = preference; mountMascot(); },
    });
    mountMascot();
  };
  mount();
  window.addEventListener('pagehide', () => { mascot.destroy(); guide.destroy(); });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    mount();
  });
}
