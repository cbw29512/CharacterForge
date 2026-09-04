import { api, messageFor } from './api.js';

export async function requireUser(identitySelector = '#identity') {
  try {
    const data = await api('/api/auth/me');
    const identity = document.querySelector(identitySelector);
    if (identity) identity.textContent = `${data.user.display_name || data.user.username} · ${data.user.role}`;
    return data.user;
  } catch (error) {
    if (error.status === 401) {
      location.replace('/login');
      return null;
    }
    throw error;
  }
}

export function wireLogout(buttonSelector = '#logout', statusSelector = '#status') {
  const button = document.querySelector(buttonSelector);
  if (!button) return;
  button.addEventListener('click', async () => {
    const status = document.querySelector(statusSelector);
    try {
      await api('/api/auth/logout', { method: 'POST', body: {}, csrf: true });
      location.replace('/login');
    } catch (error) {
      if (status) {
        status.className = 'status error';
        status.textContent = messageFor(error);
      }
    }
  });
}
