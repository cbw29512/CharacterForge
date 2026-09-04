import { authApi, campaignApi, characterApi, templateApi } from './api.js';

const views = new Map([...document.querySelectorAll('section[id$="-view"]')].map((el) => [el.id.replace(/-view$/, ''), el]));
const nav = document.getElementById('app-nav');
const statusRegion = document.getElementById('status-region');
const roleBadge = document.getElementById('role-badge');
const userName = document.getElementById('user-name');
const campaignCreateForm = document.getElementById('campaign-create-form');
const campaignList = document.getElementById('campaign-list');
const browseList = document.getElementById('browse-list');
const templateList = document.getElementById('template-list');
const characterForm = document.getElementById('character-create-form');
const characterCampaign = document.getElementById('char-campaign');
const createdCharacter = document.getElementById('created-character');
const npcField = document.getElementById('npc-field');

let currentUser = null;
let srd = null;
let accessibleCampaigns = [];

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
    membership_exists: 'You already have a pending or active membership.',
    invalid_srd_choice: 'Choose a supported race, class, background, and alignment.',
    forbidden: 'You do not have permission to perform that action.',
    service_unavailable: 'CharacterForge data service is temporarily unavailable.',
  };
  return messages[code] || code.replaceAll('_', ' ');
}

function button(label, className = 'btn') {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  return el;
}

function setUser(user) {
  currentUser = user;
  roleBadge.textContent = user.role.toUpperCase();
  roleBadge.className = `badge badge-${user.role}`;
  userName.textContent = user.display_name || user.username;
  const manager = ['dm', 'admin'].includes(user.role);
  campaignCreateForm.hidden = !manager;
  npcField.hidden = !manager;
}

function fillSelect(select, values, label = (value) => value.name ?? value) {
  select.replaceChildren();
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value.name ?? value;
    option.textContent = label(value);
    select.append(option);
  }
}

