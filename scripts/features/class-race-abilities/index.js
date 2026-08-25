import { ACADEMIC_ABILITIES, academicAbilityKey, academicAbilityScore, academicRollSucceeded, isAarakocraName, isArcherName, isDwarfAdventurerName, isDwarfName, isElfName, isHalfElfName, isGnomeName, isHalfGiantName, isHalflingName, normalizeAcademicName } from "./model.js";
import { normalizeEffect } from "../effect-manager/model.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";

function enabled() { return game.settings.get(MODULE_ID, "enableClassAbilities"); }
function isPrimaryActiveGM() {
  if (!game.user?.isGM) return false;
  const first = [...(game.users ?? [])].filter((user) => user.active && user.isGM).sort((a, b) => a.id.localeCompare(b.id))[0];
  return !first || first.id === game.user.id;
}
function rootElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return html?.element instanceof HTMLElement ? html.element : null;
}
function actorClassName(actor) {
  return actor?.system?.class?.name ?? actor?.items?.find?.((item) => item.type === "class")?.name ?? "";
}
function actorRaceName(actor) { return actor?.system?.race?.name ?? actor?.items?.find?.((item) => item.type === "race")?.name ?? ""; }
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}
function abilityRollHtml(key, level) {
  const ability = ACADEMIC_ABILITIES[key];
  const score = academicAbilityScore(key, level);
  return `<div class="od2qdv-academic-roll"><a class="od2qdv-academic-roll-button" data-academic-ability="${key}" title="Rolar teste de ${escapeHtml(ability.label)}"><i class="fa-light fa-dice-d6 fa-sm"></i>&nbsp;1-${score} em 1d6</a></div>`;
}

async function rollAcademicAbility(actor, key) {
  const ability = ACADEMIC_ABILITIES[key];
  if (!ability) return;
  const score = academicAbilityScore(key, actor.system?.level);
  const roll = new Roll("1d6");
  if (Number(game.release?.generation ?? 13) >= 14) await roll.evaluate();
  else await roll.roll({ async: true });
  const success = academicRollSucceeded(roll.total, score);
  const resultKey = success ? "olddragon2e.chat.success" : "olddragon2e.chat.failure";
  const result = `<strong class="${success ? "success" : "failure"}">${escapeHtml(game.i18n.localize(resultKey))}</strong>`;
  const special = key === "evaluators" && roll.total === 5 ? "A avaliação se dará 25% abaixo do valor real." : key === "evaluators" && roll.total === 6 ? "A avaliação será 25% acima do valor real." : "";
  const flavor = `<div class="title">${escapeHtml(game.i18n.localize("olddragon2e.chat.test"))} <strong>${escapeHtml(ability.label)}</strong> (${score})</div><p class="result">${result}</p>${special ? `<p>${escapeHtml(special)}</p>` : ""}`;
  // Habilidades de raça e classe são testes reservados ao Mestre.
  await roll.toMessage({ flavor, speaker: ChatMessage.getSpeaker({ actor }) }, { rollMode: "blindroll" });
}

function effectTemplate({ name, origin, association, key, mode, value, condition }) {
  return normalizeEffect({
    id: `auto-${normalizeAcademicName(name).replace(/[^a-z0-9]+/g, "-")}`, name, origin, association, icon: "icons/svg/aura.svg", enabled: true,
    duration: { type: "permanent" }, modifiers: [{ key, mode, value }],
    conditional: condition ? { enabled: true, trigger: "manual", flow: "if", left: condition.left, operator: condition.operator || "eq", right: condition.right || "boolean.true", number: condition.number || 0, conditionName: condition.name, resultAction: "applyEffect" } : { enabled: false }
  });
}

