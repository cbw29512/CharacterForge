/* CharacterForge UI hardening.
 * Loaded after page-specific scripts so it can safely wrap wizard navigation.
 */
(function () {
  "use strict";

  function logError(message, error) {
    console.error("[CharacterForge UI] " + message, error || "");
  }

  function currentClass() {
    const field = document.getElementById("field-char_class");
    return field ? field.value : "Fighter";
  }

  async function fetchClassInfo(className) {
    try {
      const response = await fetch("/characters/class_info?class=" + encodeURIComponent(className), {
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error("Class data request failed: " + response.status);
      return await response.json();
    } catch (error) {
      logError("Unable to load class data", error);
      return null;
    }
  }

  function ensureClassSkillPanel() {
    const backgroundStep = document.getElementById("step-3");
    if (!backgroundStep || document.getElementById("class-skill-panel")) return;

    const panel = backgroundStep.querySelector(".panel-gold");
    const nav = panel ? panel.querySelector(".wizard-nav-row") : null;
    if (!panel || !nav) return;

    const wrapper = document.createElement("div");
    wrapper.id = "class-skill-panel";
    wrapper.style.cssText = "margin:16px 0;padding:14px;background:var(--bg3);border:1px solid var(--border);border-radius:8px";
    wrapper.innerHTML = [
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap">',
      '<strong style="color:var(--gold);font-family:Cinzel,serif">Class Skills</strong>',
      '<span id="class-skill-count" style="font-size:12px;color:var(--text-dim)">Loading…</span>',
      '</div>',
      '<p id="class-skill-help" style="font-size:13px;color:var(--text-dim);margin:4px 0 10px">Choose the skills granted by your class.</p>',
      '<div id="class-skill-options" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px"></div>',
      '<input type="hidden" name="class_skills" id="field-class_skills" value="">',
      '<div id="class-skill-error" style="display:none;color:#e07070;font-size:12px;margin-top:8px"></div>'
    ].join("");
    panel.insertBefore(wrapper, nav);
  }

  async function refreshClassSkills() {
    ensureClassSkillPanel();
    const options = document.getElementById("class-skill-options");
    const hidden = document.getElementById("field-class_skills");
    const count = document.getElementById("class-skill-count");
    const help = document.getElementById("class-skill-help");
    if (!options || !hidden) return;

    const data = await fetchClassInfo(currentClass());
    if (!data) {
      if (count) count.textContent = "Class data unavailable";
      return;
    }

    options.innerHTML = "";
    const choices = data.skill_choices || [];
    const required = Number(data.num_skills || 0);
    if (help) help.textContent = data.name + " grants " + required + " skill choice" + (required === 1 ? "" : "s") + ". Background skills are added automatically.";
    if (count) count.textContent = "0 / " + required + " selected";

    choices.forEach(function (skill, index) {
      const label = document.createElement("label");
      label.style.cssText = "display:flex;align-items:center;gap:7px;padding:7px 8px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = skill;
      input.dataset.skill = skill;
      input.id = "class-skill-" + index;
      label.htmlFor = input.id;
      label.appendChild(input);
      label.appendChild(document.createTextNode(skill));
      options.appendChild(label);
    });

    options.querySelectorAll("input[type=checkbox]").forEach(function (input) {
      input.addEventListener("change", function () {
        const checked = Array.from(options.querySelectorAll("input:checked"));
        if (checked.length > required) input.checked = false;
        const selected = Array.from(options.querySelectorAll("input:checked")).map(function (box) { return box.value; });
        hidden.value = selected.join(",");
        if (count) count.textContent = selected.length + " / " + required + " selected";
        validateClassSkills(false);
      });
    });

    // Preserve a prior selection when possible, but discard skills that are no
    // longer legal after changing class.
    hidden.value = "";
  }

  function validateClassSkills(showMessage) {
    const options = document.getElementById("class-skill-options");
    const error = document.getElementById("class-skill-error");
    const hidden = document.getElementById("field-class_skills");
    if (!options || !hidden) return true;

    const selected = Array.from(options.querySelectorAll("input:checked"));
    const text = document.getElementById("class-skill-count");
    const requiredText = text ? text.textContent.split("/")[1] : "";
    const required = parseInt(requiredText, 10) || 0;
    const valid = selected.length === required;
    if (error) {
      error.style.display = !valid && showMessage ? "block" : "none";
      error.textContent = "Choose exactly " + required + " class skill" + (required === 1 ? "" : "s") + " before continuing.";
    }
    return valid;
  }

  function addPrintControls() {
    if (!document.querySelector("h1") || document.getElementById("cf-print-button")) return;
    if (!/CharacterForge/i.test(document.title)) return;

    const header = document.querySelector("h1");
    if (!header || !/characters\/\d+\/sheet/.test(window.location.pathname)) return;

    const actionContainer = header.closest("div")?.parentElement?.querySelector(".flex");
    if (!actionContainer) return;

    const button = document.createElement("button");
    button.id = "cf-print-button";
    button.type = "button";
    button.className = "btn btn-secondary btn-sm";
    button.textContent = "🖨 Print Character Sheet";
    button.addEventListener("click", function () { window.print(); });
    actionContainer.prepend(button);

    addClassReference(header);
  }

  async function addClassReference(header) {
    const classMatch = header.parentElement?.querySelector("div[style*=italic]");
    const text = classMatch ? classMatch.textContent : "";
    const known = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"];
    const className = known.find(function (name) { return text.includes(name); });
    if (!className) return;

    const data = await fetchClassInfo(className);
    if (!data) return;

    const reference = document.createElement("section");
    reference.className = "cf-class-reference panel";
    reference.innerHTML = [
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap">',
      '<h3 style="margin:0">' + data.name + ' Quick Reference</h3>',
      '<span style="font-size:12px;color:var(--text-dim)">2014 SRD</span>',
      '</div>',
      '<div class="cf-ref-grid">',
      '<div><b>Hit Die</b><span>' + data.hit_die + '</span></div>',
      '<div><b>Primary Ability</b><span>' + data.primary_ability + '</span></div>',
      '<div><b>Saving Throws</b><span>' + data.saving_throws.join(", ") + '</span></div>',
      '<div><b>Class Skills</b><span>' + data.num_skills + ' choice(s)</span></div>',
      '<div><b>Armor</b><span>' + (data.armor_proficiencies.join(", ") || "None") + '</span></div>',
      '<div><b>Weapons</b><span>' + (data.weapon_proficiencies.join(", ") || "None") + '</span></div>',
      '</div>'
    ].join("");
    const headerBlock = header.closest("div.flex") || header.parentElement;
    if (headerBlock && headerBlock.parentElement) headerBlock.parentElement.insertBefore(reference, headerBlock.nextSibling);
  }

  function installPrintStyles() {
    if (document.getElementById("cf-print-styles")) return;
    const style = document.createElement("style");
    style.id = "cf-print-styles";
    style.textContent = [
      ".cf-ref-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}",
      ".cf-ref-grid>div{padding:7px 9px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;display:flex;flex-direction:column;gap:2px;font-size:12px}",
      ".cf-ref-grid b{font-family:Cinzel,serif;color:var(--gold);font-size:10px;text-transform:uppercase}",
      ".cf-ref-grid span{color:var(--text)}",
      "@media(max-width:700px){.cf-ref-grid{grid-template-columns:1fr 1fr}}",
      "@media print{",
      "  @page{size:Letter;margin:0.45in}",
      "  body{background:#fff!important;color:#111!important;font-size:10pt!important}",
      "  .topnav,.flash-wrap,.btn,.btn-logout,.modal-overlay,form.confirm-action,#cf-print-button{display:none!important}",
      "  .page-wrap{max-width:none!important;margin:0!important;padding:0!important}",
      "  .panel,.stat-bubble,.ability-block{background:#fff!important;color:#111!important;border:1px solid #777!important;box-shadow:none!important}",
      "  h1,h2,h3,.trait-label,.ability-block-name{color:#111!important}",
      "  .text-dim,.skill-row-ability,.stat-bubble-label{color:#444!important}",
      "  .cf-class-reference{break-inside:avoid}",
      "  .cf-ref-grid>div{background:#fff!important;border-color:#999!important}",
      "  .cf-ref-grid b,.cf-ref-grid span{color:#111!important}",
      "  .hp-bar-track{border:1px solid #777!important;background:#fff!important}",
      "  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function installWizardHooks() {
    const form = document.getElementById("char-form");
    if (!form) return;

    // The hardened endpoint is opt-in from the UI; the legacy endpoint remains intact.
    form.action = "/characters/create_v2";
    ensureClassSkillPanel();

    if (typeof window.selectChoice === "function" && !window.selectChoice.__cfWrapped) {
      const originalSelect = window.selectChoice;
      const wrappedSelect = function () {
        const result = originalSelect.apply(this, arguments);
        if (arguments[0] === "char_class") refreshClassSkills();
        return result;
      };
      wrappedSelect.__cfWrapped = true;
      window.selectChoice = wrappedSelect;
    }

    if (typeof window.goStep === "function" && !window.goStep.__cfWrapped) {
      const originalGo = window.goStep;
      const wrappedGo = function (idx) {
        if (idx === 4 && !validateClassSkills(true)) return;
        const result = originalGo.apply(this, arguments);
        if (idx === 3) refreshClassSkills();
        return result;
      };
      wrappedGo.__cfWrapped = true;
      window.goStep = wrappedGo;
    }

    refreshClassSkills();
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      installWizardHooks();
      addPrintControls();
      installPrintStyles();
    } catch (error) {
      logError("UI initialization failed", error);
    }
  });
})();
