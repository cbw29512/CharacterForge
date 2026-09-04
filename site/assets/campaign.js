import { api, messageFor } from './api.js';
import { requireUser, wireLogout } from './session.js';

const status = document.querySelector('#status');
const campaignTitle = document.querySelector('#campaign-title');
const campaignDescription = document.querySelector('#campaign-description');
const pcs = document.querySelector('#pcs');
const npcs = document.querySelector('#npcs');
const members = document.querySelector('#members');
const pending = document.querySelector('#pending');
const params = new URLSearchParams(location.search);
const campaignId = Number(params.get('id'));
let campaignData = null;

function showStatus(text, type = '') {
  status.className = `status ${type}`.trim();
  status.textContent = text;
}

function emptyMessage(text) {
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = text;
  return p;
}

function characterCard(character) {
  const article = document.createElement('article');
  article.className = 'campaign';
  const heading = document.createElement('h3');
  heading.textContent = character.name;
  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = `Level ${character.level} ${character.race || ''} ${character.char_class || ''}`.replace(/\s+/g, ' ').trim();
  const stats = document.createElement('p');
  stats.textContent = `AC ${character.armor_class} · HP ${character.current_hp}/${character.max_hp}`;
  article.append(heading, meta, stats);
  return article;
}

function memberCard(member, { pendingRequest = false } = {}) {
  const article = document.createElement('article');
  article.className = 'member-row';
  const info = document.createElement('div');
  const heading = document.createElement('strong');
  heading.textContent = member.display_name || member.username;
  const meta = document.createElement('span');
  meta.className = 'muted';
  meta.textContent = ` ${member.username} · ${member.user_role}`;
  info.append(heading, meta);
  article.append(info);

  const actions = document.createElement('div');
  actions.className = 'actions';
  if (pendingRequest) {
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'btn primary';
    approve.textContent = 'Approve';
    approve.addEventListener('click', () => manageMember('/api/campaigns/approve', member.user_id));
    actions.append(approve);
  }
  if (member.membership_role !== 'dm') {
    const kick = document.createElement('button');
    kick.type = 'button';
    kick.className = 'btn danger';
    kick.textContent = pendingRequest ? 'Reject' : 'Remove';
    kick.addEventListener('click', () => manageMember('/api/campaigns/kick', member.user_id));
    actions.append(kick);
  }
  article.append(actions);
  return article;
}

async function manageMember(path, userId) {
  try {
    await api(path, { method: 'POST', body: { campaign_id: campaignId, user_id: userId }, csrf: true });
    await loadCampaign();
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
}

function render(data) {
  campaignData = data;
  campaignTitle.textContent = data.campaign.name;
  campaignDescription.textContent = data.campaign.description || 'No description.';
  pcs.replaceChildren(...(data.pc_characters.length ? data.pc_characters.map(characterCard) : [emptyMessage('No player characters yet.') ]));
  npcs.replaceChildren(...(data.npc_characters.length ? data.npc_characters.map(characterCard) : [emptyMessage('No NPCs yet.') ]));

  const management = document.querySelector('#management');
  const managerActions = document.querySelector('#manager-actions');
  management.hidden = !data.is_dm;
  managerActions.hidden = !data.is_dm;
  if (data.is_dm) {
    pending.replaceChildren(...(data.pending.length ? data.pending.map((row) => memberCard(row, { pendingRequest: true })) : [emptyMessage('No pending requests.') ]));
    members.replaceChildren(...(data.members.length ? data.members.map((row) => memberCard(row)) : [emptyMessage('No approved members.') ]));
  }
}

async function loadCampaign() {
  if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
    showStatus('Invalid campaign link.', 'error');
    return;
  }
  showStatus('Loading campaign…');
  try {
    const data = await api(`/api/campaigns/view?id=${encodeURIComponent(campaignId)}`);
    render(data);
    showStatus('');
  } catch (error) {
    if (error.status === 401) return location.replace('/login');
    if (error.status === 403 || error.status === 404) {
      showStatus('This campaign is unavailable to your account.', 'error');
      return;
    }
    showStatus(messageFor(error), 'error');
  }
}

document.querySelector('#delete-campaign').addEventListener('click', async () => {
  if (!campaignData?.is_dm) return;
  if (!confirm(`Delete ${campaignData.campaign.name}? This also removes its campaign characters and memberships.`)) return;
  try {
    await api('/api/campaigns/delete', { method: 'POST', body: { campaign_id: campaignId }, csrf: true });
    location.assign('/app');
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
});

wireLogout();
(async function boot() {
  try {
    const user = await requireUser();
    if (user) await loadCampaign();
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
})();
