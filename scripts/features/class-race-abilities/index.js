import { CLASS_RACE_ABILITIES, abilityKey, abilityScore, rollSucceeded, profanadorTableResult, isAarakocraName, isArcherName, isBarbarianName, isDwarfAdventurerName, isDwarfName, isElfName, isHalfElfName, isGnomeName, isHalfGiantName, isHalflingName, normalizeAbilityName } from "./model.js";
import { normalizeEffect } from "../effect-manager/model.js";
import { darkSunPacks } from "../../integrations/dark-sun.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const SOCKET = `module.${MODULE_ID}`;
const handledAssassinationRequests = new Set();
const handledProfanationRequests = new Set();
const handledProfanadorSpellRequests = new Set();
const handledProfanadorSpellMessages = new Set();
const handledLayOnHandsMessages = new Set();
const previousCombatants = new WeakMap();
const cleanedImprovisedCombats = new Set();

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
function isBard(name) {
  return ["bardo", "bardo athasiano"].includes(normalizeAbilityName(name));
}
function isShaman(name) {
  return normalizeAbilityName(name).startsWith("xama");
}
function isCleric(name) { return normalizeAbilityName(name) === "clerigo" || normalizeAbilityName(name) === "clérigo"; }
function isTemplar(name) { return normalizeAbilityName(name).startsWith("templario"); }
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
function classAbilityName(actor, row) {
  const itemId = row?.dataset?.itemId;
  const item = actor?.items?.get?.(itemId)
    ?? [...(actor?.system?.class_abilities ?? [])].find((entry) => (entry._id ?? entry.id) === itemId);
  return item?.name ?? row?.querySelector?.(".ability strong")?.textContent?.replace(/:\s*$/, "") ?? "";
}
function abilityRollHtml(key, level) {
  const ability = CLASS_RACE_ABILITIES[key];
  const score = abilityScore(key, level);
  return `<div class="od2qdv-academic-roll"><span class="od2qdv-ability-label">${escapeHtml(ability.label)}:</span> <a class="od2qdv-academic-roll-button" data-academic-ability="${key}" title="Rolar teste de ${escapeHtml(ability.label)}"><i class="fa-light fa-dice-d6 fa-sm"></i>&nbsp;1-${score} em 1d6</a></div>`;
}

function abilityDocument(actor, abilityId) {
  return actor?.items?.get?.(abilityId) ?? null;
}

function profanationDates(actor, abilityId) {
  const itemDates = abilityDocument(actor, abilityId)?.getFlag?.(MODULE_ID, "profanationExecutions");
  if (Array.isArray(itemDates)) return itemDates.slice(-2);
  return (actor?.getFlag?.(MODULE_ID, "profanationExecutions")?.[abilityId] ?? []).slice(-2);
}

function profanationHistoryHtml(dates) {
  if (!dates.length) return "";
  const labels = dates.map((date) => {
    const parsed = new Date(date);
    return escapeHtml(Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString("pt-BR"));
  });
  return `<div class="od2qdv-profanation-history"><strong>Últimas execuções:</strong> ${labels.join(" · ")}</div>`;
}

function profanationMagicHtml(actor, abilityId) {
  return `<div class="od2qdv-academic-roll od2qdv-profanation-magic"><a class="od2qdv-academic-roll-button" data-profanation-magic data-ability-id="${escapeHtml(abilityId)}" title="Rolar Profanar Magia"><i class="fa-light fa-dice-d6 fa-sm"></i>&nbsp;Profanar Magia</a>${profanationHistoryHtml(profanationDates(actor, abilityId))}</div>`;
}

function cityFundsDates(actor, abilityId) {
  const itemDates = abilityDocument(actor, abilityId)?.getFlag?.(MODULE_ID, "cityFundsExecutions");
  if (Array.isArray(itemDates)) return itemDates.slice(-2);
  return (actor?.getFlag?.(MODULE_ID, "cityFundsExecutions")?.[abilityId] ?? []).slice(-2);
}

function cityFundsHistoryHtml(dates) {
  if (!dates.length) return "";
  const labels = dates.map((date) => {
    const parsed = new Date(date);
    return escapeHtml(Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString("pt-BR"));
  });
  return `<div class="od2qdv-city-funds-history"><strong>Últimas utilizações:</strong> ${labels.join(" · ")}</div>`;
}

function cityFundsHtml(actor, abilityId) {
  return `<div class="od2qdv-academic-roll od2qdv-city-funds"><a class="od2qdv-academic-roll-button" data-city-funds data-ability-id="${escapeHtml(abilityId)}" title="Utilizar Fundos"><i class="fa-light fa-coins fa-sm"></i>&nbsp;Utilizar Fundos</a>${cityFundsHistoryHtml(cityFundsDates(actor, abilityId))}</div>`;
}

async function saveProfanationDate(actor, abilityId) {
  const dates = [...profanationDates(actor, abilityId), new Date().toISOString()].slice(-2);
  const item = abilityDocument(actor, abilityId);
  if (item?.setFlag) await item.setFlag(MODULE_ID, "profanationExecutions", dates);
  else await actor.setFlag(MODULE_ID, "profanationExecutions", { ...(actor.getFlag(MODULE_ID, "profanationExecutions") ?? {}), [abilityId]: dates });
  return dates;
}

async function saveCityFundsDate(actor, abilityId) {
  const dates = [...cityFundsDates(actor, abilityId), new Date().toISOString()].slice(-2);
  const item = abilityDocument(actor, abilityId);
  if (item?.setFlag) await item.setFlag(MODULE_ID, "cityFundsExecutions", dates);
  else await actor.setFlag(MODULE_ID, "cityFundsExecutions", { ...(actor.getFlag(MODULE_ID, "cityFundsExecutions") ?? {}), [abilityId]: dates });
  return dates;
}

function normalizeText(value) { return normalizeAbilityName(value); }

async function profanationTable() {
  // darkSunPacks já filtra o módulo pela versão mínima e mantém o Dark Sun opcional.
  const pack = darkSunPacks("RollTable").find((entry) => normalizeText(entry.metadata?.name ?? entry.metadata?.label) === "tabelas");
  if (!pack) return null;
  const documents = await pack.getDocuments();
  return documents.find((table) => normalizeText(table.name) === "efeitos de profanacao de magia")
    ?? documents.find((table) => normalizeText(table.name).includes("efeitos de profanacao de magia"));
}

async function promptProfanationSpellLevel() {
  const content = '<form><div class="form-group"><label>Nível da magia utilizada</label><input name="level" type="number" min="1" max="9" step="1" value="1" required></div></form>';
  const level = Number(game.release?.generation ?? 13) >= 14
    ? await foundry.applications.api.DialogV2.prompt({ window: { title: "Profanar Magia" }, content, ok: { label: "Aplicar", callback: (_event, button) => Number(button.form.elements.level.value) } })
    : await Dialog.prompt({ title: "Profanar Magia", content, label: "Aplicar", callback: (html) => Number(html[0].querySelector('[name="level"]').value), rejectClose: false });
  return Number.isInteger(level) && level >= 1 && level <= 9 ? level : null;
}

function tokenDistance(origin, token) {
  try {
    const distance = Number(canvas.grid.measureDistance(origin.center, token.center));
    if (Number.isFinite(distance)) return distance;
  } catch { /* fallback */ }
  const dx = Number(token.center?.x) - Number(origin.center?.x);
  const dy = Number(token.center?.y) - Number(origin.center?.y);
  return (Math.hypot(dx, dy) / (Number(canvas.grid?.size) || 100)) * (Number(canvas.scene?.grid?.distance) || 5);
}

