import { api, messageFor } from './api.js';

function makeButton(text, className = 'btn') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  return button;
}

export function statCard(label, value) {
  const card = document.createElement('div');
  card.className = 'stat-card';
  const strong = document.createElement('strong');
  strong.textContent = String(value ?? 0);
  const span = document.createElement('span');
  span.textContent = label;
  card.append(strong, span);
  return card;
}

export function userCard(user, currentUser, { reload, setStatus }) {
  const article = document.createElement('article');
  article.className = 'campaign';
  const heading = document.createElement('h3');
  heading.textContent = user.display_name || user.username;
  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = `@${user.username} · ${user.role}${user.id === currentUser.id ? ' · current account' : ''}`;

  const roleForm = document.createElement('form');
  const roleLabel = document.createElement('label');
  roleLabel.textContent = 'Role';
  const roleSelect = document.createElement('select');
  for (const [value, label] of [['player', 'Player'], ['dm', 'Dungeon Master'], ['admin', 'Admin']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = user.role === value;
    roleSelect.append(option);
  }
  roleLabel.append(roleSelect);
  const saveRole = document.createElement('button');
  saveRole.className = 'btn';
  saveRole.type = 'submit';
  saveRole.textContent = 'Save role';
  roleForm.append(roleLabel, saveRole);
  roleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/admin/users/role', { method: 'POST', body: { user_id: user.id, role: roleSelect.value }, csrf: true });
      setStatus(`Role updated for ${user.username}.`, 'ok');
      await reload();
    } catch (error) { setStatus(messageFor(error), 'error'); }
  });

  const passwordForm = document.createElement('form');
  const passwordLabel = document.createElement('label');
  passwordLabel.textContent = 'New password';
  const password = document.createElement('input');
  password.type = 'password';
  password.autocomplete = 'new-password';
  password.minLength = 12;
  password.required = true;
  passwordLabel.append(password);
  const reset = document.createElement('button');
  reset.className = 'btn';
  reset.type = 'submit';
  reset.textContent = 'Reset password';
  passwordForm.append(passwordLabel, reset);
  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!confirm(`Reset password for ${user.username}? All active sessions for this user will be revoked.`)) return;
    try {
      await api('/api/admin/users/password', { method: 'POST', body: { user_id: user.id, password: password.value }, csrf: true });
      password.value = '';
      if (user.id === currentUser.id) return location.replace('/login');
      setStatus(`Password reset for ${user.username}; active sessions revoked.`, 'ok');
    } catch (error) { setStatus(messageFor(error), 'error'); }
  });

  const actions = document.createElement('div');
  actions.className = 'actions';
  if (user.id !== currentUser.id) {
    const remove = makeButton('Delete user', 'btn danger');
    remove.addEventListener('click', async () => {
      if (!confirm(`Delete user ${user.username}? This cannot be undone.`)) return;
      try {
        await api('/api/admin/users/delete', { method: 'POST', body: { user_id: user.id }, csrf: true });
        setStatus(`User ${user.username} deleted.`, 'ok');
        await reload();
      } catch (error) { setStatus(messageFor(error), 'error'); }
    });
    actions.append(remove);
  }
  article.append(heading, meta, roleForm, passwordForm, actions);
  return article;
}

export function campaignCard(campaign, { reload, setStatus }) {
  const article = document.createElement('article');
  article.className = 'campaign';
  const heading = document.createElement('h3');
  heading.textContent = campaign.name;
  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = `DM: ${campaign.dm_name || 'Unknown'}`;
  const open = document.createElement('a');
  open.className = 'btn';
  open.href = `/campaign?id=${encodeURIComponent(campaign.id)}`;
  open.textContent = 'Open campaign';
  const remove = makeButton('Delete campaign', 'btn danger');
  remove.addEventListener('click', async () => {
    if (!confirm(`Delete campaign ${campaign.name}? Campaign characters and memberships will also be deleted.`)) return;
    try {
      await api('/api/campaigns/delete', { method: 'POST', body: { campaign_id: campaign.id }, csrf: true });
      setStatus(`Campaign ${campaign.name} deleted.`, 'ok');
      await reload();
    } catch (error) { setStatus(messageFor(error), 'error'); }
  });
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(open, remove);
  article.append(heading, meta, actions);
  return article;
}
