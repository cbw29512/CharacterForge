import { api, messageFor } from './api.js';
import { requireUser, wireLogout } from './session.js';

const params = new URLSearchParams(location.search);
const characterId = Number(params.get('id'));
const status = document.querySelector('#status');
let characterData = null;

function showStatus(text, type = '') {
  status.className = `status ${type}`.trim();
  status.textContent = text;
}

function addDefinition(container, label, value) {
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = String(value ?? '—');
  container.append(term, description);
}

function fillList(selector, values, emptyText) {
  const list = document.querySelector(selector);
  list.replaceChildren();
  const items = Array.isArray(values) ? values : Object.keys(values || {}).filter((key) => values[key]);
  if (!items.length) {
    const item = document.createElement('li');
    item.className = 'muted';
    item.textContent = emptyText;
    list.append(item);
    return;
  }
  for (const value of items) {
    const item = document.createElement('li');
    item.textContent = typeof value === 'string' ? value : JSON.stringify(value);
    list.append(item);
  }
}

function render(data) {
  const character = data.character;
  characterData = character;
  document.title = `${character.name} — CharacterForge`;
  document.querySelector('#kind').textContent = character.is_npc ? 'NPC' : 'Character';
  document.querySelector('#character-name').textContent = character.name;
  document.querySelector('#identity-line').textContent = `Level ${character.level} ${character.race || ''} ${character.char_class || ''} · ${character.background || 'No background'} · ${character.alignment || 'No alignment'}`.replace(/\s+/g, ' ').trim();
  const back = document.querySelector('#back-link');
  if (character.campaign_id) back.href = `/campaign?id=${encodeURIComponent(character.campaign_id)}`;

  const core = document.querySelector('#core-stats');
  core.replaceChildren();
  for (const [label, value] of [['AC', character.armor_class], ['HP', `${character.current_hp}/${character.max_hp}`], ['Speed', character.speed], ['Proficiency', `+${character.proficiency_bonus}`]]) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    const span = document.createElement('span');
    span.textContent = label;
    card.append(strong, span);
    core.append(card);
  }

  const abilities = document.querySelector('#abilities');
  abilities.replaceChildren();
  for (const [label, key] of [['Strength','strength'],['Dexterity','dexterity'],['Constitution','constitution'],['Intelligence','intelligence'],['Wisdom','wisdom'],['Charisma','charisma']]) addDefinition(abilities, label, character[key]);

  const combat = document.querySelector('#combat');
  combat.replaceChildren();
  addDefinition(combat, 'Initiative', character.initiative);
  addDefinition(combat, 'Temporary HP', character.temp_hp);
  addDefinition(combat, 'Hit dice', character.hit_dice);
  addDefinition(combat, 'Experience', character.experience_points);

  fillList('#skills', character.skills, 'No skill proficiencies recorded.');
  fillList('#saves', character.saving_throws, 'No saving throw proficiencies recorded.');
  fillList('#equipment', character.equipment, 'No equipment recorded.');
  fillList('#features', character.features, 'No features recorded.');

  const traits = document.querySelector('#traits');
  traits.replaceChildren();
  for (const [key, value] of Object.entries(character.traits || {})) addDefinition(traits, key.replaceAll('_', ' '), value || '—');
  document.querySelector('#notes').textContent = character.notes || 'No notes.';
  document.querySelector('#delete-character').hidden = !data.can_delete;
  document.querySelector('#save-template-section').hidden = !data.can_save_template;
}

async function loadCharacter() {
  if (!Number.isSafeInteger(characterId) || characterId <= 0) {
    showStatus('Invalid character link.', 'error');
    return;
  }
  try {
    const data = await api(`/api/characters?id=${encodeURIComponent(characterId)}`);
    render(data);
    showStatus('');
  } catch (error) {
    if (error.status === 401) return location.replace('/login');
    if (error.status === 403 || error.status === 404) return showStatus('This character is unavailable to your account.', 'error');
    showStatus(messageFor(error), 'error');
  }
}

document.querySelector('#save-template-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!characterData) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    await api('/api/templates/save', {
      method: 'POST',
      body: { character_id: characterId, name: data.get('name'), description: data.get('description') },
      csrf: true,
    });
    form.reset();
    showStatus('Template saved to your library.', 'ok');
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
});

document.querySelector('#delete-character').addEventListener('click', async () => {
  if (!characterData) return;
  if (!confirm(`Delete ${characterData.name}? This cannot be undone.`)) return;
  try {
    await api('/api/characters/delete', { method: 'POST', body: { id: characterId }, csrf: true });
    location.assign(characterData.campaign_id ? `/campaign?id=${encodeURIComponent(characterData.campaign_id)}` : '/app');
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
});

wireLogout();
(async function boot() {
  try {
    const user = await requireUser();
    if (user) await loadCharacter();
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
})();
