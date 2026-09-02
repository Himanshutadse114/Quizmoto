import axios from 'axios';

// The legacy campaign detail endpoint returns every learner-course registration.
// The current admin screens only need campaign metadata, learners, courses and a
// compact learner status. Rewrite those exact admin GETs to the lightweight read
// model while leaving analytics/access-sheet/public learner routes untouched.

let installed = false;

function rewriteCampaignDetail(url) {
  const value = String(url || '');
  const match = value.match(/^(.*\/api\/scorm\/campaigns\/[^/?#]+)([?#].*)?$/i);
  if (!match) return value;
  return `${match[1]}/manage${match[2] || ''}`;
}

export function installCampaignAdminReadRedirect() {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    if (String(config?.method || 'get').toLowerCase() !== 'get') return config;
    const auth = config?.headers?.Authorization || config?.headers?.authorization;
    if (!auth) return config;

    const nextUrl = rewriteCampaignDetail(config?.url);
    if (nextUrl !== config?.url) {
      return { ...config, url: nextUrl };
    }
    return config;
  });
}

installCampaignAdminReadRedirect();