async function loadSrd() {
  if (srd) return srd;
  const response = await fetch('/data/srd-5.1.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('srd_catalog_unavailable');
  srd = await response.json();
  fillSelect(document.getElementById('char-race'), srd.races);
  fillSelect(document.getElementById('char-class'), srd.classes);
  fillSelect(document.getElementById('char-background'), srd.backgrounds);
  fillSelect(document.getElementById('char-alignment'), srd.alignments);
  document.getElementById('char-race').value = 'Human';
  document.getElementById('char-class').value = 'Fighter';
  document.getElementById('char-background').value = 'Soldier';
  document.getElementById('char-alignment').value = 'True Neutral';
  return srd;
}

function refreshCampaignSelect() {
  const previous = characterCampaign.value;
  characterCampaign.replaceChildren();
  const unassigned = document.createElement('option');
  unassigned.value = '';
  unassigned.textContent = 'Unassigned';
  characterCampaign.append(unassigned);
  for (const campaign of accessibleCampaigns) {
    const option = document.createElement('option');
    option.value = String(campaign.id);
    option.textContent = campaign.name;
    characterCampaign.append(option);
  }
  if ([...characterCampaign.options].some((option) => option.value === previous)) characterCampaign.value = previous;
}

async function loadCampaigns() {
  campaignList.replaceChildren();
  try {
    const data = await campaignApi.list();
    accessibleCampaigns = data?.campaigns || [];
    refreshCampaignSelect();
    if (!accessibleCampaigns.length) {
      const empty = document.createElement('p');
      empty.className = 'frontend-empty';
      empty.textContent = 'No accessible campaigns yet.';
      campaignList.append(empty);
      return;
    }
    for (const campaign of accessibleCampaigns) {
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
      if (['dm', 'admin'].includes(currentUser?.role)) {
        const remove = button('Delete Campaign', 'btn');
        remove.addEventListener('click', async () => {
          if (!confirm(`Delete campaign “${campaign.name}”?`)) return;
          try {
            await campaignApi.remove(campaign.id);
            status('Campaign deleted.', 'ok');
            await loadCampaigns();
          } catch (error) {
            status(errorMessage(error), 'error');
          }
        });
        card.append(remove);
      }
      campaignList.append(card);
    }
  } catch (error) {
    status(errorMessage(error), 'error');
  }
}

async function loadBrowse() {
  browseList.replaceChildren();
  try {
    const data = await campaignApi.browse();
    const campaigns = data?.campaigns || [];
    if (!campaigns.length) {
      const empty = document.createElement('p');
      empty.className = 'frontend-empty';
      empty.textContent = 'No additional active campaigns are available.';
      browseList.append(empty);
      return;
    }
    for (const campaign of campaigns) {
      const card = document.createElement('article');
      card.className = 'frontend-card';
      const title = document.createElement('h2');
      title.textContent = campaign.name;
      const description = document.createElement('p');
      description.textContent = campaign.description || 'No description yet.';
      const join = button('Request to Join', 'btn btn-primary');
      join.addEventListener('click', async () => {
        try {
          await campaignApi.join(campaign.id);
          status('Join request sent.', 'ok');
          await loadBrowse();
        } catch (error) {
          status(errorMessage(error), 'error');
        }
      });
      card.append(title, description, join);
      browseList.append(card);
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
      const use = button('Load into Forge', 'btn btn-primary');
      use.addEventListener('click', async () => {
        try {
          const result = await templateApi.use(template.id);
          await loadSrd();
          applyTemplate(result.template);
          show('characters');
          status(`Loaded template “${template.name}”.`, 'ok');
        } catch (error) {
          status(errorMessage(error), 'error');
        }
      });
      const remove = button('Delete Template', 'btn');
      remove.addEventListener('click', async () => {
        if (!confirm(`Delete template “${template.name}”?`)) return;
        try {
          await templateApi.remove(template.id);
          status('Template deleted.', 'ok');
          await loadTemplates();
        } catch (error) {
          status(errorMessage(error), 'error');
        }
      });
      card.append(title, description, meta, use, remove);
      templateList.append(card);
    }
  } catch (error) {
    status(errorMessage(error), 'error');
  }
}

function applyTemplate(template) {
  const values = {
    name: template.name,
    race: template.race,
    char_class: template.char_class,
    background: template.background,
    alignment: template.alignment,
    level: template.level,
    strength: template.strength,
    dexterity: template.dexterity,
    constitution: template.constitution,
    intelligence: template.intelligence,
    wisdom: template.wisdom,
    charisma: template.charisma,
    notes: template.notes || '',
  };
  for (const [name, value] of Object.entries(values)) {
    const field = characterForm.elements.namedItem(name);
    if (field) field.value = value ?? '';
  }
  const npc = characterForm.elements.namedItem('is_npc');
  if (npc) npc.checked = Boolean(template.is_npc_template);
}

function renderCharacter(character) {
  createdCharacter.replaceChildren();
  createdCharacter.hidden = false;
  const title = document.createElement('h2');
  title.textContent = `${character.is_npc ? 'NPC' : 'Character'}: ${character.name}`;
  const summary = document.createElement('p');
  summary.textContent = `${character.race} ${character.char_class} • level ${character.level} • AC ${character.armor_class} • HP ${character.current_hp}/${character.max_hp}`;
  const mechanics = document.createElement('div');
  mechanics.className = 'frontend-meta';
  mechanics.textContent = `Proficiency +${character.proficiency_bonus} • Hit Dice ${character.hit_dice}`;
  const saveForm = document.createElement('form');
  saveForm.className = 'frontend-inline-form';
  const name = document.createElement('input');
  name.name = 'name';
  name.placeholder = 'Template name';
  name.required = true;
  name.maxLength = 200;
  const description = document.createElement('input');
  description.name = 'description';
  description.placeholder = 'Template description';
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'btn';
  save.textContent = 'Save as Template';
  saveForm.append(name, description, save);
  saveForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await templateApi.save(character.id, Object.fromEntries(new FormData(saveForm)));
      saveForm.reset();
      status('Template saved.', 'ok');
    } catch (error) {
      status(errorMessage(error), 'error');
    }
  });
  createdCharacter.append(title, summary, mechanics, saveForm);
}

async function enterApp(user) {
  setUser(user);
  try { await loadSrd(); }
  catch (error) { status(errorMessage(error), 'error'); }
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
  accessibleCampaigns = [];
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

characterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form);
  payload.is_npc = form.get('is_npc') === 'on';
  try {
    const result = await characterApi.create(payload);
    renderCharacter(result.character);
    status(`${result.character.is_npc ? 'NPC' : 'Character'} forged.`, 'ok');
  } catch (error) {
    status(errorMessage(error), 'error');
  }
});

document.getElementById('refresh-campaigns').addEventListener('click', loadCampaigns);
document.getElementById('refresh-browse').addEventListener('click', loadBrowse);
document.getElementById('refresh-templates').addEventListener('click', loadTemplates);

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', async () => {
    const target = button.dataset.view;
    show(target);
    status('');
    if (target === 'campaigns') await loadCampaigns();
    if (target === 'browse') await loadBrowse();
    if (target === 'characters') {
      await loadSrd();
      await loadCampaigns();
    }
    if (target === 'templates') await loadTemplates();
  });
});

boot();