async function rollProfanationMagic(actor, abilityId, fromSocket = false) {
  if (!actor || !game.user.isGM) {
    if (!game.user.isGM && !fromSocket) {
      const gm = [...(game.users ?? [])].find((user) => user.active && user.isGM);
      if (!gm) return ui.notifications.warn("Não há Mestre ativo para realizar Profanar Magia.");
      const requestId = foundry.utils.randomID();
      game.socket.emit(SOCKET, { type: "profanationMagicRequest", requestId, actorId: actor.id, actorUuid: actor.uuid, abilityId, userId: game.user.id });
      ui.notifications.info("Solicitação de Profanar Magia enviada ao Mestre.");
    }
    return;
  }
  const table = await profanationTable();
  if (!table) return ui.notifications.error("A tabela 'Efeitos de Profanação de Magia' do módulo Dark Sun não foi encontrada.");
  const draw = await table.draw({ displayChat: true, rollMode: "roll" });
  await saveProfanationDate(actor, abilityId);
  if (Number(draw?.roll?.total) !== 6) return;
  const spellLevel = await promptProfanationSpellLevel();
  if (!spellLevel) return;

  const origin = actor.getActiveTokens?.()[0] ?? null;
  const units = String(canvas?.scene?.grid?.units ?? "").toLowerCase();
  const radius = /m|metro/.test(units) ? 0.75 : 2.5; // raio de 0,75 m (aprox. 2,5 ft)
  const damage = 3 * spellLevel;
  const targets = new Map([[actor.uuid, actor]]);
  if (origin && canvas?.tokens) {
    for (const token of canvas.tokens.placeables) if (token.actor && tokenDistance(origin, token) <= radius) targets.set(token.actor.uuid, token.actor);
    if (canvas.scene?.createEmbeddedDocuments) await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
      t: "circle", user: game.user.id, x: origin.center.x, y: origin.center.y, distance: radius, direction: 0, angle: 360, width: 0,
      borderColor: "#8b0000", fillColor: "#d32f2f", flags: { [MODULE_ID]: { profanationMagic: true } }
    }]);
  }
  const affected = [];
  for (const target of targets.values()) {
    const current = Number(target.system?.hp?.value ?? 0);
    await target.update({ "system.hp.value": Math.max(0, current - damage) });
    affected.push(target.name);
  }
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<strong>Profanar Magia — efeito 6</strong><p>Magia de ${spellLevel}º nível: ${damage} pontos de dano em: ${affected.map(escapeHtml).join(", ") || "nenhum ator"}.</p>` });
}

function spellLevel(item) {
  return ["arcane", "divine", "necromancer", "illusionist"].map((key) => Number(item?.system?.[key])).find((level) => Number.isInteger(level) && level >= 1 && level <= 9) ?? null;
}

function spellMessageData(message, html = null) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(message?.content ?? "");
  const renderedSpell = rootElement(html)?.querySelector?.(".spell");
  const spell = renderedSpell ?? wrapper.querySelector?.(".spell");
  return {
    ownerId: spell?.dataset?.ownerId,
    itemId: spell?.dataset?.itemId,
    name: spell?.querySelector?.(".title strong")?.textContent?.trim()
  };
}

function spellItemFromMessage(actor, message) {
  const data = spellMessageData(message);
  return actor?.items?.get?.(data.itemId) ?? [...(actor?.items ?? [])].find((item) => item.type === "spell" && item.name === data.name);
}

async function promptVitalDrain(actor) {
  const level = actorLevel(actor);
  if (level < 3) return "none";
  const content = `<p><strong>Drenar energia vital?</strong> Este efeito aumenta para 2 chances em 6 de recuperar a magia utilizada e reduz 3 PV do Profanador.</p>${level >= 6 ? '<p><strong>Drenar energia vital aprimorada?</strong> Este efeito aumenta para 3 chances em 6 de recuperar a magia utilizada e reduz 6 PV do Profanador.</p>' : ""}`;
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (Number(game.release?.generation ?? 13) >= 14 && DialogV2) return DialogV2.wait({
    window: { title: "Drenar energia vital" }, content,
    buttons: [
      { action: "none", icon: "fa-solid fa-times", label: "Não drenar", default: true, callback: () => "none" },
      { action: "vital", icon: "fa-solid fa-heart-crack", label: "Drenar energia vital", callback: () => "vital" },
      ...(level >= 6 ? [{ action: "improved", icon: "fa-solid fa-skull", label: "Drenar energia vital aprimorada", callback: () => "improved" }] : [])
    ], close: () => "none"
  });
  return new Promise((resolve) => new Dialog({
    title: "Drenar energia vital", content,
    buttons: {
      none: { icon: '<i class="fas fa-times"></i>', label: "Não drenar", callback: () => resolve("none") },
      vital: { icon: '<i class="fas fa-heart-crack"></i>', label: "Drenar energia vital", callback: () => resolve("vital") },
      ...(level >= 6 ? { improved: { icon: '<i class="fas fa-skull"></i>', label: "Drenar energia vital aprimorada", callback: () => resolve("improved") } } : {})
    }, default: "none", close: () => resolve("none")
  }).render(true));
}

async function recoverUsedSpell(item) {
  const spellFlags = foundry.utils.deepClone(item.getFlag?.("olddragon2e", "spell") ?? {});
  const uses = { ...(spellFlags["daily-uses"] ?? {}) };
  const usedSlot = Object.keys(uses).filter((key) => uses[key] === true).sort((a, b) => Number(b) - Number(a))[0];
  if (!usedSlot) return false;
  uses[usedSlot] = false;
  await item.update({ "flags.olddragon2e.spell.daily-uses": uses });
  return true;
}

async function triggerProfanadorSpell(actor, item, drainMode = "none") {
  if (!actor || !item || !normalizeAbilityName(actorClassName(actor)).startsWith("profanador")) return;
  const level = spellLevel(item);
  if (!level) return;
  const mode = drainMode === "improved" && actorLevel(actor) >= 6 ? "improved" : drainMode === "vital" && actorLevel(actor) >= 3 ? "vital" : "none";
  const drainDamage = mode === "improved" ? 6 : mode === "vital" ? 3 : 0;
  if (drainDamage) {
    const currentHp = Number(actor.system?.hp?.value ?? 0);
    await actor.update({ "system.hp.value": Math.max(0, currentHp - drainDamage) });
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<strong>Profanação</strong><p>A vegetação e o solo ao seu redor é consumida e se transforma em cinzas.</p><p>O raio de destruição ao redor do profanador é igual ao nível da magia conjurada vezes 3 metros: <strong>${level * 3} m</strong>.</p>`,
    flags: { [MODULE_ID]: { profanadorSpellEffect: true } }
  });
  const table = await profanationTable();
  if (!table) return ui.notifications.warn("A tabela de efeitos de profanação requer o módulo Dark Sun 1.0.7 ou superior.");
  const naturalRoll = new Roll("1d6");
  if (Number(game.release?.generation ?? 13) >= 14) await naturalRoll.evaluate();
  else await naturalRoll.roll({ async: true });
  const effectiveTotal = profanadorTableResult(naturalRoll.total, mode);
  let tableRoll = naturalRoll;
  if (effectiveTotal !== Number(naturalRoll.total)) {
    tableRoll = new Roll(String(effectiveTotal));
    if (Number(game.release?.generation ?? 13) >= 14) await tableRoll.evaluate();
    else await tableRoll.roll({ async: true });
  }
  await table.draw({ roll: tableRoll, displayChat: true, rollMode: "roll" });
  const recovered = effectiveTotal === 1 ? await recoverUsedSpell(item) : false;
  if (mode !== "none" || recovered) {
    const modeLabel = mode === "improved" ? "Drenar energia vital aprimorada" : mode === "vital" ? "Drenar energia vital" : "Profanação";
    const conversion = effectiveTotal !== Number(naturalRoll.total) ? ` O resultado natural ${naturalRoll.total} foi considerado como 1.` : "";
    const recovery = recovered ? ` A magia <strong>${escapeHtml(item.name)}</strong> foi recuperada.` : effectiveTotal === 1 ? " Não foi possível localizar o uso consumido da magia." : "";
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<strong>${modeLabel}</strong><p>${drainDamage ? `${drainDamage} PV foram consumidos.` : ""}${conversion}${recovery}</p>`, flags: { [MODULE_ID]: { profanadorSpellEffect: true } } });
  }
}

async function handleProfanadorSpellMessage(message, html = null) {
  if (!enabled() || message?.getFlag?.(MODULE_ID, "profanadorSpellEffect")) return;
  if (message.id && handledProfanadorSpellMessages.has(message.id)) return;
  const data = spellMessageData(message, html);
  if (!data.itemId && !data.name) return;
  // Tokens não vinculados podem ter classe e itens diferentes do ator-base.
  // A mensagem contém ambos; priorizar o ator sintético que efetivamente conjurou.
  const tokenActor = message.speaker?.token
    ? canvas?.tokens?.get(message.speaker.token)?.actor
      ?? game.scenes?.get(message.speaker.scene)?.tokens?.get(message.speaker.token)?.actor
    : null;
  const actor = tokenActor
    ?? game.actors?.get(message.speaker?.actor)
    ?? game.actors?.get(data.ownerId);
  const item = spellItemFromMessage(actor, message);
  if (!actor || !item || !normalizeAbilityName(actorClassName(actor)).startsWith("profanador")) return;
  const messageUserId = typeof message.user === "string" ? message.user : message.user?.id ?? message.userId;
  if (messageUserId && messageUserId !== game.user.id) return;
  if (message.id) handledProfanadorSpellMessages.add(message.id);
  const drainMode = await promptVitalDrain(actor);
  if (game.user.isGM) {
    if (isPrimaryActiveGM()) await triggerProfanadorSpell(actor, item, drainMode);
    return;
  }
  const requestId = foundry.utils.randomID();
  game.socket.emit(SOCKET, { type: "profanadorSpellRequest", requestId, actorUuid: actor.uuid, spellId: item.id, messageId: message.id, drainMode, userId: game.user.id });
}

function messageStrongText(message) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(message?.content ?? "");
  return wrapper.querySelector?.(".title strong")?.textContent?.trim() ?? "";
}

function speakerActor(message) {
  return message?.speaker?.token
    ? canvas?.tokens?.get(message.speaker.token)?.actor
      ?? game.scenes?.get(message.speaker.scene)?.tokens?.get(message.speaker.token)?.actor
    : null;
}

function isLayOnHandsName(name) {
  return normalizeAbilityName(name) === "cura pelas maos";
}

function activeHealingTargets(caster) {
  const targets = new Map();
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (!token.actor?.system?.hp) continue;
    targets.set(token.actor.uuid, { actor: token.actor, label: token.name ?? token.actor.name });
  }
  if (!targets.size) for (const actor of game.actors ?? []) if (actor.system?.hp && actor.type !== "vehicle") targets.set(actor.uuid, { actor, label: actor.name });
  if (caster?.system?.hp && !targets.has(caster.uuid)) targets.set(caster.uuid, { actor: caster, label: caster.name });
  return [...targets.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

async function promptLayOnHandsTarget(caster) {
  const targets = activeHealingTargets(caster);
  if (!targets.length) return null;
  const options = targets.map(({ actor, label }) => `<option value="${escapeHtml(actor.uuid)}">${escapeHtml(label)}</option>`).join("");
  const content = `<form><div class="form-group"><label>Alvo da Cura pelas Mãos</label><select name="target">${options}</select></div></form>`;
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (Number(game.release?.generation ?? 13) >= 14 && DialogV2) return DialogV2.prompt({ window: { title: "Cura pelas Mãos" }, content, ok: { label: "Curar", callback: (_event, button) => button.form.elements.target.value } });
  return Dialog.prompt({ title: "Cura pelas Mãos", content, label: "Curar", callback: (html) => html[0].querySelector('[name="target"]').value, rejectClose: false });
}

async function applyLayOnHands(caster, targetUuid) {
  const target = game.actors?.get(targetUuid) ?? await fromUuid(targetUuid).catch(() => null);
  if (!caster || !target?.system?.hp) return;
  const before = Number(target.system.hp.value ?? 0);
  const maximum = Number(target.system.hp.max ?? before);
  const amount = Math.max(0, Math.min(actorLevel(caster), maximum - before));
  if (amount) await target.update({ "system.hp.value": before + amount });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster }), content: `<strong>Cura pelas Mãos</strong><p>${escapeHtml(target.name)} recuperou ${amount} PV (nível ${actorLevel(caster)} do Paladino).</p>` });
}

async function handleLayOnHandsMessage(message) {
  if (!enabled() || message?.getFlag?.(MODULE_ID, "layOnHandsResult") || !isLayOnHandsName(messageStrongText(message))) return;
  if (message.id && handledLayOnHandsMessages.has(message.id)) return;
  const messageUserId = typeof message.user === "string" ? message.user : message.user?.id ?? message.userId;
  if (messageUserId && messageUserId !== game.user.id) return;
  const caster = speakerActor(message) ?? game.actors?.get(message.speaker?.actor);
  if (!caster || normalizeAbilityName(actorClassName(caster)) !== "paladino") return;
  if (message.id) handledLayOnHandsMessages.add(message.id);
  const targetUuid = await promptLayOnHandsTarget(caster);
  if (!targetUuid) return;
  if (game.user.isGM) {
    if (isPrimaryActiveGM()) await applyLayOnHands(caster, targetUuid);
    return;
  }
  game.socket.emit(SOCKET, { type: "layOnHandsRequest", requestId: foundry.utils.randomID(), casterUuid: caster.uuid, targetUuid, userId: game.user.id });
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
  if (key === "turnUndead") return rollTurnUndead(actor, effectiveLevel);
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

async function rollPatrolConvocation(actor) {
  const roll = new Roll("1d4");
  if (Number(game.release?.generation ?? 13) >= 14) await roll.evaluate();
  else await roll.roll({ async: true });
  const count = Number(roll.total) || 0;
  const soldiers = count === 1 ? "soldado templário" : "soldados templários";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [roll],
    content: `<strong>Convocar Patrulha</strong><p>Convocado ${count} ${soldiers} de sua cidade-estado, de qualquer nível menor que o seu.</p><p>Esses soldados não podem deixar suas cidades sem a permissão do rei feiticeiro.</p><p>Os Templários só poderão solicitar ajuda novamente quando voltarem.</p><p>Quando os soldados estão com os Templários, eles são como mercenários.</p>`
  });
}

async function rollCityFunds(actor, abilityId) {
  const roll = new Roll("1d10");
  if (Number(game.release?.generation ?? 13) >= 14) await roll.evaluate();
  else await roll.roll({ async: true });
  const result = (Number(roll.total) || 0) * 100 * actorLevel(actor);
  const currentPo = Math.max(0, Math.trunc(Number(actor.system?.economy?.gp) || 0));
  await actor.update({ "system.economy.gp": currentPo + result });
  await saveCityFundsDate(actor, abilityId);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [roll],
    content: `<strong>Utilizar Fundos</strong><p>O Templário conseguiu <strong>${result}</strong> moedas de ouro. Poucas perguntas são feitas quando o ouro é requisitado, desde que nenhuma tentativa seja feita para retirar fundos mais do que uma vez por mês.</p>`
  });
}

async function promptImprovisedWeaponDamage() {
  const content = '<form><div class="form-group"><label>Dano da arma improvisada</label><input name="damage" type="text" value="1d6" placeholder="Ex.: 1d6" required></div><p>A arma improvisada recebe bônus de <strong>+2 no dano</strong>.</p></form>';
  const damage = Number(game.release?.generation ?? 13) >= 14
    ? await foundry.applications.api.DialogV2.prompt({ window: { title: "Dano da arma improvisada" }, content, ok: { label: "Criar arma", callback: (_event, button) => String(button.form.elements.damage.value ?? "").trim() } })
    : await Dialog.prompt({ title: "Dano da arma improvisada", content, label: "Criar arma", callback: (html) => String(html[0].querySelector('[name="damage"]')?.value ?? "").trim(), rejectClose: false });
  return damage && /^[0-9dD+*/().\s-]+$/.test(damage) ? damage : null;
}

async function improviseWeapon(actor) {
  const combat = game.combat;
  if (!combat?.id) return ui.notifications.warn("A habilidade só pode ser usada durante um combate ativo.");
  const roll = new Roll("1d6");
  if (Number(game.release?.generation ?? 13) >= 14) await roll.evaluate();
  else await roll.roll({ async: true });
  if (Number(roll.total) > 2) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), rolls: [roll], content: "<strong>Armamento Improvisado</strong><p>A tentativa falhou.</p>" });
    return;
  }
  const damage = await promptImprovisedWeaponDamage();
  if (!damage) return ui.notifications.warn("Informe um dano válido para a arma improvisada.");
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name: "Arma Improvisada",
    type: "weapon",
    img: "icons/weapons/melee/mace-runed.webp",
    system: { type: "melee", damage, bonus_damage: 2, is_equipped: true, quantity: 1, description: "Arma improvisada. Quebra ao fim do combate. Bônus de +2 no dano." },
    flags: { [MODULE_ID]: { improvisedWeapon: true, improvisedWeaponCombatId: combat.id } }
  }]);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), rolls: [roll], content: `<strong>Armamento Improvisado</strong><p>A tentativa foi bem-sucedida. A arma improvisada foi criada e equipada com dano <strong>${escapeHtml(damage)} + 2</strong>.</p>` });
  actor.sheet?.render?.(false);
  return item;
}

async function breakImprovisedWeapons(combat) {
  if (!isPrimaryActiveGM() || !combat?.id || cleanedImprovisedCombats.has(combat.id)) return;
  cleanedImprovisedCombats.add(combat.id);
  for (const actor of game.actors ?? []) {
    const items = [...(actor.items ?? [])].filter((item) => item.getFlag?.(MODULE_ID, "improvisedWeapon") && item.getFlag(MODULE_ID, "improvisedWeaponCombatId") === combat.id);
    if (!items.length) continue;
    await actor.deleteEmbeddedDocuments("Item", items.map((item) => item.id));
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<strong>Arma Improvisada</strong><p>A arma improvisada de ${escapeHtml(actor.name)} quebrou ao fim do combate e foi removida do inventário.</p>` });
  }
}

