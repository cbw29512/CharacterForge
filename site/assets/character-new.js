import { api, messageFor } from './api.js';
import { requireUser, wireLogout } from './session.js';

const params = new URLSearchParams(location.search);
const campaignId = Number(params.get('campaign_id'));
const templateId = Number(params.get('template_id'));
let isNpc = params.get('npc') === 'true';
const form = document.querySelector('#character-form');
const status = document.querySelector('#status');
const backLink = document.querySelector('#back-link');

function showStatus(text, type = '') {
  status.className = `status ${type}`.trim();
  status.textContent = text;
}

function option(value, label = value) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

function fillSelect(selector, values, current) {
  const select = document.querySelector(selector);
  select.replaceChildren(...values.map((value) => option(typeof value === 'string' ? value : value.name)));
  if (current) select.value = current;
}

async function loadSrd() {
  const data = await api('/api/srd');
  fillSelect('#race', data.races, 'Human');
  fillSelect('#char-class', data.classes, 'Fighter');
  fillSelect('#background', data.backgrounds, 'Soldier');
  fillSelect('#alignment', data.alignments, 'True Neutral');
}

function applyTemplate(template) {
  const values = {
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
    notes: template.notes,
    personality_trait: template.traits?.personality,
    ideal: template.traits?.ideal,
    bond: template.traits?.bond,
    flaw: template.traits?.flaw,
  };
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    if (field && value !== null && value !== undefined) field.value = String(value);
  }
  isNpc = Boolean(template.is_npc_template);
  document.querySelector('#kind-label').textContent = isNpc ? 'NPC builder · template' : 'Character builder · template';
  document.querySelector('#title').textContent = `Create from ${template.name}`;
  showStatus(`Loaded template ${template.name}.`, 'ok');
}

async function loadTemplate() {
  if (!Number.isSafeInteger(templateId) || templateId <= 0) return;
  const data = await api('/api/templates/use', {
    method: 'POST',
    body: { template_id: templateId },
    csrf: true,
  });
  applyTemplate(data.template);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  payload.campaign_id = Number.isSafeInteger(campaignId) && campaignId > 0 ? campaignId : null;
  payload.is_npc = isNpc;
  showStatus('Creating character…');
  try {
    const result = await api('/api/characters/create', { method: 'POST', body: payload, csrf: true });
    location.assign(`/character?id=${encodeURIComponent(result.character.id)}`);
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
});

wireLogout();
(async function boot() {
  try {
    const user = await requireUser();
    if (!user) return;
    if (Number.isSafeInteger(campaignId) && campaignId > 0) backLink.href = `/campaign?id=${encodeURIComponent(campaignId)}`;
    document.querySelector('#kind-label').textContent = isNpc ? 'NPC builder' : 'Character builder';
    document.querySelector('#title').textContent = isNpc ? 'Create NPC' : 'Create character';
    await loadSrd();
    await loadTemplate();
  } catch (error) {
    if (error.status === 401) return;
    showStatus(messageFor(error), 'error');
    form.hidden = true;
  }
})();
