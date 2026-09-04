import { api, messageFor } from './api.js';
import { campaignCard, statCard, userCard } from './admin-cards.js';
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

async function loadAdmin() {
  showStatus('Loading administration data…');
  try {
    const data = await api('/api/admin/overview');
    stats.replaceChildren(
      statCard('Users', data.counts?.user_count),
      statCard('Campaigns', data.counts?.campaign_count),
      statCard('Characters', data.counts?.character_count),
    );
    const callbacks = { reload: loadAdmin, setStatus: showStatus };
    users.replaceChildren(...(data.users?.length
      ? data.users.map((user) => userCard(user, currentUser, callbacks))
      : [document.createTextNode('No users found.')]));
    campaigns.replaceChildren(...(data.campaigns?.length
      ? data.campaigns.map((campaign) => campaignCard(campaign, callbacks))
      : [document.createTextNode('No campaigns yet.')]));
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
