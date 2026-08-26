import { CLASS_RACE_ABILITIES, abilityKey, abilityScore, rollSucceeded, isAarakocraName, isArcherName, isBarbarianName, isDwarfAdventurerName, isDwarfName, isElfName, isHalfElfName, isGnomeName, isHalfGiantName, isHalflingName, normalizeAbilityName } from "./model.js";
import { normalizeEffect } from "../effect-manager/model.js";
import { darkSunPacks } from "../../integrations/dark-sun.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const SOCKET = `module.${MODULE_ID}`;
const handledAssassinationRequests = new Set();

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
function actorLevel(actor) {
  const classItem = actor?.items?.find?.((item) => item.type === "class");
  const candidates = [actor?.system?.level?.value, actor?.system?.level, actor?.system?.attributes?.level, actor?.system?.nivel, classItem?.system?.level, classItem?.system?.nivel]
    .map(Number).filter((value) => Number.isFinite(value) && value > 0);
  return Math.max(1, ...candidates);
}
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}
function isMagicalWeaponName(name) {
  return /\+\s*\d|amaldi[cç]|matadora|cancelamento|mágic|magic/i.test(String(name ?? ""));
}
function abilityRollHtml(key, level) {
  const ability = CLASS_RACE_ABILITIES[key];
  const score = abilityScore(key, level);
  return `<div class="od2qdv-academic-roll"><span class="od2qdv-ability-label">${escapeHtml(ability.label)}:</span> <a class="od2qdv-academic-roll-button" data-academic-ability="${key}" title="Rolar teste de ${escapeHtml(ability.label)}"><i class="fa-light fa-dice-d6 fa-sm"></i>&nbsp;1-${score} em 1d6</a></div>`;
}

async function promptAssassinationDV() {
  const content = '<form><div class="form-group"><label>DV do alvo</label><input name="dv" type="number" min="0" step="1" value="1"></div></form>';
  if (Number(game.release?.generation ?? 13) >= 14) return foundry.applications.api.DialogV2.prompt({ window: { title: "Assassinato" }, content, ok: { label: "Rolar", callback: (_event, button) => Number(button.form.elements.dv.value) } });
  return Dialog.prompt({ title: "Assassinato", content, label: "Rolar", callback: (html) => Number(html[0].querySelector('[name="dv"]').value), rejectClose: false });
}

async function rollAbility(actor, key, fromSocket = false, requestedLevel = null) {
  const ability = CLASS_RACE_ABILITIES[key];
  if (!ability) return;
  const effectiveLevel = Number(requestedLevel) > 0 ? Number(requestedLevel) : actorLevel(actor);
  let score = abilityScore(key, effectiveLevel);
  let automaticFailure = false;
  if (key === "assassination") {
    if (!game.user.isGM && !fromSocket) {
      const gm = [...(game.users ?? [])].find((user) => user.active && user.isGM);
      if (!gm) return ui.notifications.warn("Não há Mestre ativo para realizar a rolagem de Assassinato.");
      const requestId = foundry.utils.randomID();
      const requestedLevel = actorLevel(actor);
      console.log(`${MODULE_ID} | Assassinato solicitado pelo jogador`, { requestId, actor: actor.name, assassinLevel: requestedLevel });
      game.socket.emit(SOCKET, { type: "assassinationRequest", requestId, actorId: actor.id, actorUuid: actor.uuid, assassinLevel: requestedLevel, userId: game.user.id });
      ui.notifications.info("Solicitação de Assassinato enviada ao Mestre.");
      return;
    }
    const targetDV = await promptAssassinationDV();
    if (targetDV === null || targetDV === undefined || Number.isNaN(targetDV)) return;
    const assassinDV = effectiveLevel;
    const difference = Number(targetDV) - assassinDV;
    console.log(`${MODULE_ID} | Cálculo de Assassinato`, { actor: actor.name, targetDV: Number(targetDV), assassinLevel: assassinDV, difference, baseChance: abilityScore(key, assassinDV) });
    if (difference > 3) {
      automaticFailure = true;
      score = 0;
    }
    else if (difference > 0) score = Math.max(0, score - difference);
  }
  const roll = new Roll("1d6");
  if (Number(game.release?.generation ?? 13) >= 14) await roll.evaluate();
  else await roll.roll({ async: true });
  const success = !automaticFailure && rollSucceeded(roll.total, score);
  if (key === "assassination") console.log(`${MODULE_ID} | Resultado de Assassinato`, { actor: actor.name, roll: roll.total, chance: score, automaticFailure, success });
  const resultKey = success ? "olddragon2e.chat.success" : "olddragon2e.chat.failure";
  const result = `<strong class="${success ? "success" : "failure"}">${escapeHtml(game.i18n.localize(resultKey))}</strong>`;
  const special = key === "evaluators" && roll.total === 5 ? "A avaliação se dará 25% abaixo do valor real." : key === "evaluators" && roll.total === 6 ? "A avaliação será 25% acima do valor real." : "";
  const flavor = `<div class="title">${escapeHtml(game.i18n.localize("olddragon2e.chat.test"))} <strong>${escapeHtml(ability.label)}</strong> (${score})</div><p class="result">${result}</p>${special ? `<p>${escapeHtml(special)}</p>` : ""}`;
  // Habilidades de raça e classe são testes reservados ao Mestre.
  await roll.toMessage({ flavor, speaker: ChatMessage.getSpeaker({ actor }) }, { rollMode: "blindroll" });
  if (key === "assassination" && !success) await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), whisper: (game.users ?? []).filter((user) => user.isGM).map((user) => user.id), content: "O alvo não recebe dano e fica imune a um novo Assassinato até o Assassino evoluir para o próximo nível." });
}

