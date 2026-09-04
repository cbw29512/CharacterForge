// CharacterForge — Main JS

// Global CSRF wiring. Flask-WTF validates POST form fields and X-CSRFToken headers.
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
if (csrfToken) {
  document.querySelectorAll('form').forEach(form => {
    if ((form.method || 'get').toLowerCase() !== 'post') return;
    if (form.querySelector('input[name="csrf_token"]')) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'csrf_token';
    input.value = csrfToken;
    form.appendChild(input);
  });

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = new URL(rawUrl, window.location.href);
    if (url.origin === window.location.origin && !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
      const headers = new Headers(init.headers || {});
      headers.set('X-CSRFToken', csrfToken);
      init = {...init, headers};
    }
    return nativeFetch(input, init);
  };
}

// Role selector on login page
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    const roleInput = document.getElementById('role-input');
    if (roleInput) roleInput.value = btn.dataset.role;
  });
});

// Auto-select first role btn
const firstRole = document.querySelector('.role-btn');
if (firstRole) firstRole.click();

// Modal handling
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal-overlay').classList.remove('open');
  });
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// Ability score modifier display
function abilityMod(score) {
  const mod = Math.floor((score - 10) / 2);
  return (mod >= 0 ? '+' : '') + mod;
}
document.querySelectorAll('.ability-score-input').forEach(input => {
  const modEl = document.getElementById('mod-' + input.id);
  function update() {
    if (modEl) modEl.textContent = abilityMod(parseInt(input.value) || 10);
  }
  input.addEventListener('input', update);
  update();
});

// Confirm dangerous actions
document.querySelectorAll('.confirm-action').forEach(form => {
  form.addEventListener('submit', (e) => {
    const msg = form.dataset.confirm || 'Are you sure?';
    if (!confirm(msg)) e.preventDefault();
  });
});

// AI Chat for character wizard
const aiChat = document.getElementById('ai-chat-box');
const aiInput = document.getElementById('ai-input');
const aiSend = document.getElementById('ai-send');

function appendMsg(text, role) {
  if (!aiChat) return;
  const div = document.createElement('div');
  div.className = 'ai-msg ' + role;
  div.textContent = text;
  aiChat.appendChild(div);
  aiChat.scrollTop = aiChat.scrollHeight;
}

async function sendAiMessage() {
  if (!aiInput || !aiChat) return;
  const msg = aiInput.value.trim();
  if (!msg) return;
  appendMsg(msg, 'user');
  aiInput.value = '';
  aiSend.disabled = true;

  // Gather current character state from form
  const form = document.getElementById('char-wizard-form');
  const charData = {};
  if (form) {
    new FormData(form).forEach((v, k) => charData[k] = v);
  }

  try {
    const res = await fetch('/characters/ai_step', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        step: document.getElementById('current-step')?.value || 'general',
        build: charData,
        message: msg
      })
    });
    const data = await res.json();
    appendMsg(data.reply || data.error || '(no response)', 'dm');
  } catch (e) {
    appendMsg('[AI unavailable]', 'dm');
  }
  aiSend.disabled = false;
}

if (aiSend) aiSend.addEventListener('click', sendAiMessage);
if (aiInput) aiInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendAiMessage(); });

// Campaign Quick NPC AI generation. Kept in shared JS so it runs in the
// campaign page's normal script context instead of legacy title-block markup.
window.generateNPC = async function generateNPC() {
  const desc = document.getElementById('npc-ai-desc')?.value?.trim();
  const status = document.getElementById('npc-ai-status');
  const form = document.getElementById('npc-form');
  if (!desc || !status || !form) return;

  status.textContent = 'Generating stat block...';
  try {
    const res = await fetch('/characters/ai_npc', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({description: desc})
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      status.textContent = data.error || 'NPC generation failed.';
      return;
    }

    const npc = data.npc || {};
    const set = (name, value) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el && value !== undefined && value !== null) el.value = value;
    };
    set('name', npc.name);
    set('level', npc.level);
    set('char_class', npc.char_class);
    set('race', npc.race);
    set('alignment', npc.alignment);
    set('strength', npc.strength);
    set('dexterity', npc.dexterity);
    set('constitution', npc.constitution);
    set('intelligence', npc.intelligence);
    set('wisdom', npc.wisdom);
    set('charisma', npc.charisma);
    set('armor_class_override', npc.armor_class);
    set('hp_override', npc.max_hp);
    set('speed', npc.speed);
    set('notes', String(npc.notes || '') + (npc.reasoning ? `\n\n[AI reasoning: ${npc.reasoning}]` : ''));
    status.textContent = 'Stat block generated. Review it before saving.';
  } catch (error) {
    console.error('Quick NPC generation failed', error);
    status.textContent = 'NPC generation is unavailable right now.';
  }
};

// HP bar update
document.querySelectorAll('.hp-bar-fill').forEach(bar => {
  const cur = parseInt(bar.dataset.cur) || 0;
  const max = parseInt(bar.dataset.max) || 1;
  bar.style.width = Math.max(0, Math.min(100, (cur / max) * 100)) + '%';
  if (cur / max < 0.25) bar.style.background = 'linear-gradient(90deg, #7a2020, #c0392b)';
  else if (cur / max < 0.5) bar.style.background = 'linear-gradient(90deg, #7a5f20, #c9a84c)';
});

// Wizard step navigation
const wizardSteps = document.querySelectorAll('.wizard-section');
let currentStep = 0;

function showStep(idx) {
  wizardSteps.forEach((s, i) => s.style.display = i === idx ? 'block' : 'none');
  document.querySelectorAll('.wizard-step').forEach((s, i) => {
    s.classList.toggle('active', i === idx);
    s.classList.toggle('done', i < idx);
  });
  const cur = document.getElementById('current-step');
  if (cur) cur.value = wizardSteps[idx]?.dataset.step || 'general';
}

document.querySelectorAll('.wizard-next').forEach(btn => {
  btn.addEventListener('click', () => {
    if (currentStep < wizardSteps.length - 1) { currentStep++; showStep(currentStep); }
  });
});
document.querySelectorAll('.wizard-back').forEach(btn => {
  btn.addEventListener('click', () => {
    if (currentStep > 0) { currentStep--; showStep(currentStep); }
  });
});

if (wizardSteps.length > 0) showStep(0);

// Flash auto-dismiss
setTimeout(() => {
  document.querySelectorAll('.flash').forEach(f => f.style.opacity = '0');
}, 4000);
