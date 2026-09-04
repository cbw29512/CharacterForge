import { api, messageFor } from './api.js';
import { requireUser, wireLogout } from './session.js';

const status = document.querySelector('#status');
const stats = document.querySelector('#admin-stats');
const users = document.querySelector('#admin-users');
const campaigns = document.querySelector('#admin-campaigns');
let currentUser = null;

function showStatus(text, type = '') {
  status.className = `status ${type}`.trim();
  status.textContent = text;
}

function statCard(label, value) {
  const card = document.createElement('div');
  card.className = 'stat-card';
  const strong = document.createElement('strong');
  strong.textContent = String(value ?? 0);
  const span = document.createElement('span');
  span.textContent = label;
  card.append(strong, span);
  return card;
}

function makeButton(text, className = 'btn') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  return button;
}

function userCard(user) {
  const article = document.createElement('article');
  article.className = 'campaign';
  const heading = document.createElement('h3');
  heading.textContent = user.display_name || user.username;
  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = `@${user.username} · ${user.role}${user.id === currentUser.id ? ' · current account' : ''}`;

  const roleForm = document.createElement('form');
  roleForm.className = 'admin-inline-form';
  const roleLabel = document.createElement('label');
  roleLabel.textContent = 'Role';
  const roleSelect = document.createElement('select');
  roleSelect.name = 'role';
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
      showStatus(`Role updated for ${user.username}.`, 'ok');
      await loadAdmin();
    } catch (error) { showStatus(messageFor(error), 'error'); }
  });

  const passwordForm = document.createElement('form');
  passwordForm.className = 'admin-inline-form';
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
      showStatus(`Password reset for ${user.username}; active sessions revoked.`, 'ok');
    } catch (error) { showStatus(messageFor(error), 'error'); }
  });

  const actions = document.createElement('div');
  actions.className = 'actions';
  if (user.id !== currentUser.id) {
    const remove = makeButton('Delete user', 'btn danger');
    remove.addEventListener('click', async () => {
      if (!confirm(`Delete user ${user.username}? This cannot be undone.`)) return;
      try {
        await api('/api/admin/users/delete', { method: 'POST', body: { user_id: user.id }, csrf: true });
        showStatus(`User ${user.username} deleted.`, 'ok');
        await loadAdmin();
      } catch (error) { showStatus(messageFor(error), 'error'); }
    });
    actions.append(remove);
  }
  article.append(heading, meta, roleForm, passwordForm, actions);
  return article;
}

function campaignCard(campaign) {
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
      showStatus(`Campaign ${campaign.name} deleted.`, 'ok');
      await loadAdmin();
    } catch (error) { showStatus(messageFor(error), 'error'); }
  });
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(open, remove);
  article.append(heading, meta, actions);
  return article;
}

async function loadAdmin() {
  showStatus('Loading administration data…');
  try {
    const data = await api('/api/admin/overview');
    stats.replaceChildren(
      statCard('Users', data.counts?.user_count),
      statCard('Campaigns', data.counts?.campaign_count),
      statCard('Characters', data.counts?.character_count),
    );
    users.replaceChildren(...(data.users?.length ? data.users.map(userCard) : [document.createTextNode('No users found.') ]));
    campaigns.replaceChildren(...(data.campaigns?.length ? data.campaigns.map(campaignCard) : [document.createTextNode('No campaigns yet.') ]));
    showStatus('');
  } catch (error) {
    if (error.status === 401) return location.replace('/login');
    if (error.status === 403) return location.replace('/app');
    showStatus(messageFor(error), 'error');
  }
}

document.querySelector('#create-user').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    await api('/api/admin/users/create', {
      method: 'POST',
      body: {
        username: data.get('username'),
        display_name: data.get('display_name'),
        password: data.get('password'),
        role: data.get('role'),
      },
      csrf: true,
    });
    form.reset();
    showStatus('User created.', 'ok');
    await loadAdmin();
  } catch (error) { showStatus(messageFor(error), 'error'); }
});

document.querySelector('#refresh-users').addEventListener('click', loadAdmin);
wireLogout();

(async function boot() {
  try {
    currentUser = await requireUser();
    if (!currentUser) return;
    if (currentUser.role !== 'admin') return location.replace('/app');
    await loadAdmin();
  } catch (error) { showStatus(messageFor(error), 'error'); }
})();
