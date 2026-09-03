import axios from 'axios';

let installed = false;

function stripInternalDirection(value) {
  const text = String(value || '');
  const marker = /\n\nInstructional design direction:\s*/i;
  const match = marker.exec(text);
  if (!match) return text;
  return text.slice(0, match.index).trim();
}

export function installCourseAuthorPayloadSanitizer() {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    try {
      const url = String(config?.url || '');
      if (!url.includes('/api/scorm/author/')) return config;
      const body = config?.data;
      if (!body || typeof body !== 'object' || Array.isArray(body)) return config;
      if (!Object.prototype.hasOwnProperty.call(body, 'description')) return config;

      config.data = {
        ...body,
        description: stripInternalDirection(body.description)
      };
    } catch (_) {}
    return config;
  });
}

installCourseAuthorPayloadSanitizer();
