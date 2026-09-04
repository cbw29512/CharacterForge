import { api, messageFor } from './api.js';
import { requireUser, wireLogout } from './session.js';

const status = document.querySelector('#status');
const campaigns = document.querySelector('#campaigns');
const browseCampaigns = document.querySelector('#browse-campaigns');
let currentUser = null;

function showStatus(text, type = '') {
  status.className = `status ${type}`.trim();
  status.textContent = text;
}

function campaignCard(campaign, { join = false } = {}) {
  const article = document.createElement('article');
  article.className = 'campaign';
  const heading = document.createElement('h3');
  heading.textContent = campaign.name;
  const description = document.createElement('p');
  description.className = 'muted';
  description.textContent = campaign.description || 'No description.';
  article.append(heading, description);

  if (join) {
    const button = document.createElement('button');
    button.className = 'btn';
    button.type = 'button';
    button.textContent = 'Request to join';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await api('/api/campaigns/join', { method: 'POST', body: { campaign_id: campaign.id }, csrf: true });
        showStatus(`Join request sent for ${campaign.name}.`, 'ok');
        await loadBrowse();
      } catch (error) {
        button.disabled = false;
        showStatus(messageFor(error), 'error');
      }
    });
    article.append(button);
  } else {
    const link = document.createElement('a');
    link.className = 'btn';
    link.href = `/campaign?id=${encodeURIComponent(campaign.id)}`;
    link.textContent = 'Open campaign';
    article.append(link);
  }
  return article;
}

async function loadCampaigns() {
  showStatus('Loading campaigns…');
  try {
    const data = await api('/api/campaigns');
    campaigns.replaceChildren();
    if (!data.campaigns?.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No campaigns are visible to this account yet.';
      campaigns.append(p);
    } else {
      for (const campaign of data.campaigns) campaigns.append(campaignCard(campaign));
    }
    showStatus('');
  } catch (error) {
    if (error.status === 401) return location.replace('/login');
    showStatus(messageFor(error), 'error');
  }
}

async function loadBrowse() {
  if (currentUser?.role !== 'player') return;
  try {
    const data = await api('/api/campaigns/browse');
    browseCampaigns.replaceChildren();
    if (!data.campaigns?.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No additional active campaigns are available.';
      browseCampaigns.append(p);
      return;
    }
    for (const campaign of data.campaigns) browseCampaigns.append(campaignCard(campaign, { join: true }));
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
}

document.querySelector('#create-campaign').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    const result = await api('/api/campaigns', {
      method: 'POST',
      body: { name: data.get('name'), description: data.get('description') },
      csrf: true,
    });
    form.reset();
    location.assign(`/campaign?id=${encodeURIComponent(result.campaign.id)}`);
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
});

document.querySelector('#refresh').addEventListener('click', loadCampaigns);
document.querySelector('#browse-refresh').addEventListener('click', loadBrowse);
wireLogout();

(async function boot() {
  try {
    currentUser = await requireUser();
    if (!currentUser) return;
    if (currentUser.role === 'player') {
      document.querySelector('#browse-section').hidden = false;
      await loadBrowse();
    } else {
      document.querySelector('#create-section').hidden = false;
    }
    await loadCampaigns();
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
})();
