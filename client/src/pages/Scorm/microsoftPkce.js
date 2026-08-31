const SCOPES = 'openid profile email';

function base64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomValue(size = 48) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token || '').split('.')[1] || '';
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch (_) {
    return null;
  }
}

export function formatMicrosoftAuthError(message, redirectUri = '') {
  const raw = String(message || '').trim();
  if (!raw) return 'Microsoft could not complete sign-in.';

  if (raw.includes('AADSTS9002326')) {
    const uriHelp = redirectUri ? ` Add this exact redirect URI under the Single-page application (SPA) platform: ${redirectUri}.` : '';
    return `Microsoft Entra is treating this application as a Web client, but LMSGEN uses the secure SPA authorization-code + PKCE flow.${uriHelp} In Microsoft Entra, open App registrations → your application → Authentication → Add a platform → Single-page application (SPA). If this callback exists only under Web, move or add it under SPA and try again. You do not need to enable the legacy implicit ID-token grant.`;
  }

  if (raw.includes('AADSTS700054')) {
    return 'This Microsoft application is configured for the legacy implicit flow. LMSGEN now uses authorization-code + PKCE. Register the LMSGEN callback URL under Microsoft Entra → App registrations → Authentication → Single-page application (SPA), then try again.';
  }

  return raw;
}

export async function createMicrosoftPkceRequest({ clientId, tenantId, redirectUri }) {
  if (!clientId || !tenantId || !redirectUri) throw new Error('Microsoft SSO configuration is incomplete.');
  if (!globalThis.crypto?.subtle) throw new Error('This browser does not support secure Microsoft sign-in.');

  const verifier = randomValue(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(digest));
  const state = crypto.randomUUID?.() || randomValue(24);
  const nonce = crypto.randomUUID?.() || randomValue(24);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account'
  });

  return {
    state,
    nonce,
    verifier,
    clientId,
    tenantId,
    redirectUri,
    authorizeUrl: `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize?${params.toString()}`
  };
}

export function readMicrosoftCallbackParams() {
  const search = new URLSearchParams(window.location.search || '');
  const hash = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
  const providerError = search.get('error_description') || hash.get('error_description') || search.get('error') || hash.get('error') || '';
  return {
    code: search.get('code') || hash.get('code') || '',
    state: search.get('state') || hash.get('state') || '',
    idToken: search.get('id_token') || hash.get('id_token') || '',
    error: providerError ? formatMicrosoftAuthError(providerError) : ''
  };
}

export async function exchangeMicrosoftCode({ code, clientId, tenantId, redirectUri, verifier, nonce }) {
  if (!code || !clientId || !tenantId || !redirectUri || !verifier) {
    throw new Error('Microsoft sign-in session is incomplete. Please start sign-in again.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    scope: SCOPES
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatMicrosoftAuthError(data.error_description || data.error || 'Microsoft could not complete sign-in.', redirectUri));
  }
  if (!data.id_token) throw new Error('Microsoft did not return an identity token.');

  if (nonce) {
    const payload = decodeJwtPayload(data.id_token);
    if (!payload?.nonce || payload.nonce !== nonce) {
      throw new Error('Microsoft sign-in nonce did not match. Please start sign-in again.');
    }
  }
  return data.id_token;
}
