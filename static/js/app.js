// CharacterForge — Main JS

// Role selector on login page
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
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
    const res = await fetch('/characters/ai_suggest', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        step: document.getElementById('current-step')?.value || 'general',
        character: charData,
        message: msg
      })
    });
    const data = await res.json();
    appendMsg(data.reply || '(no response)', 'dm');
  } catch (e) {
    appendMsg('[AI unavailable]', 'dm');
  }
  aiSend.disabled = false;
}

if (aiSend) aiSend.addEventListener('click', sendAiMessage);
if (aiInput) aiInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendAiMessage(); });

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