function dwarfEffects(actor) {
  const race = actor.items?.find?.((item) => item.type === "race");
  const characterClass = actor.items?.find?.((item) => item.type === "class");
  const effects = [];
  if (isDwarfName(actorRaceName(actor))) effects.push(effectTemplate({
    name: "Anão: Inimigos", origin: "raça", association: { type: "race", id: race?.id, name: race?.name || "Anão" },
    key: "attack", mode: "add", value: 2, condition: { left: "target.speciesNamed", name: "orc|ogro|hobgoblin" }
  }));
  if (isDwarfAdventurerName(actorClassName(actor)) && Number(actor.system?.level) >= 6) effects.push(effectTemplate({
    name: "Anão Aventureiro: Bastião Racial(6)", origin: "classe", association: { type: "class", id: characterClass?.id, name: characterClass?.name || "Anão Aventureiro" },
    key: "incoming.attack", mode: "reduce", value: 2, condition: { left: "target.speciesNamed", name: "orc|ogro|hobgoblin" }
  }));
  const weapon = actor.getFlag(MODULE_ID, "dwarfRacialWeapon");
  if (isDwarfAdventurerName(actorClassName(actor)) && ["Martelo", "Machado"].includes(weapon)) effects.push(effectTemplate({
    name: "Anão Aventureiro: Arma Racial", origin: "classe", association: { type: "class", id: characterClass?.id, name: characterClass?.name || "Anão Aventureiro" },
    key: "damage", mode: "add", value: 2, condition: { left: "attack.itemNamed", name: weapon.toLocaleLowerCase("pt-BR") }
  }));
  return effects;
}

function elfAndArcherEffects(actor) {
  const race = actor.items?.find?.((item) => item.type === "race");
  const characterClass = actor.items?.find?.((item) => item.type === "class");
  const effects = [];
  if (isElfName(actorRaceName(actor)) || isHalfElfName(actorRaceName(actor))) {
    const halfElf = isHalfElfName(actorRaceName(actor));
    effects.push(effectTemplate({ name: halfElf ? "Meio-Elfo: Imunidade" : "Elfo: Imunidade", origin: "raça", association: { type: "race", id: race?.id, name: race?.name || (halfElf ? "Meio-Elfo" : "Elfo") }, key: "immunity", mode: "add", value: "sono|paralisar|ghoul|carniçal" }));
  }
  const mastery = actor.getFlag(MODULE_ID, "archerMasteryWeapon");
  if (isArcherName(actorClassName(actor)) && mastery) effects.push(effectTemplate({ name: "Arqueiro: Maestria em Armas(1)", origin: "classe", association: { type: "class", id: characterClass?.id, name: characterClass?.name || "Arqueiro" }, key: "damage", mode: "add", value: 1, condition: { left: "attack.itemNamed", name: mastery } }));
  if (isArcherName(actorClassName(actor)) && Number(actor.system?.level) >= 3) effects.push(effectTemplate({ name: "Arqueiro: Puxada Aprimorada(3)", origin: "classe", association: { type: "class", id: characterClass?.id, name: characterClass?.name || "Arqueiro" }, key: "damage.strength", mode: "add", value: 1, condition: { left: "attack.weaponRanged", name: "arco|besta" } }));
  return effects;
}

