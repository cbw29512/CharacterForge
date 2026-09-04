const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split(';')) {
    const value = part.trim();
    if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return '';
}

async function parseResponse(response) {
  const type = response.headers.get('content-type') || '';
  const body = type.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(body?.error || `request_failed_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie('__Host-cf_csrf');
    if (csrf) headers.set('x-csrf-token', csrf);
  }
  let body = options.body;
  if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(body);
  }
  const response = await fetch(path, {
    ...options,
    method,
    headers,
    body,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  return parseResponse(response);
}

export const authApi = {
  setupStatus: () => api('/api/auth/setup'),
  setup: (payload) => api('/api/auth/setup', { method: 'POST', body: payload }),
  login: (payload) => api('/api/auth/login', { method: 'POST', body: payload }),
  me: () => api('/api/auth/me'),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
};

export const campaignApi = {
  list: () => api('/api/campaigns'),
  create: (payload) => api('/api/campaigns', { method: 'POST', body: payload }),
};

export const characterApi = {
  get: (id) => api(`/api/characters?id=${encodeURIComponent(id)}`),
  create: (payload) => api('/api/characters/create', { method: 'POST', body: payload }),
  remove: (id) => api('/api/characters/delete', { method: 'POST', body: { id } }),
};

export const templateApi = {
  list: (npc = false) => api(`/api/templates?npc=${npc ? 'true' : 'false'}`),
  save: (characterId, payload) => api('/api/templates/save', { method: 'POST', body: { character_id: characterId, ...payload } }),
  use: (id) => api('/api/templates/use', { method: 'POST', body: { id } }),
  remove: (id) => api('/api/templates/delete', { method: 'POST', body: { id } }),
};
