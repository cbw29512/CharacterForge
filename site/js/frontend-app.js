import { authApi, campaignApi, templateApi } from './api.js';

const views = new Map([...document.querySelectorAll('section[id$="-view"]')].map((el) => [el.id.replace(/-view$/, ''), el]));
const nav = document.getElementById('app-nav');
const statusRegion = document.getElementById('status-region');
const roleBadge = document.getElementById('role-badge');
const userName = document.getElementById('user-name');
const campaignCreateForm = document.getElementById('campaign-create-form');
const campaignList = document.getElementById('campaign-list');
const templateList = document.getElementById('template-list');

let currentUser = null;

function show(name) {
  for (const [key, view] of views) view.hidden = key !== name;
  nav.hidden = !currentUser;
}

function status(message, kind = 'ok') {
  statusRegion.replaceChildren();
  if (!message) return;
  const box = document.createElement('div');
  box.className = `flash flash-${kind}`;
  box.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  box.textContent = message;
  statusRegion.append(box);
}

function errorMessage(error) {
  const code = error?.body?.error || error?.message || 'request_failed';
  const messages = {
    unauthorized: 'Please sign in.',
    invalid_credentials: 'Username, password, or role is incorrect.',
    setup_complete: 'Initial setup has already been completed.',
    csrf_invalid: 'Your session security token is stale. Sign in again.',
    service_unavailable: 'CharacterForge data service is temporarily unavailable.',
  };
  return messages[code] || code.replaceAll('_', ' ');
}

function setUser(user) {
  currentUser = user;
  roleBadge.textContent = user.role.toUpperCase();
  roleBadge.className = `badge badge-${user.role}`;
  userName.textContent = user.display_name || user.username;
  campaignCreateForm.hidden = !['dm', 'admin'].includes(user.role);
}

async function loadCampaigns() {
  campaignList.replaceChildren();
  try {
    const data = await campaignApi.list();
    const campaigns = data?.campaigns || [];
    if (!campaigns.length) {
      const empty = document.createElement('p');
      empty.className = 'frontend-empty';
      empty.textContent = 'No accessible campaigns yet.';
      campaignList.append(empty);
      return;
    }
    for (const campaign of campaigns) {
      const card = document.createElement('article');
      card.className = 'frontend-card';
      const title = document.createElement('h2');
      title.textContent = campaign.name;
      const description = document.createElement('p');
      description.textContent = campaign.description || 'No description yet.';
      const meta = document.createElement('div');
      meta.className = 'frontend-meta';
      meta.textContent = `Campaign #${campaign.id}`;
      card.append(title, description, meta);
      campaignList.append(card);
    }
  } catch (error) {
    status(errorMessage(error), 'error');
  }
}

async function loadTemplates() {
  templateList.replaceChildren();
  try {
    const [pcs, npcs] = await Promise.all([
      templateApi.list(false),
      ['dm', 'admin'].includes(currentUser?.role) ? templateApi.list(true) : Promise.resolve({ templates: [] }),
    ]);
    const templates = [...(pcs?.templates || []), ...(npcs?.templates || [])];
    if (!templates.length) {
      const empty = document.createElement('p');
      empty.className = 'frontend-empty';
      empty.textContent = 'No saved templates yet.';
      templateList.append(empty);
      return;
    }
    for (const template of templates) {
      const card = document.createElement('article');
      card.className = 'frontend-card';
      const title = document.createElement('h2');
      title.textContent = template.name;
      const description = document.createElement('p');
      description.textContent = template.description || 'Reusable CharacterForge build.';
      const meta = document.createElement('div');
      meta.className = 'frontend-meta';
      meta.textContent = `${template.is_npc_template ? 'NPC' : 'PC'} • ${template.race} ${template.char_class} • level ${template.level} • used ${template.times_used}×`;
      card.append(title, description, meta);
      templateList.append(card);
    }
  } catch (error) {
    status(errorMessage(error), 'error');
  }
}

async function enterApp(user) {
  setUser(user);
  show('campaigns');
  status('Signed in.', 'ok');
  await loadCampaigns();
}

async function boot() {
  show('boot');
  status('');
  try {
    const me = await authApi.me();
    await enterApp(me.user);
    return;
  } catch (error) {
    if (error.status && error.status !== 401) {
      status(errorMessage(error), 'error');
      show('login');
      return;
    }
  }

  try {
    const setup = await authApi.setupStatus();
    show(setup.setup_required ? 'setup' : 'login');
  } catch (error) {
    status(errorMessage(error), 'error');
    show('login');
  }
}

document.querySelectorAll('.role-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle('active', active);
      candidate.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('role-input').value = button.dataset.role;
  });
});

document.getElementById('setup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await authApi.setup(Object.fromEntries(form));
    status('Administrator created. Sign in to continue.', 'ok');
    show('login');
    document.getElementById('login-username').value = String(form.get('username') || '');
  } catch (error) {
    status(errorMessage(error), 'error');
  }
});

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await authApi.login(payload);
    const me = await authApi.me();
    await enterApp(me.user);
  } catch (error) {
    status(errorMessage(error), 'error');
  }
});

document.getElementById('logout-button').addEventListener('click', async () => {
  try {
    await authApi.logout();
  } catch (error) {
    if (error.status !== 401) status(errorMessage(error), 'error');
  }
  currentUser = null;
  nav.hidden = true;
  show('login');
  status('Signed out.', 'ok');
});

campaignCreateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await campaignApi.create(payload);
    event.currentTarget.reset();
    status('Campaign created.', 'ok');
    await loadCampaigns();
  } catch (error) {
    status(errorMessage(error), 'error');
  }
});

document.getElementById('refresh-campaigns').addEventListener('click', loadCampaigns);
document.getElementById('refresh-templates').addEventListener('click', loadTemplates);

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', async () => {
    const target = button.dataset.view;
    show(target);
    status('');
    if (target === 'campaigns') await loadCampaigns();
    if (target === 'templates') await loadTemplates();
  });
});

boot();
