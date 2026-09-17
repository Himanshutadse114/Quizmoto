const RESERVED_HOSTS = new Set([
  'admin', 'app', 'assets', 'auth', 'blog', 'cdn', 'contact', 'help',
  'login', 'mail', 'smtp', 'static', 'status', 'support'
]);

function cleanOrigin(value, fallback) {
  return String(value || fallback).trim().replace(/\/+$/, '');
}

export function classifyHostname(hostname, rootDomain = 'lmsgen.in') {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  const root = String(rootDomain || 'lmsgen.in').trim().toLowerCase().replace(/^\.+|\.+$/g, '');

  if (host === root || host === `www.${root}`) return 'frontend';
  if (host === `api.${root}`) return 'api';
  if (!host.endsWith(`.${root}`)) return null;

  const subdomain = host.slice(0, -(root.length + 1));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subdomain)) return null;
  if (RESERVED_HOSTS.has(subdomain)) return null;
  return 'publica';
}

export function upstreamUrlFor(requestUrl, env = {}) {
  const incoming = new URL(requestUrl);
  const kind = classifyHostname(incoming.hostname, env.ROOT_DOMAIN);
  if (!kind) return null;

  const origin = kind === 'api'
    ? cleanOrigin(env.API_ORIGIN, 'https://kahoot-awareness-backend.onrender.com')
    : cleanOrigin(env.FRONTEND_ORIGIN, 'https://kahoot-awareness-frontend.onrender.com');
  const upstream = new URL(`${incoming.pathname}${incoming.search}`, origin);
  return { kind, origin, incoming, upstream };
}

function rewriteLocation(location, route) {
  if (!location) return location;
  try {
    const redirected = new URL(location, route.origin);
    const origin = new URL(route.origin);
    if (redirected.origin !== origin.origin) return location;
    redirected.protocol = route.incoming.protocol;
    redirected.host = route.incoming.host;
    return redirected.toString();
  } catch (_) {
    return location;
  }
}

export async function proxyRequest(request, env = {}, fetcher = fetch) {
  const route = upstreamUrlFor(request.url, env);
  if (!route) {
    return new Response('Unknown LMSGEN subdomain.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  const headers = new Headers(request.headers);
  headers.set('x-forwarded-host', route.incoming.host);
  headers.set('x-forwarded-proto', route.incoming.protocol.replace(':', ''));
  headers.set('x-lmsgen-public-host', route.incoming.host);

  const upstreamRequest = new Request(route.upstream, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual'
  });
  const upstreamResponse = await fetcher(upstreamRequest);
  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.set('x-lmsgen-edge', route.kind);

  const location = responseHeaders.get('location');
  if (location) responseHeaders.set('location', rewriteLocation(location, route));

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}

export default {
  fetch(request, env) {
    return proxyRequest(request, env);
  }
};