function gnomeAndHalflingEffects(actor) {
  const race = actor.items?.find?.((item) => item.type === "race");
  const effects = [];
  if (isHalflingName(actorRaceName(actor))) {
    effects.push(effectTemplate({ name: "Halfling: Furtivos", origin: "raça", association: { type: "race", id: race?.id, name: race?.name || "Halfling" }, key: "rogue.stealth", mode: "add", value: 1, condition: { left: "rogue.has", name: "" } }));
    effects.push(effectTemplate({ name: "Halfling: Bons de mira", origin: "raça", association: { type: "race", id: race?.id, name: race?.name || "Halfling" }, key: "damage", mode: "add", value: 2, condition: { left: "attack.throwingBad", name: "" } }));
    effects.push(effectTemplate({ name: "Halfling: Pequenos", origin: "raça", association: { type: "race", id: race?.id, name: race?.name || "Halfling" }, key: "incoming.attack", mode: "reduce", value: 2, condition: { left: "target.size", operator: "gte", right: "number", number: 3 } }));
  }
  if (isHalfGiantName(actorRaceName(actor))) {
    effects.push(effectTemplate({ name: "Meio-Gigante: Força descomunal", origin: "raça", association: { type: "race", id: race?.id, name: race?.name || "Meio-Gigante" }, key: "test.difficulty", mode: "add", value: 1 }));
    effects.push(effectTemplate({ name: "Meio-Gigante: Força descomunal (Dano)", origin: "raça", association: { type: "race", id: race?.id, name: race?.name || "Meio-Gigante" }, key: "damage.dieStep", mode: "add", value: 1, condition: { left: "attack.weaponMelee" } }));
  }
  if (isAarakocraName(actorRaceName(actor))) {
    effects.push(effectTemplate({ name: "Aarakocra: Nascidos dos Céus", origin: "raça", association: { type: "race", id: race?.id, name: race?.name || "Aarakocra" }, key: "attack", mode: "add", value: 1, condition: { left: "attack.itemNamed", name: "dardo|lança" } }));
    effects.push(effectTemplate({ name: "Aarakocra: Nascidos dos Céus (Dano)", origin: "raça", association: { type: "race", id: race?.id, name: race?.name || "Aarakocra" }, key: "damage", mode: "add", value: 1, condition: { left: "attack.itemNamed", name: "dardo|lança" } }));
  }
  return effects;
}

async function syncDwarfEffects(actor) {
  if (!game.settings.get(MODULE_ID, "enableEffectManager")) return;
  const managedNames = new Set(["Anão: Inimigos", "Anão Aventureiro: Bastião Racial(6)", "Anão Aventureiro: Arma Racial", "Elfo: Arma Racial", "Elfo: Imunidade", "Meio-Elfo: Imunidade", "Arqueiro: Maestria em Armas(1)", "Arqueiro: Puxada Aprimorada(3)", "Halfling: Furtivos", "Halfling: Bons de mira", "Halfling: Pequenos", "Meio-Gigante: Força descomunal", "Meio-Gigante: Força descomunal (Dano)", "Aarakocra: Nascidos dos Céus", "Aarakocra: Nascidos dos Céus (Dano)"]);
  const current = actor.getFlag(MODULE_ID, "effects") || [];
  const desired = [...dwarfEffects(actor), ...elfAndArcherEffects(actor), ...gnomeAndHalflingEffects(actor)];
  const retained = current.filter((effect) => !managedNames.has(effect.name));
  const next = [...retained, ...desired];
  if (JSON.stringify(current) !== JSON.stringify(next)) await actor.setFlag(MODULE_ID, "effects", next);
}

async function chooseRacialWeapon(actor) {
  const content = '<div class="form-group"><label>Arma racial</label><select name="weapon"><option value="Martelo">Martelo</option><option value="Machado">Machado</option></select></div>';
  let selected;
  if (Number(game.release?.generation ?? 13) >= 14) {
    selected = await foundry.applications.api.DialogV2.prompt({ window: { title: "Escolher arma racial" }, content, ok: { label: "Confirmar", callback: (_event, button) => button.form.elements.weapon.value } });
  } else {
    selected = await Dialog.prompt({ title: "Escolher arma racial", content: `<form>${content}</form>`, label: "Confirmar", callback: (html) => html[0].querySelector('[name="weapon"]').value, rejectClose: false });
  }
  if (!selected) return;
  await actor.setFlag(MODULE_ID, "dwarfRacialWeapon", selected);
  await syncDwarfEffects(actor);
}