function effectTemplate({ name, origin, association, key, mode, value, condition }) {
  return normalizeEffect({
    id: `auto-${normalizeAbilityName(name).replace(/[^a-z0-9]+/g, "-")}`, name, origin, association, icon: "icons/svg/aura.svg", enabled: true,
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

function barbarianEffects(actor) {
  const cls = actor.items?.find?.((item) => item.type === "class");
  const weapon = actor.getFlag(MODULE_ID, "barbarianMasteryWeapon");
  if (!isBarbarianName(actorClassName(actor)) || !weapon) return [];
  return [effectTemplate({ name: "Bárbaro: Maestria em armas", origin: "classe", association: { type: "class", id: cls?.id, name: cls?.name || "Bárbaro" }, key: "damage", mode: "add", value: 1, condition: { left: "attack.itemNamed", name: weapon } })];
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
  const managedNames = new Set(["Anão: Inimigos", "Anão Aventureiro: Bastião Racial(6)", "Anão Aventureiro: Arma Racial", "Elfo: Arma Racial", "Elfo: Imunidade", "Meio-Elfo: Imunidade", "Arqueiro: Maestria em Armas(1)", "Arqueiro: Puxada Aprimorada(3)", "Halfling: Furtivos", "Halfling: Bons de mira", "Halfling: Pequenos", "Meio-Gigante: Força descomunal", "Meio-Gigante: Força descomunal (Dano)", "Aarakocra: Nascidos dos Céus", "Aarakocra: Nascidos dos Céus (Dano)", "Bárbaro: Maestria em armas"]);
  const current = actor.getFlag(MODULE_ID, "effects") || [];
  const desired = [...dwarfEffects(actor), ...elfAndArcherEffects(actor), ...gnomeAndHalflingEffects(actor), ...barbarianEffects(actor)];
  const retained = current.filter((effect) => !managedNames.has(effect.name));
  const next = [...retained, ...desired].filter((effect, index, list) => list.findIndex((entry) => entry.id === effect.id || (entry.name && entry.name === effect.name)) === index);
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

async function chooseArcherMastery(actor, allWeapons = false) {
  const matches = (name) => allWeapons || /arco|besta/i.test(name);
  const names = [...(actor.items ?? [])].filter((item) => item.type === "weapon" && matches(item.name)).map((item) => ({ name: item.name, label: item.name, source: 'srd' }));
  const isWeaponPack = (pack) => {
    const metadata = pack.metadata ?? {};
    const text = `${metadata.name ?? ""} ${metadata.label ?? ""} ${metadata.path ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    return /(^|[^a-z])(armas|weapons)([^a-z]|$)/.test(text) && !/magia|magic|item.?magico/.test(text);
  };
  const packs = [...(game.packs ?? [])].filter((pack) => {
    if (pack.documentName !== "Item") return false;
    const packageName = pack.metadata?.packageName ?? pack.metadata?.package;
    const meta = pack.metadata ?? {};
    const packText = `${meta.name ?? ""} ${meta.label ?? ""} ${meta.path ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    // Somente o compêndio SRD Equipamentos/Armas; nunca itens mágicos ou outros packs.
    const exactSrd = packageName === game.system.id
      && (meta.name === 'equipment' || /equipamentos/.test(packText) || /(^|[^a-z])armas([^a-z]|$)/.test(packText))
      && !/magia|magic|item.?magico/.test(packText);
    return exactSrd;
  });
  // O módulo de Athas mantém compêndios separados (incluindo "Armas de Dark Sun"),
  // mas nem sempre publica o nome da pasta no metadata. O tipo do documento
  // será filtrado abaixo, portanto é seguro consultar todos os packs de itens dele.
  // O módulo de Athas pode registrar a pasta "Armas de Dark Sun" apenas no
  // índice interno; consultamos seus packs de itens e filtramos estritamente
  // pelos documentos do tipo arma abaixo.
  for (const pack of darkSunPacks("Item")) if (!packs.includes(pack)) packs.push(pack);
  for (const pack of packs) {
    const index = await pack.getIndex({ fields: ["type"] });
    const documents = index.some((entry) => entry.type === "weapon") ? index : (await pack.getDocuments()).map((document) => ({ _id: document.id, name: document.name, type: document.type }));
    const isDarkSun = /dark[- ]?sun|darksun/i.test(String(pack.metadata?.packageName ?? pack.metadata?.package ?? pack.metadata?.label ?? ""));
    names.push(...documents.filter((entry) => entry.type === "weapon" && matches(entry.name) && !isMagicalWeaponName(entry.name)).map((entry) => ({ name: entry.name, label: entry.name, source: isDarkSun ? 'darkSun' : 'srd' })));
  }
  const choices = [...new Map(names.map((entry) => [`${entry.source}:${entry.name.toLocaleLowerCase("pt-BR")}`, entry])).values()].sort((a, b) => a.label.localeCompare(b.label));
  if (!choices.length) return ui.notifications.warn(allWeapons ? "Nenhuma arma foi encontrada nos compêndios de equipamentos." : "Nenhum arco ou besta foi encontrado no SRD.");
  const srd = choices.filter((entry) => entry.source === 'srd');
  const dark = choices.filter((entry) => entry.source === 'darkSun');
  const select = (name, label, list, other) => `<div class="form-group"><label>${label}</label><select name="${name}" onchange="if(this.value)this.form.elements.${other} && (this.form.elements.${other}.value='')"><option value="">— Nenhuma —</option>${list.map((entry) => `<option value="${escapeHtml(entry.name)}">${escapeHtml(entry.label)}</option>`).join('')}</select></div>`;
  const content = `${select('srdWeapon', 'Armas SRD', srd, 'darkWeapon')}${dark.length && darkSunPacks('Item').length ? select('darkWeapon', 'Armas Dark Sun', dark, 'srdWeapon') : ''}`;
  const selected = Number(game.release?.generation ?? 13) >= 14
    ? await foundry.applications.api.DialogV2.prompt({ window: { title: "Escolher arma de maestria" }, content, ok: { label: "Confirmar", callback: (_event, button) => button.form.elements.srdWeapon.value || button.form.elements.darkWeapon?.value || '' } })
    : await Dialog.prompt({ title: "Escolher arma de maestria", content: `<form>${content}</form>`, label: "Confirmar", callback: (html) => html[0].querySelector('[name="srdWeapon"]').value || html[0].querySelector('[name="darkWeapon"]')?.value || '', rejectClose: false });
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
  const level = actorLevel(actor);
  for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id], .character-tab-race .race-abilities li.item[data-item-id]")) {
    const key = abilityKey(actor.items?.get?.(row.dataset.itemId)?.name);
    const isRaceAbility = Boolean(row.closest(".character-tab-race"));
    if (key === "reputation" && isRaceAbility) continue;
    if (key === "assassination" && isRaceAbility) continue;
    if (!key) continue;
    const current = row.querySelector(`[data-academic-ability="${key}"]`);
    if (current) {
      const score = abilityScore(key, level);
      current.innerHTML = `<i class="fa-light fa-dice-d6 fa-sm"></i>&nbsp;1-${score} em 1d6`;
      current.title = `Rolar teste de ${CLASS_RACE_ABILITIES[key].label}`;
      continue;
    }
    (row.querySelector(":scope > .ability, :scope > .ability-header") ?? row.firstElementChild ?? row).insertAdjacentHTML("afterend", abilityRollHtml(key, level));
  }
  if (isBarbarianName(actorClassName(actor))) {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      const name = normalizeAbilityName(ability?.name);
      if (name.includes("talentos selvagens")) {
        for (const key of ["climb", "naturalCamouflage"]) if (!row.querySelector(`[data-academic-ability="${key}"]`)) (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", abilityRollHtml(key, level));
      }
      if (name.includes("surpresa selvagem") && !row.querySelector('[data-academic-ability="wildSurprise"]')) (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", abilityRollHtml("wildSurprise", level));
      if (name.includes("maestria em arma") && !row.querySelector("[data-barbarian-mastery-choice]")) {
        const selected = actor.getFlag(MODULE_ID, "barbarianMasteryWeapon") || "Não escolhida";
        (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-barbarian-mastery-choice><i class="fas fa-sword"></i> Arma de maestria: ${escapeHtml(selected)}</a></div>`);
      }
    }
  }
  if (isDwarfAdventurerName(actorClassName(actor))) {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (normalizeAbilityName(ability?.name) !== "arma racial" || row.querySelector("[data-racial-weapon-choice]")) continue;
      const selected = actor.getFlag(MODULE_ID, "dwarfRacialWeapon") || "Não escolhida";
      (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-racial-weapon-choice><i class="fas fa-hammer"></i> Arma racial: ${escapeHtml(selected)}</a></div>`);
    }
  }
  if (isArcherName(actorClassName(actor))) {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (normalizeAbilityName(ability?.name) !== "maestria em armas" || row.querySelector("[data-archer-mastery-choice]")) continue;
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
    const barbarianMasteryChoice = event.target.closest?.("[data-barbarian-mastery-choice]");
    if (!button && !weaponChoice && !masteryChoice && !barbarianMasteryChoice) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    if (weaponChoice) { await chooseRacialWeapon(actor); app.render(false); return; }
    if (masteryChoice) { await chooseArcherMastery(actor); app.render(false); return; }
    if (barbarianMasteryChoice) {
      if (actor.getFlag(MODULE_ID, "barbarianMasteryWeapon") && !game.user.isGM) { ui.notifications.warn("A arma de maestria já foi escolhida. Somente o Mestre pode alterá-la."); return; }
      await chooseArcherMastery(actor, true);
      await actor.setFlag(MODULE_ID, "barbarianMasteryWeapon", actor.getFlag(MODULE_ID, "archerMasteryWeapon"));
      app.render(false); return;
    }
    button.classList.add("rolling");
    try { await rollAbility(actor, button.dataset.academicAbility); } finally { button.classList.remove("rolling"); }
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
  game.socket.on(SOCKET, async (payload) => {
    if (payload?.type !== "assassinationRequest" || !game.user.isGM) return;
    if (payload.requestId && handledAssassinationRequests.has(payload.requestId)) return;
    if (payload.requestId) handledAssassinationRequests.add(payload.requestId);
    console.log(`${MODULE_ID} | Requisição de Assassinato recebida`, payload);
    const actor = game.actors?.get(payload.actorId) ?? (payload.actorUuid ? await fromUuid(payload.actorUuid) : null);
    if (actor) await rollAbility(actor, "assassination", true, payload.assassinLevel);
  });
  if (isPrimaryActiveGM()) for (const actor of game.actors ?? []) if (actor.type === "character") syncDwarfEffects(actor);
  ensureDwarfEffectLibrary().catch((error) => console.error(`${MODULE_ID} | Falha ao criar efeitos de anão no compêndio`, error));
});
