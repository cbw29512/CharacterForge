/* CharacterForge rendered accessibility repairs for legacy templates.
 * Keep these enhancements small and deterministic while templates are
 * progressively refactored to native semantic markup.
 */
(function () {
  "use strict";

  function setAccessibleName(element, label) {
    if (!element || element.getAttribute("aria-label") || element.getAttribute("aria-labelledby")) return;
    element.setAttribute("aria-label", label);
  }

  function hardenQuickNpcModal() {
    const modal = document.getElementById("modal-add-npc");
    if (!modal) return;

    const heading = modal.querySelector("h2");
    if (heading) {
      heading.id = heading.id || "quick-npc-title";
      modal.setAttribute("aria-labelledby", heading.id);
    }
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const close = modal.querySelector(".modal-close");
    if (close) {
      close.type = "button";
      close.setAttribute("aria-label", "Close Quick NPC dialog");
    }

    setAccessibleName(document.getElementById("npc-ai-desc"), "NPC description for AI generation");

    const form = document.getElementById("npc-form");
    if (!form) return;

    const names = {
      name: "NPC name",
      level: "NPC challenge rating or level",
      char_class: "NPC class or type",
      race: "NPC race or creature type",
      strength: "NPC Strength score",
      dexterity: "NPC Dexterity score",
      constitution: "NPC Constitution score",
      intelligence: "NPC Intelligence score",
      wisdom: "NPC Wisdom score",
      charisma: "NPC Charisma score",
      armor_class_override: "NPC Armor Class override",
      hp_override: "NPC Hit Points override",
      speed: "NPC speed",
      alignment: "NPC alignment",
      notes: "NPC traits and notes"
    };

    Object.entries(names).forEach(function ([name, label]) {
      setAccessibleName(form.querySelector(`[name="${name}"]`), label);
    });
  }

  function hardenCharacterBuilder() {
    if (!/^\/characters\/(new|create)/.test(window.location.pathname)) return;

    const byId = {
      "field-name": "Character name",
      "field-level": "Character level",
      "field-alignment": "Character alignment",
      "score-strength": "Strength score",
      "score-dexterity": "Dexterity score",
      "score-constitution": "Constitution score",
      "score-intelligence": "Intelligence score",
      "score-wisdom": "Wisdom score",
      "score-charisma": "Charisma score",
      "field-personality_trait": "Personality trait",
      "field-ideal": "Ideal",
      "field-bond": "Bond",
      "field-flaw": "Flaw",
      "field-notes": "Character notes"
    };

    Object.entries(byId).forEach(function ([id, label]) {
      setAccessibleName(document.getElementById(id), label);
    });

    document.querySelectorAll(".ai-input").forEach(function (input, index) {
      const placeholder = (input.getAttribute("placeholder") || "").replace(/\.{3}$/, "").trim();
      const label = placeholder ? "AI helper: " + placeholder : "AI helper question " + (index + 1);
      setAccessibleName(input, label);
    });
  }

  function hardenCharacterSheetModal() {
    if (!/\/characters\/\d+\/sheet$/.test(window.location.pathname)) return;

    const modal = document.getElementById("modal-save-template");
    if (!modal) return;

    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const heading = modal.querySelector("h2");
    if (heading) {
      heading.id = heading.id || "save-template-title";
      modal.setAttribute("aria-labelledby", heading.id);
    }

    const close = modal.querySelector(".modal-close");
    if (close) {
      close.type = "button";
      close.setAttribute("aria-label", "Close save template dialog");
    }

    const form = modal.querySelector("form");
    if (!form) return;
    setAccessibleName(form.querySelector('[name="template_name"]'), "Template name");
    setAccessibleName(form.querySelector('[name="template_description"]'), "Template description");
  }

  document.addEventListener("DOMContentLoaded", function () {
    hardenQuickNpcModal();
    hardenCharacterBuilder();
    hardenCharacterSheetModal();
  });
})();