async function chooseArcherMastery(actor) {
  const names = [...(actor.items ?? [])].filter((item) => item.type === "weapon" && /arco|besta/i.test(item.name)).map((item) => item.name);
  for (const pack of game.packs ?? []) {
    if (pack.metadata?.name !== "equipment") continue;
    const index = await pack.getIndex();
    names.push(...index.filter((entry) => /arco|besta/i.test(entry.name)).map((entry) => entry.name));
  }
  const choices = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  if (!choices.length) return ui.notifications.warn("Nenhum arco ou besta foi encontrado no SRD.");
  const content = `<div class="form-group"><label>Arma de maestria</label><select name="weapon">${choices.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></div>`;
  const selected = Number(game.release?.generation ?? 13) >= 14
    ? await foundry.applications.api.DialogV2.prompt({ window: { title: "Escolher arma de maestria" }, content, ok: { label: "Confirmar", callback: (_event, button) => button.form.elements.weapon.value } })
    : await Dialog.prompt({ title: "Escolher arma de maestria", content: `<form>${content}</form>`, label: "Confirmar", callback: (html) => html[0].querySelector('[name="weapon"]').value, rejectClose: false });
  if (selected) { await actor.setFlag(MODULE_ID, "archerMasteryWeapon", selected); await syncDwarfEffects(actor); }
}

async function ensureDwarfEffectLibrary() {
  if (!isPrimaryActiveGM() || !game.settings.get(MODULE_ID, "enableEffectManager")) return;
  const api = game.od2Qdv?.effects;
  const pack = game.packs.get(`${MODULE_ID}.effects`);
  if (!api?.createLibraryEntry || !pack) return;
  const documents = await pack.getDocuments();
  const definitions = [
    ["Raça", effectTemplate({ name: "Anão: Inimigos", origin: "raça", association: { type: "race", name: "Anão" }, key: "attack", mode: "add", value: 2, condition: { left: "target.speciesNamed", name: "orc|ogro|hobgoblin" } })],
    ["Classe", effectTemplate({ name: "Anão Aventureiro: Bastião Racial(6)", origin: "classe", association: { type: "class", name: "Anão Aventureiro" }, key: "incoming.attack", mode: "reduce", value: 2, condition: { left: "target.speciesNamed", name: "orc|ogro|hobgoblin" } })],
    ["Raça", effectTemplate({ name: "Elfo: Imunidade", origin: "raça", association: { type: "race", name: "Elfo" }, key: "immunity", mode: "add", value: "sono|paralisar|ghoul|carniçal" })],
    ["Raça", effectTemplate({ name: "Meio-Elfo: Imunidade", origin: "raça", association: { type: "race", name: "Meio-Elfo" }, key: "immunity", mode: "add", value: "sono|paralisar|ghoul|carniçal" })],
    ["Classe", effectTemplate({ name: "Arqueiro: Puxada Aprimorada(3)", origin: "classe", association: { type: "class", name: "Arqueiro" }, key: "damage.strength", mode: "add", value: 1, condition: { left: "attack.weaponRanged", name: "arco|besta" } })],
    ["Raça", effectTemplate({ name: "Halfling: Bons de mira", origin: "raça", association: { type: "race", name: "Halfling" }, key: "damage", mode: "add", value: 2, condition: { left: "attack.throwingBad" } })],
    ["Raça", effectTemplate({ name: "Halfling: Pequenos", origin: "raça", association: { type: "race", name: "Halfling" }, key: "incoming.attack", mode: "reduce", value: 2, condition: { left: "target.size", operator: "gte", right: "number", number: 3 } })]
  ];
  for (const [folder, effect] of definitions) if (!documents.some((document) => document.name === effect.name)) await api.createLibraryEntry(effect, folder);
}