async function rollTurnUndead(actor, level) {
  const origin = actor.getActiveTokens?.()[0] ?? null;
  if (!origin || !canvas?.tokens) return ui.notifications.warn("O clérigo precisa estar representado por um token.");
  // Exibe no mapa a área circular de 18 m, como um modelo medido pelo Foundry.
  const sceneUnits = String(canvas.scene?.grid?.units ?? "").toLowerCase();
  const range = /m|metro/.test(sceneUnits) ? 18 : 60; // 18 m ≈ 60 ft
  if (canvas.scene?.createEmbeddedDocuments) {
    await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
      t: "circle", user: game.user.id, x: origin.center.x, y: origin.center.y,
      distance: range, direction: 0, angle: 360, width: 0,
      borderColor: "#e6a400", fillColor: "#43a047", flags: { [MODULE_ID]: { turnUndead: true } }
    }]);
  }
  const distance = (token) => {
    try {
      const measured = Number(canvas.grid.measureDistance(origin.center, token.center));
      if (Number.isFinite(measured)) return measured;
    } catch { /* fallback abaixo */ }
    const dx = Number(token.center?.x) - Number(origin.center?.x), dy = Number(token.center?.y) - Number(origin.center?.y);
    const pixels = Math.hypot(dx, dy), gridSize = Number(canvas.grid.size) || 100, gridDistance = Number(canvas.scene?.grid?.distance) || 5;
    return (pixels / gridSize) * gridDistance;
  };
  const targets = canvas.tokens.placeables.filter((token) => {
    if (token === origin || distance(token) > range) return false;
    const actorData = token.actor?.system ?? {};
    const text = `${token.actor?.name ?? token.name ?? ""} ${JSON.stringify(actorData)}`;
    return /morto.?vivo|undead|zumbi|m[uú]mia|lich|carni[cç]al|ghoul|esqueleto|vampiro/i.test(text);
  });
  const bonus = level >= 10 ? 2 : level >= 3 ? 1 : 0;
  const rows = [];
  for (const token of targets) {
    const roll = await (async () => { const r = new Roll("2d6"); await r.evaluate(); return r; })();
    const values = roll.dice?.flatMap((die) => (die.results ?? []).map((entry) => Number(entry.result ?? entry))) ?? [];
    const double = values.length >= 2 && values[0] === values[1] && [4, 5, 6].includes(values[0]);
    const morale = Number(token.actor?.system?.mo ?? token.actor?.system?.morale ?? token.actor?.system?.details?.morale ?? 0);
    const diceDisplay = values.length ? `(${values.join("+")})` : String(roll.total);
    const success = !double && (roll.total + bonus > morale);
    if (double) {
      await token.actor?.update({ "system.hp.value": 0 });
      await token.actor?.setFlag?.(MODULE_ID, "turnUndeadDead", true);
      const statuses = [...(game.system?.statusEffects ?? []), ...(CONFIG.statusEffects ?? [])];
      const dead = statuses.find((effect) => /dead|death|morto|derrot/i.test(`${effect.id} ${effect.name ?? ""} ${effect.label ?? ""}`));
      try {
        if (dead && token.actor?.toggleStatusEffect) await token.actor.toggleStatusEffect(dead.id, { active: true, overlay: true });
        else if (dead && token.toggleEffect) await token.toggleEffect(dead.img ?? dead.icon, { active: true, overlay: true });
      } catch (error) { console.warn(`${MODULE_ID} | Não foi possível marcar ${token.name} como morto`, error); }
      rows.push(`<li>${escapeHtml(token.name)}: virou pó (${diceDisplay})</li>`);
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: token.actor }), content: `<strong>${escapeHtml(token.name)} virou pó e morreu.</strong>`, flags: { [MODULE_ID]: { turnUndeadResult: true } } });
    } else if (success) {
      const statuses = [...(game.system?.statusEffects ?? []), ...(CONFIG.statusEffects ?? [])];
      const fear = statuses.find((effect) => /fright|fear|amedront|medo/i.test(`${effect.id} ${effect.name ?? ""} ${effect.label ?? ""}`));
      await token.actor?.setFlag?.(MODULE_ID, "turnUndeadFrightened", true);
      try {
        if (fear && token.actor?.toggleStatusEffect) await token.actor.toggleStatusEffect(fear.id, { active: true, overlay: false });
        else if (fear && token.toggleEffect) await token.toggleEffect(fear.img ?? fear.icon, { active: true, overlay: false });
      } catch (error) { console.warn(`${MODULE_ID} | Não foi possível marcar ${token.name} como amedrontado`, error); }
      rows.push(`<li>${escapeHtml(token.name)}: Afastado (amedrontado) — ${diceDisplay}+${bonus} contra Moral ${morale}</li>`);
    } else rows.push(`<li>${escapeHtml(token.name)}: Resistiu — ${diceDisplay}+${bonus} contra Moral ${morale}</li>`);
  }
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<strong>Afastar Mortos-vivos</strong><ul>${rows.join("") || "<li>Nenhum morto-vivo na área de 18 m.</li>"}</ul>`, flags: { [MODULE_ID]: { turnUndeadResult: true } } });
}

function effectTemplate({ name, origin, association, key, mode, value, condition }) {
  return normalizeEffect({
    id: `auto-${normalizeAbilityName(name).replace(/[^a-z0-9]+/g, "-")}`, name, origin, association, icon: "icons/svg/aura.svg", enabled: true,
    duration: { type: "permanent" }, modifiers: [{ key, mode, value }],
    conditional: condition ? { enabled: true, trigger: "manual", flow: "if", left: condition.left, operator: condition.operator || "eq", right: condition.right || "boolean.true", number: condition.number || 0, conditionName: condition.name, resultAction: "applyEffect" } : { enabled: false }
  });
}

function strengthenedStatus() {
  const statuses = [...(game.system?.statusEffects ?? []), ...(CONFIG.statusEffects ?? [])];
  return statuses.find((effect) => /^(empowered|strengthened)$/i.test(String(effect.id ?? "")))
    ?? statuses.find((effect) => /fortalec|empower|strengthen/i.test(`${effect.id ?? ""} ${effect.name ?? ""} ${effect.label ?? ""} ${game.i18n?.localize?.(effect.name ?? effect.label ?? "") ?? ""}`));
}

function isInspirationEffect(effect) {
  return normalizeAbilityName(effect?.name) === "inspiracao";
}
function isFuryEffect(effect) {
  return normalizeAbilityName(effect?.name).startsWith("furia:");
}

function isInspireAbilityName(name) {
  const normalized = normalizeAbilityName(name);
  return normalized === "inspirar" || normalized === "inspiracao" || normalized === "animal sagrado";
}
function isFuryAbilityName(name) {
  return normalizeAbilityName(name) === "furia";
}
function isRanger(name) {
  return normalizeAbilityName(name).startsWith("ranger");
}
function isNaturalEnemyAbilityName(name) {
  return normalizeAbilityName(name) === "inimigo mortal";
}
function isPatrolConvocationAbilityName(name) {
  return normalizeAbilityName(name) === "convocar patrulha";
}
function isCityFundsAbilityName(name) {
  return normalizeAbilityName(name) === "fundos da cidade";
}
function isImprovisedWeaponAbilityName(name) {
  return normalizeAbilityName(name) === "armamento improvisado";
}
function isRacialTrainingAbilityName(name) {
  return normalizeAbilityName(name) === "treinamento racial";
}
function isElfAdventurer(name) {
  return normalizeAbilityName(name) === "elfo aventureiro";
}
function isOutcast(name) {
  return normalizeAbilityName(name).startsWith("proscrito");
}

const NATURAL_ENEMY_CHOICES = [
  { label: "Orcs", conditionName: "orc|orcs" },
  { label: "Goblins", conditionName: "goblin|goblins" },
  { label: "Homens Lagartos", conditionName: "homem lagarto|homens lagartos|homem-lagarto|homens-lagartos" },
  { label: "Trolls", conditionName: "troll|trolls" },
  { label: "Gigantes", conditionName: "gigante|gigantes" }
];

async function saveActorEffects(actor, effects) {
  const save = game.od2Qdv?.effects?.set;
  if (typeof save === "function") await save(actor, effects);
  else await actor.setFlag(MODULE_ID, "effects", effects);
}

async function syncInspirationStatus(actor) {
  if (!actor) return;
  const active = (actor.getFlag(MODULE_ID, "effects") ?? []).some((effect) => (isInspirationEffect(effect) || isFuryEffect(effect)) && effect.enabled !== false);
  const status = strengthenedStatus();
  if (!status) return console.warn(`${MODULE_ID} | Status Fortalecido não encontrado no Foundry.`);
  const currentlyActive = actor.statuses?.has?.(status.id)
    || [...(actor.effects ?? [])].some((effect) => effect.statuses?.has?.(status.id));
  if (Boolean(currentlyActive) === active) return;
  try {
    await actor.toggleStatusEffect?.(status.id, { active, overlay: false });
  } catch (error) {
    console.warn(`${MODULE_ID} | Não foi possível sincronizar o status Fortalecido de ${actor.name}`, error);
  }
}

async function removeInspirationFromSource(sourceActor) {
  if (!sourceActor) return;
  const storedIds = sourceActor.getFlag(MODULE_ID, "inspirationTargets") ?? [];
  const candidates = storedIds.length
    ? (await Promise.all(storedIds.map(async (reference) => game.actors.get(reference) ?? fromUuid(reference).catch(() => null)))).filter(Boolean)
    : [...(game.actors ?? [])];
  for (const target of candidates) {
    const current = target.getFlag(MODULE_ID, "effects") ?? [];
    // A origem pode alternar entre Actor.* e Scene.*.Token.*.Actor em fichas de token.
    // A lista inspirationTargets já delimita exatamente os beneficiados por este uso,
    // portanto não dependa do UUID para remover a Inspiração ao encerrar a atuação.
    const filtered = current.filter((effect) => !isInspirationEffect(effect));
    if (filtered.length !== current.length) {
      await saveActorEffects(target, filtered);
      await syncInspirationStatus(target);
    }
  }
  await sourceActor.unsetFlag(MODULE_ID, "inspirationTargets");
  sourceActor.sheet?.render?.(false);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: sourceActor }), content: "<div class=\"title\">Encerrou o uso da <strong>Inspiração</strong>.</div>" });
}

async function useInspiration(actor) {
  const candidates = furyCandidates();
  const content = `<form><div class="form-group"><label>Atores beneficiados</label>${candidates.length ? candidates.map((entry) => `<label style="display:block"><input type="checkbox" name="actor" value="${escapeHtml(entry.value)}"> ${escapeHtml(entry.label)}</label>`).join("") : "<em>Nenhum ator disponível</em>"}</div></form>`;
  const selected = Number(game.release?.generation ?? 13) >= 14
    ? await foundry.applications.api.DialogV2.prompt({ window: { title: "Usar inspiração" }, content, ok: { label: "Aplicar", callback: (_e, button) => [...button.form.querySelectorAll('input[name="actor"]:checked')].map((input) => input.value) } })
    : await Dialog.prompt({ title: "Usar inspiração", content, label: "Aplicar", callback: (html) => [...html[0].querySelectorAll('input[name="actor"]:checked')].map((input) => input.value), rejectClose: false });
  if (!selected?.length) return;
  const classItem = actor.items.find((item) => item.type === "class");
  const effect = effectTemplate({ name: "Inspiração", origin: "habilidade", association: { type: "class", id: classItem?.id, name: classItem?.name || actorClassName(actor) || "Bardo" }, key: "test.difficulty", mode: "add", value: 1 });
  effect.id = `inspiration-${actor.id}`;
  effect.sourceActorUuid = actor.uuid;
  const recipients = [];
  for (const uuid of selected) {
    const candidate = candidates.find((entry) => entry.value === uuid);
    if (!candidate?.actor) continue;
    const tokenActors = candidate.isToken ? [] : [...(canvas?.tokens?.placeables ?? [])]
      .filter((token) => token.document?.actorId === candidate.actor.id && token.actor)
      .map((token) => token.actor);
    for (const recipient of [candidate.actor, ...tokenActors]) {
      if (recipients.some((entry) => entry.uuid === recipient.uuid)) continue;
      recipients.push(recipient);
      const current = recipient.getFlag(MODULE_ID, "effects") ?? [];
      await saveActorEffects(recipient, [...current.filter((entry) => !isInspirationEffect(entry) || entry.sourceActorUuid !== actor.uuid), effect]);
      await syncInspirationStatus(recipient);
      recipient.sheet?.render?.(false);
    }
  }
  await actor.setFlag(MODULE_ID, "inspirationTargets", recipients.map((recipient) => recipient.uuid));
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: "<div class=\"title\">Usou a habilidade:<br><strong>Inspiração</strong></div>" });
}

function furyCandidates() {
  const candidates = [];
  const seen = new Set();
  const add = (actor, group, isToken = false) => {
    if (!actor?.uuid || seen.has(actor.uuid)) return;
    seen.add(actor.uuid);
    candidates.push({ actor, group, isToken, value: actor.uuid, label: actor.name });
  };
  for (const actor of game.actors ?? []) {
    if (["character", "retainer"].includes(actor.type)) add(actor, "ally");
  }
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (!token.actor) continue;
    add(token.actor, ["character", "retainer"].includes(token.actor.type) ? "ally" : "enemy", true);
  }
  return candidates;
}

async function useFury(actor) {
  if (actorLevel(actor) < 6) {
    ui.notifications.warn("Fúria só pode ser usada a partir do 6º nível.");
    return;
  }
  const candidates = furyCandidates();
  const checkboxList = (entries) => entries.length
    ? entries.map((entry) => `<label style="display:block"><input type="checkbox" name="actor" value="${escapeHtml(entry.value)}"> ${escapeHtml(entry.label)}</label>`).join("")
    : "<em>Nenhum ator disponível</em>";
  const content = `<form><div class="form-group"><label>Atores sob efeito da Fúria (+5 nos ataques, dado de dano elevado e ataques recebidos fáceis)</label>${checkboxList(candidates)}</div></form>`;
  const selected = Number(game.release?.generation ?? 13) >= 14
    ? await foundry.applications.api.DialogV2.prompt({ window: { title: "Usar Fúria" }, content, ok: { label: "Aplicar", callback: (_event, button) => [...button.form.querySelectorAll('input[name="actor"]:checked')].map((input) => input.value) } })
    : await Dialog.prompt({ title: "Usar Fúria", content, label: "Aplicar", callback: (html) => [...html[0].querySelectorAll('input[name="actor"]:checked')].map((input) => input.value), rejectClose: false });
  if (!selected?.length) return;
  const classItem = actor.items.find((item) => item.type === "class");
  const association = { type: "class", id: classItem?.id, name: classItem?.name || actorClassName(actor) || "Xamã" };
  const effects = [
    effectTemplate({ name: "Fúria: Ataques", origin: "habilidade", association, key: "attack", mode: "add", value: 5 }),
    effectTemplate({ name: "Fúria: Dano", origin: "habilidade", association, key: "damage.dieStep", mode: "add", value: 1 }),
    effectTemplate({ name: "Fúria: Exposto", origin: "habilidade", association, key: "incoming.attack", mode: "add", value: 2 })
  ];
  const targets = [];
  for (const uuid of selected) {
    const candidate = candidates.find((entry) => entry.value === uuid);
    if (!candidate?.actor) continue;
    const recipients = candidate.group === "ally" && !candidate.isToken
      ? [candidate.actor, ...[...(canvas?.tokens?.placeables ?? [])].filter((token) => token.document?.actorId === candidate.actor.id && token.actor).map((token) => token.actor)]
      : [candidate.actor];
    for (const recipient of recipients) {
      if (targets.some((entry) => entry.uuid === recipient.uuid)) continue;
      const recipientEffects = effects.map((effect) => ({ ...effect, id: `${effect.id}-${recipient.uuid}`, sourceActorUuid: actor.uuid }));
      const current = recipient.getFlag(MODULE_ID, "effects") ?? [];
      await saveActorEffects(recipient, [...current.filter((entry) => !String(entry.name ?? "").startsWith("Fúria:") || entry.sourceActorUuid !== actor.uuid), ...recipientEffects]);
      await syncInspirationStatus(recipient);
      recipient.sheet?.render?.(false);
      targets.push(recipient);
    }
  }
  await actor.setFlag(MODULE_ID, "furyTargets", targets.map((target) => target.uuid));
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: "<div class=\"title\">Usou a habilidade:<br><strong>Fúria</strong></div><p>Os atores selecionados recebem +5 nos ataques, elevam o dado de dano em um passo e ficam fáceis de atingir.</p>" });
}

async function chooseNaturalEnemy(actor) {
  const current = actor.getFlag(MODULE_ID, "naturalEnemySpecies") ?? "";
  const options = NATURAL_ENEMY_CHOICES.map((choice) => `<option value="${escapeHtml(choice.conditionName)}" ${choice.conditionName === current ? "selected" : ""}>${escapeHtml(choice.label)}</option>`).join("");
  const content = `<form><div class="form-group"><label>Inimigo mortal</label><select name="species">${options}</select></div></form>`;
  const selected = Number(game.release?.generation ?? 13) >= 14
    ? await foundry.applications.api.DialogV2.prompt({ window: { title: "Escolher inimigo mortal" }, content, ok: { label: "Confirmar", callback: (_event, button) => button.form.elements.species.value } })
    : await Dialog.prompt({ title: "Escolher inimigo mortal", content, label: "Confirmar", callback: (html) => html[0].querySelector("[name=species]").value, rejectClose: false });
  if (!selected) return;
  const choice = NATURAL_ENEMY_CHOICES.find((entry) => entry.conditionName === selected);
  if (!choice) return;
  const classItem = actor.items.find((item) => item.type === "class");
  const effect = effectTemplate({
    name: "Inimigo Natural", origin: "habilidade da classe",
    association: { type: "class", id: classItem?.id, name: classItem?.name || actorClassName(actor) || "Ranger" },
    key: "test.difficulty", mode: "add", value: 1,
    condition: { left: "target.speciesNamed", name: choice.conditionName }
  });
  effect.id = "natural-enemy";
  effect.modifiers.push({ key: "incoming.attack", mode: "reduce", value: 2 });
  const effects = actor.getFlag(MODULE_ID, "effects") ?? [];
  await saveActorEffects(actor, [...effects.filter((entry) => entry.name !== "Inimigo Natural"), effect]);
  await actor.setFlag(MODULE_ID, "naturalEnemySpecies", selected);
  actor.sheet?.render?.(false);
}

function outcastEffects(actor) {
  const cls = actor.items?.find?.((item) => item.type === "class");
  if (!isOutcast(actorClassName(actor)) || actorLevel(actor) < 3) return [];
  const effect = effectTemplate({ name: "Treinamento em combate", origin: "habilidade da classe", association: { type: "class", id: cls?.id, name: cls?.name || "Proscrito" }, key: "bac", mode: "add", value: 1 });
  effect.modifiers.push({ key: "bad", mode: "add", value: 1 });
  return [effect];
}

async function removeFuryFromSource(sourceActor) {
  if (!sourceActor) return;
  const storedIds = sourceActor.getFlag(MODULE_ID, "furyTargets") ?? [];
  const candidates = storedIds.length
    ? (await Promise.all(storedIds.map(async (reference) => game.actors.get(reference) ?? fromUuid(reference).catch(() => null)))).filter(Boolean)
    : [...(game.actors ?? [])];
  for (const target of candidates) {
    const current = target.getFlag(MODULE_ID, "effects") ?? [];
    const filtered = current.filter((effect) => !String(effect.name ?? "").startsWith("Fúria:") || effect.sourceActorUuid !== sourceActor.uuid);
    if (filtered.length !== current.length) {
      await saveActorEffects(target, filtered);
      await syncInspirationStatus(target);
    }
  }
  await sourceActor.unsetFlag(MODULE_ID, "furyTargets");
  sourceActor.sheet?.render?.(false);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: sourceActor }), content: "<div class=\"title\">Encerrou o uso da <strong>Fúria</strong>.</div>" });
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
  const racialWeapon = actor.getFlag(MODULE_ID, "elfAdventurerRacialWeapon");
  const racialWeaponCondition = { Cimitarras: "cimitarra|cimitarras", Arcos: "arco|arcos" }[racialWeapon];
  if (isElfAdventurer(actorClassName(actor)) && racialWeaponCondition) effects.push(effectTemplate({ name: "Elfo Aventureiro: Arma Racial", origin: "habilidade da classe", association: { type: "class", id: characterClass?.id, name: characterClass?.name || "Elfo Aventureiro" }, key: "damage", mode: "add", value: 2, condition: { left: "attack.itemNamed", name: racialWeaponCondition } }));
  return effects;
}

function barbarianEffects(actor) {
  const cls = actor.items?.find?.((item) => item.type === "class");
  const weapon = actor.getFlag(MODULE_ID, "barbarianMasteryWeapon");
  if (!isBarbarianName(actorClassName(actor)) || !weapon) return [];
  return [effectTemplate({ name: "Bárbaro: Maestria em armas", origin: "classe", association: { type: "class", id: cls?.id, name: cls?.name || "Bárbaro" }, key: "damage", mode: "add", value: 1, condition: { left: "attack.itemNamed", name: weapon } })];
}

function gladiatorEffects(actor) {
  const cls = actor.items?.find?.((item) => item.type === "class");
  if (normalizeAbilityName(actorClassName(actor)) !== "gladiador") return [];
  return [effectTemplate({ name: "Combatente Completo", origin: "habilidade da classe", association: { type: "class", id: cls?.id, name: cls?.name || "Gladiador" }, key: "damage", mode: "add", value: 1 })];
}

function halflingAdventurerEffects(actor) {
  const cls = actor.items?.find?.((item) => item.type === "class");
  const weapon = actor.getFlag(MODULE_ID, "halflingAdventurerRacialWeapon");
  if (normalizeAbilityName(actorClassName(actor)) !== "halfling aventureiro" || !weapon) return [];
  return [
    effectTemplate({ name: "Halfling Aventureiro: Arma Racial", origin: "classe", association: { type: "class", id: cls?.id, name: cls?.name || "Halfling Aventureiro" }, key: "damage", mode: "add", value: 2, condition: { left: "attack.itemNamed", name: weapon } }),
    effectTemplate({ name: "Halfling Aventureiro: No Alvo", origin: "habilidade da classe", association: { type: "class", id: cls?.id, name: cls?.name || "Halfling Aventureiro" }, key: "test.difficulty", mode: "add", value: 2, condition: { left: "attack.rangedItemNamed", name: weapon } })
  ];
}

function paladinEffects(actor) {
  const cls = actor.items?.find?.((item) => item.type === "class");
  const weapon = actor.getFlag(MODULE_ID, "paladinMasteryWeapon");
  if (normalizeAbilityName(actorClassName(actor)) !== "paladino" || !weapon) return [];
  return [effectTemplate({ name: "Paladino: Maestria em armas", origin: "classe", association: { type: "class", id: cls?.id, name: cls?.name || "Paladino" }, key: "damage", mode: "add", value: 1, condition: { left: "attack.itemNamed", name: weapon } })];
}

function warriorEffects(actor) {
  const cls = actor.items?.find?.((item) => item.type === "class");
  const level = actorLevel(actor);
  const weapons = actor.getFlag(MODULE_ID, "warriorMasteryWeapons") || actor.getFlag(MODULE_ID, "warriorMasteryWeapon");
  if (normalizeAbilityName(actorClassName(actor)) !== "guerreiro" || !weapons) return [];
  const selected = Array.isArray(weapons) ? weapons : [weapons];
  const effects = [];
  for (const weapon of selected) effects.push(effectTemplate({ name: "Guerreiro: Maestria em armas", origin: "classe", association: { type: "class", id: cls?.id, name: cls?.name || "Guerreiro" }, key: "damage", mode: "add", value: level >= 10 ? 3 : level >= 3 ? 2 : 1, condition: { left: "attack.itemNamed", name: weapon } }));
  const group = actor.getFlag(MODULE_ID, "warriorMasteryGroup");
  const groupTerms = { cortantes: "espada|machado|foice", perfurante: "lança|dardo|besta|arco", impactantes: "martelo|maça|clava", disparos: "arco|besta|dardo", hastes: "lança|bordão|alabarda", arremesso: "arremesso" };
  if (level >= 10 && group) for (const item of actor.items ?? []) if (item.type === "weapon" && new RegExp(groupTerms[normalizeAbilityName(group)] || "^$", "i").test(item.name)) effects.push(effectTemplate({ name: "Guerreiro: Maestria em grupo de armas", origin: "classe", association: { type: "class", id: cls?.id, name: cls?.name || "Guerreiro" }, key: "damage", mode: "add", value: 3, condition: { left: "attack.itemNamed", name: item.name } }));
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
  const managedNames = new Set(["Anão: Inimigos", "Anão Aventureiro: Bastião Racial(6)", "Anão Aventureiro: Arma Racial", "Halfling Aventureiro: Arma Racial", "Halfling Aventureiro: No Alvo", "Elfo: Arma Racial", "Elfo Aventureiro: Arma Racial", "Elfo: Imunidade", "Meio-Elfo: Imunidade", "Arqueiro: Maestria em Armas(1)", "Arqueiro: Puxada Aprimorada(3)", "Halfling: Furtivos", "Halfling: Bons de mira", "Halfling: Pequenos", "Meio-Gigante: Força descomunal", "Meio-Gigante: Força descomunal (Dano)", "Aarakocra: Nascidos dos Céus", "Aarakocra: Nascidos dos Céus (Dano)", "Bárbaro: Maestria em armas", "Combatente Completo", "Paladino: Maestria em armas", "Guerreiro: Maestria em armas", "Guerreiro: Maestria em grupo de armas", "Treinamento em combate"]);
  const current = actor.getFlag(MODULE_ID, "effects") || [];
  const desired = [...dwarfEffects(actor), ...elfAndArcherEffects(actor), ...gnomeAndHalflingEffects(actor), ...halflingAdventurerEffects(actor), ...barbarianEffects(actor), ...gladiatorEffects(actor), ...paladinEffects(actor), ...warriorEffects(actor), ...outcastEffects(actor)];
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

async function chooseElfAdventurerRacialWeapon(actor) {
  const content = '<div class="form-group"><label>Arma racial</label><select name="weapon"><option value="Cimitarras">Cimitarras</option><option value="Arcos">Arcos</option></select></div>';
  const selected = Number(game.release?.generation ?? 13) >= 14
    ? await foundry.applications.api.DialogV2.prompt({ window: { title: "Escolher arma racial" }, content, ok: { label: "Confirmar", callback: (_event, button) => button.form.elements.weapon.value } })
    : await Dialog.prompt({ title: "Escolher arma racial", content: `<form>${content}</form>`, label: "Confirmar", callback: (html) => html[0].querySelector('[name="weapon"]').value, rejectClose: false });
  if (!selected) return;
  await actor.setFlag(MODULE_ID, "elfAdventurerRacialWeapon", selected);
  await syncDwarfEffects(actor);
}

async function chooseArcherMastery(actor, allWeapons = false, flagName = "archerMasteryWeapon", matcher = null) {
  const matches = (name) => matcher ? matcher(name) : (allWeapons || /arco|besta/i.test(name));
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
    const isDarkSun = darkSunPacks("Item").includes(pack) || /dark[- ]?sun|darksun/i.test(String(pack.metadata?.packageName ?? pack.metadata?.package ?? pack.metadata?.label ?? ""));
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
  if (selected) { await actor.setFlag(MODULE_ID, flagName, selected); await syncDwarfEffects(actor); }
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
    const key = abilityKey(classAbilityName(actor, row));
    const isRaceAbility = Boolean(row.closest(".character-tab-race"));
    if (key === "reputation" && isRaceAbility) continue;
    if (key === "assassination" && isRaceAbility) continue;
    if (key === "profanationMagic" && !normalizeAbilityName(actorClassName(actor)).startsWith("preservador")) continue;
    if (key === "hearingNoises" && !/ladrao|ladrão/i.test(actorClassName(actor)) && !isBard(actorClassName(actor))) continue;
    if (!key) continue;
    // Afastar Mortos-vivos é disparado pelo registro de uso nativo da habilidade;
    // não adicionar um botão extra na ficha.
    if (key === "turnUndead") continue;
    // Inspiração/Animal Sagrado usa um seletor de personagens, não um teste de 1d6.
    if (key === "inspiration") continue;
    if (key === "profanationMagic") {
      const current = row.querySelector("[data-profanation-magic]");
      const history = profanationHistoryHtml(profanationDates(actor, row.dataset.itemId));
      if (current) {
        current.closest(".od2qdv-profanation-magic")?.querySelector(".od2qdv-profanation-history")?.remove();
        if (history) current.closest(".od2qdv-profanation-magic")?.insertAdjacentHTML("beforeend", history);
      } else (row.querySelector(":scope > .ability, :scope > .ability-header") ?? row.firstElementChild ?? row).insertAdjacentHTML("afterend", profanationMagicHtml(actor, row.dataset.itemId));
      continue;
    }
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
  if (normalizeAbilityName(actorClassName(actor)) === "guerreiro") {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (!normalizeAbilityName(ability?.name).includes("maestria em arma") || row.querySelector("[data-warrior-mastery-choice]")) continue;
      const selected = (actor.getFlag(MODULE_ID, "warriorMasteryWeapons") || [actor.getFlag(MODULE_ID, "warriorMasteryWeapon")]).filter(Boolean);
      (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-warrior-mastery-choice><i class="fas fa-sword"></i> Arma de maestria: ${escapeHtml(selected)}</a></div>`);
    }
  }
  if (normalizeAbilityName(actorClassName(actor)) === "paladino") {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (!normalizeAbilityName(ability?.name).includes("maestria em arma") || row.querySelector("[data-paladin-mastery-choice]")) continue;
      const selected = actor.getFlag(MODULE_ID, "paladinMasteryWeapon") || "Não escolhida";
      (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-paladin-mastery-choice><i class="fas fa-sword"></i> Arma de maestria: ${escapeHtml(selected)}</a></div>`);
    }
  }
  if (isBard(actorClassName(actor)) || isShaman(actorClassName(actor))) {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (isInspireAbilityName(ability?.name)) {
        if (row.querySelector("[data-inspiration-choice]")) continue;
        const active = (actor.getFlag(MODULE_ID, "inspirationTargets") ?? []).length > 0;
        const label = active ? "Parar inspiração" : "Usar inspiração";
        const icon = active ? "fa-stop" : "fa-sparkles";
        (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-inspiration-choice data-inspiration-active="${active}"><i class="fas ${icon}"></i> ${label}</a></div>`);
      }
      if (isFuryAbilityName(ability?.name) && actorLevel(actor) >= 6) {
        if (row.querySelector("[data-fury-choice]")) continue;
        const active = (actor.getFlag(MODULE_ID, "furyTargets") ?? []).length > 0;
        const label = active ? "Parar fúria" : "Usar fúria";
        const icon = active ? "fa-stop" : "fa-fire";
        (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-fury-choice data-fury-active="${active}"><i class="fas ${icon}"></i> ${label}</a></div>`);
      }
    }
  }
  if (isRanger(actorClassName(actor))) {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (!isNaturalEnemyAbilityName(ability?.name) || row.querySelector("[data-natural-enemy-choice]")) continue;
      const selected = NATURAL_ENEMY_CHOICES.find((choice) => choice.conditionName === actor.getFlag(MODULE_ID, "naturalEnemySpecies"));
      (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-natural-enemy-choice><i class="fas fa-paw"></i> Inimigo natural: ${escapeHtml(selected?.label || "não escolhido")}</a></div>`);
    }
  }
  if (isTemplar(actorClassName(actor))) {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (isPatrolConvocationAbilityName(ability?.name) && !row.querySelector("[data-patrol-convocation]")) {
        (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-patrol-convocation title="Rolar Convocar Patrulha"><i class="fa-light fa-dice-d4 fa-sm"></i>&nbsp;Convocar Patrulha (1d4)</a></div>`);
      }
      if (isCityFundsAbilityName(ability?.name)) {
        const current = row.querySelector("[data-city-funds]");
        const history = cityFundsHistoryHtml(cityFundsDates(actor, row.dataset.itemId));
        if (current) {
          current.closest(".od2qdv-city-funds")?.querySelector(".od2qdv-city-funds-history")?.remove();
          if (history) current.closest(".od2qdv-city-funds")?.insertAdjacentHTML("beforeend", history);
        } else {
          (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", cityFundsHtml(actor, row.dataset.itemId));
        }
      }
    }
  }
  if (normalizeAbilityName(actorClassName(actor)) === "gladiador") {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (!isImprovisedWeaponAbilityName(ability?.name) || row.querySelector("[data-improvise-weapon]")) continue;
      (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-improvise-weapon title="Improvisar armamento"><i class="fa-light fa-hammer-war fa-sm"></i>&nbsp;Improvisar armamento</a></div>`);
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
  if (isElfAdventurer(actorClassName(actor))) {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (!isRacialTrainingAbilityName(ability?.name) || row.querySelector("[data-elf-racial-weapon-choice]")) continue;
      const selected = actor.getFlag(MODULE_ID, "elfAdventurerRacialWeapon") || "Não escolhida";
      (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-elf-racial-weapon-choice><i class="fas fa-swords"></i> Arma racial: ${escapeHtml(selected)}</a></div>`);
    }
  }
  if (normalizeAbilityName(actorClassName(actor)) === "halfling aventureiro") {
    for (const row of root.querySelectorAll(".character-tab-class .class-abilities li.item[data-item-id]")) {
      const ability = actor.items?.get?.(row.dataset.itemId);
      if (normalizeAbilityName(ability?.name) !== "arma racial" || row.querySelector("[data-halfling-racial-weapon-choice]")) continue;
      const selected = actor.getFlag(MODULE_ID, "halflingAdventurerRacialWeapon") || "Não escolhida";
      (row.querySelector(":scope > .ability") ?? row).insertAdjacentHTML("afterend", `<div class="od2qdv-academic-roll"><a data-halfling-racial-weapon-choice><i class="fas fa-sling"></i> Arma racial: ${escapeHtml(selected)}</a></div>`);
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
    const elfRacialWeaponChoice = event.target.closest?.("[data-elf-racial-weapon-choice]");
    const halflingWeaponChoice = event.target.closest?.("[data-halfling-racial-weapon-choice]");
    const masteryChoice = event.target.closest?.("[data-archer-mastery-choice]");
    const barbarianMasteryChoice = event.target.closest?.("[data-barbarian-mastery-choice]");
    const warriorMasteryChoice = event.target.closest?.("[data-warrior-mastery-choice]");
    const paladinMasteryChoice = event.target.closest?.("[data-paladin-mastery-choice]");
    const inspirationChoice = event.target.closest?.("[data-inspiration-choice]");
    const furyChoice = event.target.closest?.("[data-fury-choice]");
    const naturalEnemyChoice = event.target.closest?.("[data-natural-enemy-choice]");
    const patrolConvocation = event.target.closest?.("[data-patrol-convocation]");
    const cityFunds = event.target.closest?.("[data-city-funds]");
    const improviseWeaponButton = event.target.closest?.("[data-improvise-weapon]");
    const profanationMagic = event.target.closest?.("[data-profanation-magic]");
    if (!button && !weaponChoice && !elfRacialWeaponChoice && !halflingWeaponChoice && !masteryChoice && !barbarianMasteryChoice && !warriorMasteryChoice && !paladinMasteryChoice && !inspirationChoice && !furyChoice && !naturalEnemyChoice && !patrolConvocation && !cityFunds && !improviseWeaponButton && !profanationMagic) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    if (weaponChoice) { await chooseRacialWeapon(actor); app.render(false); return; }
    if (elfRacialWeaponChoice) {
      if (actor.getFlag(MODULE_ID, "elfAdventurerRacialWeapon") && !game.user.isGM) { ui.notifications.warn("A arma racial já foi escolhida. Somente o Mestre pode alterá-la."); return; }
      await chooseElfAdventurerRacialWeapon(actor);
      app.render(false);
      return;
    }
    if (halflingWeaponChoice) {
      if (actor.getFlag(MODULE_ID, "halflingAdventurerRacialWeapon") && !game.user.isGM) { ui.notifications.warn("A arma racial já foi escolhida. Somente o Mestre pode alterá-la."); return; }
      await chooseArcherMastery(actor, false, "halflingAdventurerRacialWeapon", (name) => /arremess|adaga|azagaia|dardo|funda|lança|chaktcha|chakthcha|machado|martelo/i.test(name));
      app.render(false); return;
    }
    if (masteryChoice) { await chooseArcherMastery(actor); app.render(false); return; }
    if (barbarianMasteryChoice) {
      if (actor.getFlag(MODULE_ID, "barbarianMasteryWeapon") && !game.user.isGM) { ui.notifications.warn("A arma de maestria já foi escolhida. Somente o Mestre pode alterá-la."); return; }
      await chooseArcherMastery(actor, true);
      await actor.setFlag(MODULE_ID, "barbarianMasteryWeapon", actor.getFlag(MODULE_ID, "archerMasteryWeapon"));
      app.render(false); return;
    }
    if (warriorMasteryChoice) {
      if (actor.getFlag(MODULE_ID, "warriorMasteryWeapons") && !game.user.isGM) { ui.notifications.warn("As armas de maestria já foram escolhidas. Somente o Mestre pode alterá-las."); return; }
      await chooseArcherMastery(actor, true, "warriorMasteryWeapon");
      const first = actor.getFlag(MODULE_ID, "warriorMasteryWeapon");
      const weapons = [first];
      if (actorLevel(actor) >= 3) {
        await chooseArcherMastery(actor, true, "warriorMasteryWeapon");
        weapons.push(actor.getFlag(MODULE_ID, "warriorMasteryWeapon"));
      }
      await actor.setFlag(MODULE_ID, "warriorMasteryWeapons", [...new Set(weapons.filter(Boolean))]);
      if (actorLevel(actor) >= 10) {
        const groups = ["Cortantes", "Perfurante", "Impactantes", "Disparos", "Hastes", "Arremesso"];
        const content = `<form><div class="form-group"><label>Grupo de armas</label><select name="group">${groups.map((group) => `<option value="${group}">${group}</option>`).join("")}</select></div></form>`;
        const group = Number(game.release?.generation ?? 13) >= 14
          ? await foundry.applications.api.DialogV2.prompt({ window: { title: "Escolher grupo de armas" }, content, ok: { label: "Confirmar", callback: (_event, button) => button.form.elements.group.value } })
          : await Dialog.prompt({ title: "Escolher grupo de armas", content, label: "Confirmar", callback: (html) => html[0].querySelector("[name=group]").value, rejectClose: false });
        if (group) await actor.setFlag(MODULE_ID, "warriorMasteryGroup", group);
      }
      app.render(false); return;
    }
    if (paladinMasteryChoice) {
      if (actor.getFlag(MODULE_ID, "paladinMasteryWeapon") && !game.user.isGM) { ui.notifications.warn("A arma de maestria já foi escolhida. Somente o Mestre pode alterá-la."); return; }
      await chooseArcherMastery(actor, true, "paladinMasteryWeapon");
      app.render(false); return;
    }
    if (inspirationChoice) {
      if (inspirationChoice.dataset.inspirationActive === "true") {
        if (game.user.isGM) await removeInspirationFromSource(actor);
        else game.socket.emit(SOCKET, { type: "inspirationRemove", actorId: actor.id, actorUuid: actor.uuid, userId: game.user.id });
      } else await useInspiration(actor);
      app.render(false);
      return;
    }
    if (furyChoice) {
      if (furyChoice.dataset.furyActive === "true") {
        if (game.user.isGM) await removeFuryFromSource(actor);
        else game.socket.emit(SOCKET, { type: "furyRemove", actorId: actor.id, actorUuid: actor.uuid, userId: game.user.id });
      } else await useFury(actor);
      app.render(false);
      return;
    }
    if (naturalEnemyChoice) {
      await chooseNaturalEnemy(actor);
      app.render(false);
      return;
    }
    if (patrolConvocation) {
      patrolConvocation.classList.add("rolling");
      try { await rollPatrolConvocation(actor); } finally { patrolConvocation.classList.remove("rolling"); }
      return;
    }
    if (cityFunds) {
      cityFunds.classList.add("rolling");
      try { await rollCityFunds(actor, cityFunds.dataset.abilityId); } finally { cityFunds.classList.remove("rolling"); }
      app.render(false);
      return;
    }
    if (improviseWeaponButton) {
      improviseWeaponButton.classList.add("rolling");
      try { await improviseWeapon(actor); } finally { improviseWeaponButton.classList.remove("rolling"); }
      app.render(false);
      return;
    }
    if (profanationMagic) {
      profanationMagic.classList.add("rolling");
      try { await rollProfanationMagic(actor, profanationMagic.dataset.abilityId); } finally { profanationMagic.classList.remove("rolling"); }
      app.render(false);
      return;
    }
    button.classList.add("rolling");
    try { await rollAbility(actor, button.dataset.academicAbility); } finally { button.classList.remove("rolling"); }
  }, true);
}

Hooks.on("renderActorSheet", enhanceAcademicAbilities);
Hooks.on("renderActorSheetV2", enhanceAcademicAbilities);
Hooks.on("renderOD2CharacterSheet", enhanceAcademicAbilities);
Hooks.on("updateActor", (actor, changed, _options, userId) => {
  if (!enabled() || (userId && game.user?.id !== userId)) return;
  if (changed.flags?.[MODULE_ID]?.effects) {
    syncInspirationStatus(actor);
    return;
  }
  if (changed.system && Object.prototype.hasOwnProperty.call(changed.system, "level")) syncDwarfEffects(actor);
});
Hooks.on("createChatMessage", (message) => {
  if (!enabled()) return;
  if (message?.getFlag?.(MODULE_ID, "turnUndeadResult")) return;
  const text = String(message?.content ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  if (!text.includes("afastar mortos-vivos") && !text.includes("afastar mortos vivos")) return;
  const actor = message?.speaker?.actor ? game.actors?.get(message.speaker.actor) : null;
  if (actor && isCleric(actorClassName(actor))) rollTurnUndead(actor, actorLevel(actor));
});
Hooks.on("createChatMessage", (message) => {
  handleProfanadorSpellMessage(message).catch((error) => console.error(`${MODULE_ID} | Falha ao processar magia do Profanador`, error));
});
Hooks.on("createChatMessage", (message) => {
  handleLayOnHandsMessage(message).catch((error) => console.error(`${MODULE_ID} | Falha ao processar Cura pelas Mãos`, error));
});
Hooks.on("updateCombat", async (combat, changed) => {
  if (!enabled() || !isPrimaryActiveGM()) return;
  if (changed?.active === false) {
    await breakImprovisedWeapons(combat);
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(changed ?? {}, "round")) return;
  if (Object.prototype.hasOwnProperty.call(changed ?? {}, "round")) {
    const templates = [...(canvas?.scene?.getEmbeddedCollection?.("MeasuredTemplate") ?? [])].filter((template) => template.flags?.[MODULE_ID]?.turnUndead);
    if (templates.length) await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", templates.map((template) => template.id));
  }
  previousCombatants.set(combat, combat.combatant?.actor?.id ?? null);
  const candidates = [...(combat.combatants ?? [])].map((combatant) => combatant.actor).filter((actor, index, list) => actor && list.indexOf(actor) === index);
  for (const actor of candidates) {
    if (!actor.getFlag?.(MODULE_ID, "turnUndeadFrightened")) continue;
    const roll = new Roll("2d6"); await roll.evaluate();
    const morale = Number(actor.system?.mo ?? actor.system?.morale ?? actor.system?.details?.morale ?? 0);
    if (roll.total <= morale) {
      const statuses = [...(game.system?.statusEffects ?? []), ...(CONFIG.statusEffects ?? [])];
      const fear = statuses.find((effect) => /fright|fear|amedront|medo/i.test(`${effect.id} ${effect.name ?? ""} ${effect.label ?? ""}`));
      if (fear) await actor.toggleStatusEffect?.(fear.id, { active: false, overlay: false });
      await actor.unsetFlag(MODULE_ID, "turnUndeadFrightened");
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `${escapeHtml(actor.name)} passou no teste de Moral e deixou de estar amedrontado.` });
    } else {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `${escapeHtml(actor.name)} falhou no teste de Moral e permanece amedrontado.` });
    }
  }
});
Hooks.on("deleteCombat", (combat) => breakImprovisedWeapons(combat));
// O sistema registra o uso da habilidade atualizando o Item (sem depender de combate
// ou de um botão customizado). Esse caminho também cobre mensagens sem speaker.actor.
for (const hook of ["createItem", "updateItem", "deleteItem"]) Hooks.on(hook, (item, ...args) => {
  const changed = hook === "updateItem" ? args[0] : null;
  const userId = [...args].reverse().find((value) => typeof value === "string");
  const recoveredInspiration = hook === "updateItem"
    && isInspireAbilityName(item?.name)
    && Object.values(changed?.flags?.olddragon2e?.["daily-uses"] ?? {}).some((value) => value === false);
  const recoveredFury = hook === "updateItem"
    && isFuryAbilityName(item?.name)
    && Object.values(changed?.flags?.olddragon2e?.["daily-uses"] ?? {}).some((value) => value === false);
  if (enabled() && recoveredInspiration && (!userId || game.user?.id === userId)) {
    if (game.user.isGM) removeInspirationFromSource(item.parent);
    else game.socket.emit(SOCKET, { type: "inspirationRemove", actorId: item.parent?.id, actorUuid: item.parent?.uuid, userId: game.user.id });
  }
  if (enabled() && recoveredFury && (!userId || game.user?.id === userId)) {
    if (game.user.isGM) removeFuryFromSource(item.parent);
    else game.socket.emit(SOCKET, { type: "furyRemove", actorId: item.parent?.id, actorUuid: item.parent?.uuid, userId: game.user.id });
  }
  if (enabled() && (!userId || game.user?.id === userId) && item.parent?.type === "character" && ["class", "race"].includes(item.type)) syncDwarfEffects(item.parent);
});
Hooks.once("ready", () => {
  if (!enabled()) return;
  console.log(`${MODULE_ID} | Automações de habilidades de classe e raça ativas`);
  for (const combat of game.combats ?? []) previousCombatants.set(combat, combat.combatant?.actor?.id ?? null);
  game.socket.on(SOCKET, async (payload) => {
    if (payload?.type === "inspirationRemove" && game.user.isGM) {
      const actor = game.actors?.get(payload.actorId) ?? (payload.actorUuid ? await fromUuid(payload.actorUuid) : null);
      if (actor) await removeInspirationFromSource(actor);
      return;
    }
    if (payload?.type === "furyRemove" && game.user.isGM) {
      const actor = game.actors?.get(payload.actorId) ?? (payload.actorUuid ? await fromUuid(payload.actorUuid) : null);
      if (actor) await removeFuryFromSource(actor);
      return;
    }
    if (payload?.type === "profanationMagicRequest" && game.user.isGM && isPrimaryActiveGM()) {
      if (payload.requestId && handledProfanationRequests.has(payload.requestId)) return;
      if (payload.requestId) handledProfanationRequests.add(payload.requestId);
      const actor = game.actors?.get(payload.actorId) ?? (payload.actorUuid ? await fromUuid(payload.actorUuid) : null);
      if (actor) await rollProfanationMagic(actor, payload.abilityId, true);
      return;
    }
    if (payload?.type === "profanadorSpellRequest" && game.user.isGM && isPrimaryActiveGM()) {
      if (payload.requestId && handledProfanadorSpellRequests.has(payload.requestId)) return;
      if (payload.requestId) handledProfanadorSpellRequests.add(payload.requestId);
      const actor = game.actors?.get(payload.actorId) ?? (payload.actorUuid ? await fromUuid(payload.actorUuid) : null);
      const item = actor?.items?.get?.(payload.spellId);
      if (actor && item) await triggerProfanadorSpell(actor, item, payload.drainMode);
      return;
    }
    if (payload?.type === "layOnHandsRequest" && game.user.isGM && isPrimaryActiveGM()) {
      const caster = game.actors?.get(payload.casterId) ?? (payload.casterUuid ? await fromUuid(payload.casterUuid) : null);
      const targetUuid = payload.targetUuid;
      if (caster && targetUuid) await applyLayOnHands(caster, targetUuid);
      return;
    }
    if (payload?.type !== "assassinationRequest" || !game.user.isGM) return;
    if (payload.requestId && handledAssassinationRequests.has(payload.requestId)) return;
    if (payload.requestId) handledAssassinationRequests.add(payload.requestId);
    console.log(`${MODULE_ID} | Requisição de Assassinato recebida`, payload);
    const actor = game.actors?.get(payload.actorId) ?? (payload.actorUuid ? await fromUuid(payload.actorUuid) : null);
    if (actor) await rollAbility(actor, "assassination", true, payload.assassinLevel);
  });
  if (isPrimaryActiveGM()) for (const actor of game.actors ?? []) if (actor.type === "character") {
    syncDwarfEffects(actor);
    syncInspirationStatus(actor);
  }
  ensureDwarfEffectLibrary().catch((error) => console.error(`${MODULE_ID} | Falha ao criar efeitos de anão no compêndio`, error));
});
