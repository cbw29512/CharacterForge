import { api, messageFor } from './api.js';
import { requireUser, wireLogout } from './session.js';

const status = document.querySelector('#status');
const pcTemplates = document.querySelector('#pc-templates');
const npcTemplates = document.querySelector('#npc-templates');

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

function templateCard(template) {
  const article = document.createElement('article');
  article.className = 'campaign';
  const heading = document.createElement('h3');
  heading.textContent = template.name;
  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = `Level ${template.level} ${template.race || ''} ${template.char_class || ''} · used ${template.times_used} time${template.times_used === 1 ? '' : 's'}`.replace(/\s+/g, ' ').trim();
  const description = document.createElement('p');
  description.textContent = template.description || 'No description.';
  const actions = document.createElement('div');
  actions.className = 'actions';
  const use = document.createElement('a');
  use.className = 'btn primary';
  use.href = `/character-new?template_id=${encodeURIComponent(template.id)}${template.is_npc_template ? '&npc=true' : ''}`;
  use.textContent = 'Use template';
  const remove = document.createElement('button');
  remove.className = 'btn danger';
  remove.type = 'button';
  remove.textContent = 'Delete';
  remove.addEventListener('click', async () => {
    if (!confirm(`Delete template ${template.name}?`)) return;
    try {
      await api('/api/templates/delete', { method: 'POST', body: { template_id: template.id }, csrf: true });
      await loadTemplates();
      showStatus('Template deleted.', 'ok');
    } catch (error) {
      showStatus(messageFor(error), 'error');
    }
  });
  actions.append(use, remove);
  article.append(heading, meta, description, actions);
  return article;
}

async function loadKind(isNpc) {
  const data = await api(`/api/templates?npc=${isNpc ? 'true' : 'false'}`);
  const target = isNpc ? npcTemplates : pcTemplates;
  target.replaceChildren(...(data.templates.length ? data.templates.map(templateCard) : [emptyMessage(isNpc ? 'No NPC templates saved.' : 'No character templates saved.')]));
}

async function loadTemplates() {
  try {
    await Promise.all([loadKind(false), loadKind(true)]);
  } catch (error) {
    if (error.status === 401) return location.replace('/login');
    showStatus(messageFor(error), 'error');
  }
}

wireLogout();
(async function boot() {
  try {
    const user = await requireUser();
    if (user) await loadTemplates();
  } catch (error) {
    showStatus(messageFor(error), 'error');
  }
})();