function enhanceAcademicAbilities(app, html) {
  if (!enabled()) return;
  const actor = app.actor ?? app.document;
  if (actor?.type !== "character" || !actor.isOwner) return;
  const root = rootElement(html);
  if (!root) return;
  const level = Number(actor.system?.level) || 1;
  for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id], .character-tab-race .race-abilities li.item[data-item-id]")) {
    const key = academicAbilityKey(actor.items?.get?.(row.dataset.itemId)?.name);
    const isRaceAbility = Boolean(row.closest(".character-tab-race"));
    if (key === "reputation" && isRaceAbility) continue;
    if (!key) continue;
    const current = row.querySelector(`[data-academic-ability="${key}"]`);
    if (current) {
      const score = academicAbilityScore(key, level);
      current.innerHTML = `<i class="fa-light fa-dice-d6 fa-sm"></i>&nbsp;1-${score} em 1d6`;
      current.title = `Rolar teste de ${ACADEMIC_ABILITIES[key].label}`;
      continue;
    }
    (row.querySelector(":scope > .ability, :scope > .ability-header") ?? row.firstElementChild ?? row).insertAdjacentHTML("afterend", abilityRollHtml(key, level));
  }
  if (isDwarfAdventurerName(actorClassName(actor))) {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (normalizeAcademicName(ability?.name) !== "arma racial" || row.querySelector("[data-racial-weapon-choice]")) continue;
      const selected = actor.getFlag(MODULE_ID, "dwarfRacialWeapon") || "Não escolhida";
      (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-racial-weapon-choice><i class="fas fa-hammer"></i> Arma racial: ${escapeHtml(selected)}</a></div>`);
    }
  }
  if (isArcherName(actorClassName(actor))) {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (normalizeAcademicName(ability?.name) !== "maestria em armas" || row.querySelector("[data-archer-mastery-choice]")) continue;
      const selected = actor.getFlag(MODULE_ID, "archerMasteryWeapon") || "Não escolhida";
      (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-archer-mastery-choice><i class="fas fa-bow-arrow"></i> Arma de maestria: ${escapeHtml(selected)}</a></div>`);
    }
  }
  if (root.dataset.od2qdvAcademicBound === "true") return;
  root.dataset.od2qdvAcademicBound = "true";
  root.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-academic-ability]");
    const weaponChoice = event.target.closest?.("[data-racial-weapon-choice]");
    const masteryChoice = event.target.closest?.("[data-archer-mastery-choice]");
    if (!button && !weaponChoice && !masteryChoice) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    if (weaponChoice) { await chooseRacialWeapon(actor); app.render(false); return; }
    if (masteryChoice) { await chooseArcherMastery(actor); app.render(false); return; }
    button.classList.add("rolling");
    try { await rollAcademicAbility(actor, button.dataset.academicAbility); } finally { button.classList.remove("rolling"); }
  }, true);
  syncDwarfEffects(actor).catch((error) => console.error(`${MODULE_ID} | Falha ao sincronizar habilidades de anão`, error));
}

Hooks.on("renderActorSheet", enhanceAcademicAbilities);
Hooks.on("renderActorSheetV2", enhanceAcademicAbilities);
Hooks.on("renderOD2CharacterSheet", enhanceAcademicAbilities);
Hooks.on("updateActor", (actor, changed, _options, userId) => {
  if (!enabled() || (userId && game.user?.id !== userId) || actor.type !== "character" || changed.flags?.[MODULE_ID]?.effects) return;
  if (changed.system && Object.prototype.hasOwnProperty.call(changed.system, "level")) syncDwarfEffects(actor);
});
for (const hook of ["createItem", "updateItem", "deleteItem"]) Hooks.on(hook, (item, ...args) => {
  const userId = [...args].reverse().find((value) => typeof value === "string");
  if (enabled() && (!userId || game.user?.id === userId) && item.parent?.type === "character" && ["class", "race"].includes(item.type)) syncDwarfEffects(item.parent);
});
Hooks.once("ready", () => {
  if (!enabled()) return;
  console.log(`${MODULE_ID} | Automações de habilidades de classe e raça ativas`);
  if (isPrimaryActiveGM()) for (const actor of game.actors ?? []) if (actor.type === "character") syncDwarfEffects(actor);
  ensureDwarfEffectLibrary().catch((error) => console.error(`${MODULE_ID} | Falha ao criar efeitos de anão no compêndio`, error));
});
