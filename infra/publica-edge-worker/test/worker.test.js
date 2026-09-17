import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyHostname, proxyRequest, upstreamUrlFor } from '../src/index.js';

const env = {
  ROOT_DOMAIN: 'lmsgen.in',
  FRONTEND_ORIGIN: 'https://frontend.example.onrender.com',
  API_ORIGIN: 'https://backend.example.onrender.com'
};

test('routes a customer Publica subdomain to the frontend origin', () => {
  const route = upstreamUrlFor('https://acme.lmsgen.in/publica/security-guide?reader=1', env);
  assert.equal(route.kind, 'publica');
  assert.equal(route.upstream.toString(), 'https://frontend.example.onrender.com/publica/security-guide?reader=1');
});

test('keeps the API hostname on the backend origin if the wildcard route receives it', () => {
  const route = upstreamUrlFor('https://api.lmsgen.in/api/health', env);
  assert.equal(route.kind, 'api');
  assert.equal(route.upstream.toString(), 'https://backend.example.onrender.com/api/health');
});

test('rejects reserved and nested subdomains', () => {
  assert.equal(classifyHostname('admin.lmsgen.in'), null);
  assert.equal(classifyHostname('nested.acme.lmsgen.in'), null);
});

test('preserves the public hostname and rewrites same-origin redirects', async () => {
  let received;
  const response = await proxyRequest(
    new Request('https://acme.lmsgen.in/publica/guide'),
    env,
    async (request) => {
      received = request;
      return new Response(null, {
        status: 302,
        headers: { location: 'https://frontend.example.onrender.com/login' }
      });
    }
  );

  assert.equal(received.url, 'https://frontend.example.onrender.com/publica/guide');
  assert.equal(received.headers.get('x-forwarded-host'), 'acme.lmsgen.in');
  assert.equal(response.headers.get('location'), 'https://acme.lmsgen.in/login');
  assert.equal(response.headers.get('x-lmsgen-edge'), 'publica');
});
