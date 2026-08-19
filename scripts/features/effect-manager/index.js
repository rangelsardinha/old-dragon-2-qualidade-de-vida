import {
  CONDITIONAL_ACTIONS, CONDITIONAL_FLOWS, CONDITIONAL_OPERATORS, CONDITIONAL_TRIGGERS, CONDITIONAL_VALUE_DEFINITIONS,
  DURATION_TYPES, EFFECT_ACTION_TARGETS, EFFECT_EVENT_ACTIONS, EFFECT_KEYS, EFFECT_MODES, activeEffects, advanceDurations, applyHpAction, applyModifiers,
  conditionalEffectApplies, conditionalMatches, conditionalValueType, normalizeEffect, OD2_TIME
} from "./model.js";
import { actorCoins } from "../equipment-containers/index.js";
import { carriedLoad } from "../equipment-containers/model.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const FLAG = "effects";
const boundSheets = new WeakSet();
const executingConditionals = new Set();
const evaluatingModifiers = new WeakSet();
const previousLevels = new WeakMap();
const previousCombatRounds = new WeakMap();
const correctingCombats = new WeakSet();
let temporalMutationDepth = 0;
const STORED_MODIFIERS = Object.freeze({
  forca: "system.forca", destreza: "system.destreza", constituicao: "system.constituicao",
  inteligencia: "system.inteligencia", sabedoria: "system.sabedoria", carisma: "system.carisma",
  reputation: "system.details.reputation", "monster.ac": "system.ca", "monster.jp": "system.jp",
  "monster.morale": "system.mo", "monster.dvBonus": "system.dv_bonus"
});

function enabled() {
  return game.system.id === "olddragon2e" && game.settings.get(MODULE_ID, "enableEffectManager");
}

function effectsFor(actor) {
  return (actor?.getFlag(MODULE_ID, FLAG) || []).map((effect) => normalizeEffect(effect, () => foundry.utils.randomID()));
}

async function saveEffects(actor, effects) {
  const normalized = effects.map((effect) => normalizeEffect(effect, () => foundry.utils.randomID()));
  await actor.setFlag(MODULE_ID, FLAG, normalized);
  await syncHitPoints(actor, normalized);
  await syncStoredModifiers(actor, normalized);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function dialogV2() {
  return Number(game.release?.generation ?? 13) >= 14 ? foundry.applications?.api?.DialogV2 : null;
}

function worldTime() {
  return Number(game.time?.worldTime) || 0;
}

function isPrimaryActiveGM() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM;
  if (activeGM) return activeGM.id === game.user.id;
  const first = [...(game.users ?? [])].filter((user) => user.active && user.isGM).sort((left, right) => left.id.localeCompare(right.id))[0];
  return !first || first.id === game.user.id;
}

function temporalLog() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, "effectTimeLog") || []);
}

async function setTemporalLog(entries) {
  await game.settings.set(MODULE_ID, "effectTimeLog", entries.slice(-100));
}

function captureEffectStates() {
  return [...(game.actors ?? [])].map((actor) => ({
    actorUuid: actor.uuid, actorName: actor.name,
    effects: foundry.utils.deepClone(effectsFor(actor))
  }));
}

function effectStateChanges(before, after) {
  const afterByActor = new Map(after.map((entry) => [entry.actorUuid, entry]));
  return before.flatMap((entry) => {
    const next = afterByActor.get(entry.actorUuid) ?? { actorUuid: entry.actorUuid, actorName: entry.actorName, effects: [] };
    if (JSON.stringify(entry.effects) === JSON.stringify(next.effects)) return [];
    const oldById = new Map(entry.effects.map((effect) => [effect.id, effect]));
    const newById = new Map(next.effects.map((effect) => [effect.id, effect]));
    const details = [...new Set([...oldById.keys(), ...newById.keys()])].flatMap((id) => {
      const oldEffect = oldById.get(id), newEffect = newById.get(id);
      if (JSON.stringify(oldEffect) === JSON.stringify(newEffect)) return [];
      const name = newEffect?.name ?? oldEffect?.name ?? "Efeito";
      if (!oldEffect) return [`${name}: criado/ativado`];
      if (!newEffect) return [`${name}: removido`];
      if (oldEffect.enabled !== newEffect.enabled) return [`${name}: ${newEffect.enabled ? "ativado" : "desativado"}`];
      if (oldEffect.duration?.remaining !== newEffect.duration?.remaining) return [`${name}: duração ${oldEffect.duration.remaining} → ${newEffect.duration.remaining}`];
      return [`${name}: alterado`];
    });
    return [{ actorUuid: entry.actorUuid, actorName: entry.actorName, before: entry.effects, after: next.effects, details }];
  });
}

async function restoreTemporalChanges(changes, side = "before") {
  for (const change of changes) {
    const actor = await fromUuid(change.actorUuid);
    if (actor?.documentName === "Actor") await saveEffects(actor, foundry.utils.deepClone(change[side] || []));
  }
}

async function runTemporalTransaction(meta, operation) {
  if (!isPrimaryActiveGM()) throw new Error("Somente o Mestre ativo principal pode alterar o tempo.");
  const before = captureEffectStates();
  const worldBefore = worldTime();
  temporalMutationDepth += 1;
  try {
    await operation();
    await expireWorldTimeEffects(true);
    const after = captureEffectStates();
    const entry = {
      id: foundry.utils.randomID(), type: "advance", source: meta.source, reference: meta.reference || "",
      phase: meta.phase || "time", label: meta.label || "Avanço de tempo", fromRound: meta.fromRound ?? null, toRound: meta.toRound ?? null,
      seconds: worldTime() - worldBefore, worldBefore, worldAfter: worldTime(), timestamp: Date.now(),
      userId: game.user.id, reverted: false, changes: effectStateChanges(before, after)
    };
    await setTemporalLog([...temporalLog(), entry]);
    return entry;
  } catch (error) {
    const delta = worldBefore - worldTime();
    if (delta && typeof game.time?.advance === "function") await game.time.advance(delta);
    await restoreTemporalChanges(effectStateChanges(before, captureEffectStates()), "before");
    throw error;
  } finally { temporalMutationDepth -= 1; }
}

async function rollbackTemporalTransaction(transactionId) {
  if (!isPrimaryActiveGM()) return { ok: false, reason: "Somente o Mestre ativo principal pode desfazer o tempo." };
  const log = temporalLog();
  const applied = log.filter((entry) => entry.type === "advance" && !entry.reverted);
  const latest = applied.at(-1);
  if (!latest || latest.id !== transactionId) return { ok: false, reason: "Desfaça primeiro os avanços de tempo posteriores." };
  for (const change of latest.changes) {
    const actor = await fromUuid(change.actorUuid);
    if (actor && JSON.stringify(effectsFor(actor)) !== JSON.stringify(change.after)) {
      return { ok: false, reason: `Os efeitos de ${change.actorName} foram alterados depois deste avanço. Reverta essas alterações primeiro.` };
    }
  }
  temporalMutationDepth += 1;
  try {
    const delta = latest.worldBefore - worldTime();
    if (delta && typeof game.time?.advance === "function") await game.time.advance(delta);
    await restoreTemporalChanges(latest.changes, "before");
    latest.reverted = true;
    latest.revertedAt = Date.now();
    latest.revertedBy = game.user.id;
    await setTemporalLog(log);
    return { ok: true, entry: latest };
  } finally { temporalMutationDepth -= 1; }
}

function temporalHistoryContent() {
  const rows = temporalLog().slice().reverse().map((entry) => {
    const status = entry.reverted ? "Desfeito" : "Aplicado";
    const changes = entry.changes.flatMap((change) => change.details.map((detail) => `${escapeHtml(change.actorName)} — ${escapeHtml(detail)}`));
    return `<tr><td>${new Date(entry.timestamp).toLocaleString()}</td><td>${escapeHtml(entry.label)}</td><td>${entry.seconds >= 0 ? "+" : ""}${entry.seconds}s</td><td>${status}</td><td>${changes.join("<br>") || "Nenhum efeito alterado"}</td></tr>`;
  }).join("") || '<tr><td colspan="5">Nenhuma atividade temporal registrada.</td></tr>';
  return `<div class="od2qdv-time-history"><table><thead><tr><th>Data</th><th>Origem</th><th>Tempo</th><th>Estado</th><th>Alterações nos efeitos</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function openTemporalHistory() {
  const V2 = dialogV2();
  if (V2) return V2.wait({ window: { title: "Histórico temporal dos efeitos" }, content: temporalHistoryContent(), position: { width: 900 }, buttons: [{ action: "close", label: "Fechar" }] });
  new Dialog({ title: "Histórico temporal dos efeitos", content: temporalHistoryContent(), buttons: { close: { label: "Fechar" } } }, { width: 900 }).render(true);
}

function modifier(actor, key, base = 0, context = {}) {
  if (!actor || evaluatingModifiers.has(actor)) return base;
  evaluatingModifiers.add(actor);
  try { return applyModifiers(base, applicableEffects(actor, effectsFor(actor), context), key, worldTime()); }
  finally { evaluatingModifiers.delete(actor); }
}

function modifierDelta(actor, key, context = {}) {
  return modifier(actor, key, 0, context);
}

async function resolveEffectRolls(effect) {
  for (const entry of effect.modifiers) {
    const formula = String(entry.value).trim();
    if (!/[dD]/.test(formula)) {
      const numeric = Number(formula);
      if (!Number.isFinite(numeric)) throw new Error(`Valor inválido em ${EFFECT_KEYS[entry.key]}: ${formula}`);
      entry.resolvedValue = numeric;
      continue;
    }
    const rolled = new Roll(formula);
    await rolled.roll();
    entry.resolvedValue = Number(rolled.total) || 0;
  }
  return effect;
}

async function syncHitPoints(actor, effects) {
  if (!actor?.system?.hp || !actor.isOwner) return;
  const previousDelta = Number(actor.getFlag(MODULE_ID, "effectHpDelta")) || 0;
  const currentMax = Number(actor.system.hp.max) || 0;
  const currentValue = Number(actor.system.hp.value) || 0;
  const baseMax = Math.max(1, currentMax - previousDelta);
  const desiredMax = Math.max(1, Math.round(applyModifiers(baseMax, applicableEffects(actor, effects), "hp.max", worldTime())));
  const nextDelta = desiredMax - baseMax;
  const deltaChange = nextDelta - previousDelta;
  if (!deltaChange && previousDelta === nextDelta) return;
  await actor.update({
    "system.hp.max": desiredMax,
    "system.hp.value": Math.max(0, Math.min(desiredMax, currentValue + deltaChange)),
    [`flags.${MODULE_ID}.effectHpDelta`]: nextDelta
  });
}

async function syncStoredModifiers(actor, effects) {
  if (!actor?.isOwner) return;
  const previous = actor.getFlag(MODULE_ID, "storedModifierDeltas") || {};
  const updates = {};
  const next = {};
  const targets = actor.type === "monster"
    ? { ...STORED_MODIFIERS, "movement.normal": "system.mv", "movement.swim": "system.mvn", "movement.fly": "system.mvv" }
    : STORED_MODIFIERS;
  for (const [key, path] of Object.entries(targets)) {
    const raw = foundry.utils.getProperty(actor, path);
    if (raw === undefined || raw === null || raw === "") continue;
    const current = Number(raw);
    if (!Number.isFinite(current)) continue;
    const oldDelta = Number(previous[key]) || 0;
    const base = current - oldDelta;
    const desired = Math.round(applyModifiers(base, applicableEffects(actor, effects), key, worldTime()));
    const delta = desired - base;
    next[key] = delta;
    if (delta !== oldDelta) updates[path] = desired;
  }
  if (JSON.stringify(previous) !== JSON.stringify(next)) updates[`flags.${MODULE_ID}.storedModifierDeltas`] = next;
  if (Object.keys(updates).length) await actor.update(updates);
}

function durationLabel(effect) {
  const duration = effect.duration;
  if (duration.type === "permanent") return "Permanente";
  if (duration.type === "rest") return "Até o descanso";
  if (["turns", "minutes", "hours"].includes(duration.type)) {
    const remaining = Math.max(0, duration.expiresAt - worldTime());
    const unit = duration.type === "hours" ? 3600 : duration.type === "turns" ? OD2_TIME.TURN_SECONDS : 60;
    return `${Math.ceil(remaining / unit)} ${DURATION_TYPES[duration.type].toLowerCase()}`;
  }
  return `${duration.remaining} ${DURATION_TYPES[duration.type].toLowerCase()}`;
}

async function confirmDelete(effect) {
  const content = `<p>Excluir o efeito <strong>${escapeHtml(effect.name)}</strong>?</p>`;
  const V2 = dialogV2();
  if (V2) return V2.confirm({ window: { title: "Excluir efeito" }, content, yes: { label: "Excluir" }, no: { label: "Cancelar" } });
  return Dialog.confirm({ title: "Excluir efeito", content });
}

function effectEditorContent(effect, actor) {
  const modifiers = effect.modifiers.length ? effect.modifiers : [{ key: "ac", mode: "add", value: 0 }];
  const effectKind = effect.duration.type === "permanent" ? "permanent" : "temporary";
  return `<form class="od2qdv-effect-editor">
    <div class="form-group"><label>Nome</label><input name="name" value="${escapeHtml(effect.name)}"></div>
    <div class="form-group"><label>Origem</label><input name="origin" value="${escapeHtml(effect.origin)}" placeholder="Habilidade, magia ou item"></div>
    <div class="form-group"><label>Ícone</label><input name="icon" value="${escapeHtml(effect.icon)}"></div>
    <div class="form-group"><label>Tipo do efeito</label><select name="effectKind"><option value="permanent" ${effectKind === "permanent" ? "selected" : ""}>Permanente</option><option value="temporary" ${effectKind === "temporary" ? "selected" : ""}>Temporário</option></select></div>
    <div class="form-group" data-effect-duration><label>Duração do temporário</label><select name="durationType">${Object.entries(DURATION_TYPES).filter(([key]) => key !== "permanent").map(([key, label]) => `<option value="${key}" ${effect.duration.type === key ? "selected" : ""}>${label}</option>`).join("")}</select><input name="durationValue" type="number" min="0" value="${effect.duration.value}"></div>
    <div class="form-group"><label>Usos disponíveis</label><input name="usesRemaining" type="number" min="0" value="${effect.uses.remaining}"><span>de</span><input name="usesMax" type="number" min="0" value="${effect.uses.max}"><label class="checkbox"><input name="usesReset" type="checkbox" ${effect.uses.resetOnRest ? "checked" : ""}> Recuperar no descanso</label></div>
    <div class="form-group stacked"><label>Descrição</label><textarea name="description">${escapeHtml(effect.description)}</textarea></div>
    <fieldset><legend>Modificadores</legend><div data-effect-modifiers>${modifiers.map((entry) => modifierRow(entry)).join("")}</div><button type="button" data-add-modifier><i class="fas fa-plus"></i> Modificador</button></fieldset>
    ${conditionalEditor(effect.conditional, actor)}
    ${eventActionEditor(effect.eventAction)}
    ${game.user.isGM ? `<div class="form-group stacked"><label>Notas exclusivas do Mestre</label><textarea name="gmNotes">${escapeHtml(effect.gmNotes)}</textarea></div>` : ""}
  </form>`;
}

function eventActionEditor(action) {
  return `<fieldset class="od2qdv-effect-action"><legend>Ação do efeito</legend>
    <div class="form-group"><label>Ação</label><select name="eventActionType">${selectOptions(EFFECT_EVENT_ACTIONS, action.type)}</select></div>
    <div class="form-group"><label>Fórmula ou quantidade</label><input name="eventActionFormula" value="${escapeHtml(action.formula)}" placeholder="1d20, 1d8 ou 1"></div>
    <div class="form-group"><label>Aplicar em</label><select name="eventActionTarget">${selectOptions(EFFECT_ACTION_TARGETS, action.target)}</select></div>
    <div class="form-group"><label>Item/recurso a consumir</label><input name="eventActionResource" value="${escapeHtml(action.resourceName)}" placeholder="Nome exato do item"></div>
    <div class="form-group"><label>Raio da aura</label><input name="eventActionRadius" type="number" min="0" step="1" value="${action.radius}"></div>
    <label class="checkbox"><input name="eventActionPrivate" type="checkbox" ${action.privateResult ? "checked" : ""}> Enviar resultado somente ao Mestre</label>
    <p class="hint">O gatilho é escolhido no campo “Quando” da condicional. Cura e dano usam a fórmula; consumir reduz a quantidade do item informado.</p>
  </fieldset>`;
}

function selectOptions(values, selected) {
  return Object.entries(values).map(([key, label]) => `<option value="${key}" ${key === selected ? "selected" : ""}>${label}</option>`).join("");
}

function conditionalValueOptions(actor, selected, type = "all") {
  const groups = new Map();
  for (const [key, label, group, types] of CONDITIONAL_VALUE_DEFINITIONS) {
    if (types !== "all" && !types.split(",").includes(actor.type)) continue;
    if (type === "boolean" && conditionalValueType(key) !== "boolean") continue;
    if (type === "number" && conditionalValueType(key) !== "number") continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(`<option value="${key}" ${key === selected ? "selected" : ""}>${label}</option>`);
  }
  return [...groups].map(([group, entries]) => `<optgroup label="${group}">${entries.join("")}</optgroup>`).join("");
}

function conditionalEditor(rule, actor) {
  const rightType = conditionalValueType(rule.left);
  const right = rightType === "boolean" && conditionalValueType(rule.right) !== "boolean" ? "boolean.true" : rule.right;
  const namedOperands = new Set(["item.named", "item.count", "class.named", "race.named", "classAbility.named", "raceAbility.named", "spell.named", "condition", "effect.inactive", "attack.itemNamed", "attack.ammunitionNamed", "target.speciesNamed", "target.conceptNamed", "target.alignmentNamed", "target.conditionNamed", "scene.environmentNamed"]);
  const systemConfig = CONFIG.olddragon2e ?? CONFIG.OLDDRAGON2E ?? {};
  const suggestions = [...actor.items].map((item) => item.name);
  suggestions.push(...Object.keys(systemConfig.monster_concepts ?? {}), ...Object.keys(systemConfig.alignment ?? {}));
  const itemNames = [...new Set(suggestions.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return `<fieldset class="od2qdv-conditional"><legend>Condicional</legend>
    <label class="checkbox"><input name="conditionalEnabled" type="checkbox" ${rule.enabled ? "checked" : ""}> Habilitar esta regra</label>
    <div data-conditional-options ${rule.enabled ? "" : "hidden"}>
      <div class="form-group"><label>Quando</label><select name="conditionalTrigger">${selectOptions(CONDITIONAL_TRIGGERS, rule.trigger)}</select></div>
      <div class="od2qdv-conditional-expression"><select name="conditionalFlow">${selectOptions(CONDITIONAL_FLOWS, rule.flow)}</select><select name="conditionalLeft">${conditionalValueOptions(actor, rule.left)}</select><select name="conditionalOperator">${selectOptions(CONDITIONAL_OPERATORS, rule.operator)}</select><select name="conditionalRight">${conditionalValueOptions(actor, right, rightType)}</select></div>
      <div class="form-group"><label>Número informado</label><input name="conditionalNumber" type="number" value="${rule.number}"></div>
      <div class="form-group" data-conditional-name ${namedOperands.has(rule.left) ? "" : "hidden"}><label>Nome específico</label><input name="conditionalConditionName" list="od2qdv-effect-item-names" value="${escapeHtml(rule.conditionName)}" placeholder="Selecione ou informe o nome exato"><datalist id="od2qdv-effect-item-names">${itemNames.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist></div>
      <div class="form-group"><label>Ao cumprir a condição</label><select name="conditionalResultAction">${selectOptions(CONDITIONAL_ACTIONS, rule.resultAction)}</select></div>
      <p class="hint">“Ativar este efeito” aplica os modificadores acima somente enquanto a condição for verdadeira.</p>
    </div>
  </fieldset>`;
}

function modifierRow(modifier = {}) {
  return `<div class="od2qdv-effect-modifier">
    <select name="modifierKey">${Object.entries(EFFECT_KEYS).map(([key, label]) => `<option value="${key}" ${modifier.key === key ? "selected" : ""}>${label}</option>`).join("")}</select>
    <select name="modifierMode">${Object.entries(EFFECT_MODES).map(([key, label]) => `<option value="${key}" ${modifier.mode === key ? "selected" : ""}>${label}</option>`).join("")}</select>
    <input name="modifierValue" type="text" value="${escapeHtml(modifier.value ?? "0")}" placeholder="2 ou 1d6" title="Aceita número ou fórmula de dado, como 1d6">
    <button type="button" data-remove-modifier title="Remover"><i class="fas fa-trash"></i></button>
  </div>`;
}

function bindModifierEditor(root, actor) {
  const application = root.closest?.(".application, .app") || root;
  application.classList?.add("od2qdv-effect-dialog");
  application.style?.setProperty("min-width", "520px");
  application.style?.setProperty("min-height", "420px");
  application.querySelector?.(".window-content")?.classList.add("scrollable");
  root.querySelector("[data-add-modifier]")?.addEventListener("click", () => {
    root.querySelector("[data-effect-modifiers]")?.insertAdjacentHTML("beforeend", modifierRow({ key: "ac", mode: "add", value: 0 }));
  });
  root.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-modifier]");
    if (remove) remove.closest(".od2qdv-effect-modifier")?.remove();
  });
  const kind = root.querySelector('[name="effectKind"]');
  const duration = root.querySelector("[data-effect-duration]");
  const refreshDuration = () => {
    if (duration) duration.hidden = kind?.value === "permanent";
    const value = root.querySelector('[name="durationValue"]');
    if (kind?.value === "temporary" && value && Number(value.value) <= 0) value.value = "1";
  };
  kind?.addEventListener("change", refreshDuration);
  const conditionalEnabled = root.querySelector('[name="conditionalEnabled"]');
  const conditionalOptions = root.querySelector("[data-conditional-options]");
  const refreshConditional = () => {
    if (conditionalOptions) conditionalOptions.hidden = !conditionalEnabled?.checked;
  };
  conditionalEnabled?.addEventListener("change", refreshConditional);
  const conditionalLeft = root.querySelector('[name="conditionalLeft"]');
  const conditionalRight = root.querySelector('[name="conditionalRight"]');
  const conditionalName = root.querySelector("[data-conditional-name]");
  const namedOperands = new Set(["item.named", "item.count", "class.named", "race.named", "classAbility.named", "raceAbility.named", "spell.named", "condition", "effect.inactive", "attack.itemNamed", "attack.ammunitionNamed", "target.speciesNamed", "target.conceptNamed", "target.alignmentNamed", "target.conditionNamed", "scene.environmentNamed"]);
  const refreshConditionalOperand = () => {
    const type = conditionalValueType(conditionalLeft.value);
    const selected = type === "boolean" ? "boolean.true" : "number";
    if (conditionalRight) conditionalRight.innerHTML = conditionalValueOptions(actor, selected, type);
    if (conditionalName) conditionalName.hidden = !namedOperands.has(conditionalLeft.value);
  };
  conditionalLeft?.addEventListener("change", refreshConditionalOperand);
  refreshDuration();
  refreshConditional();
}

function readEffectForm(form, existing) {
  const rows = [...form.querySelectorAll(".od2qdv-effect-modifier")];
  const durationType = form.elements.effectKind.value === "permanent" ? "permanent" : form.elements.durationType.value;
  const durationValue = Math.max(0, Math.trunc(Number(form.elements.durationValue.value) || 0));
  const seconds = durationType === "hours" ? durationValue * 3600
    : durationType === "minutes" ? durationValue * 60
      : durationType === "turns" ? durationValue * OD2_TIME.TURN_SECONDS : 0;
  return normalizeEffect({
    ...existing,
    name: form.elements.name.value,
    origin: form.elements.origin.value,
    icon: form.elements.icon.value,
    description: form.elements.description.value,
    gmNotes: form.elements.gmNotes?.value || existing.gmNotes,
    duration: { type: durationType, value: durationValue, remaining: durationValue, expiresAt: seconds ? worldTime() + seconds : 0 },
    conditional: {
      enabled: form.elements.conditionalEnabled.checked,
      trigger: form.elements.conditionalTrigger.value,
      flow: form.elements.conditionalFlow.value,
      left: form.elements.conditionalLeft.value,
      operator: form.elements.conditionalOperator.value,
      right: form.elements.conditionalRight.value,
      number: form.elements.conditionalNumber.value,
      conditionName: form.elements.conditionalConditionName.value,
      resultAction: form.elements.conditionalResultAction.value,
      maxIterations: existing.conditional.maxIterations
    },
    eventAction: {
      type: form.elements.eventActionType.value,
      formula: form.elements.eventActionFormula.value,
      target: form.elements.eventActionTarget.value,
      resourceName: form.elements.eventActionResource.value,
      radius: form.elements.eventActionRadius.value,
      privateResult: form.elements.eventActionPrivate.checked
    },
    uses: { max: form.elements.usesMax.value, remaining: form.elements.usesRemaining.value, resetOnRest: form.elements.usesReset.checked },
    modifiers: rows.map((row) => ({
      key: row.querySelector('[name="modifierKey"]').value,
      mode: row.querySelector('[name="modifierMode"]').value,
      value: row.querySelector('[name="modifierValue"]').value
    }))
  }, () => existing.id || foundry.utils.randomID());
}

async function editEffect(actor, existing = normalizeEffect({}, () => foundry.utils.randomID())) {
  const V2 = dialogV2();
  let result;
  if (V2) {
    result = await V2.wait({
      window: { title: existing.name === "Novo efeito" ? "Criar efeito" : `Editar: ${existing.name}`, resizable: true },
      content: effectEditorContent(existing, actor),
      position: { width: 650, height: Math.min(800, Math.max(520, window.innerHeight - 120)) },
      buttons: [
        { action: "save", icon: "fa-solid fa-floppy-disk", label: "Salvar", default: true, callback: (_event, button) => readEffectForm(button.form, existing) },
        { action: "cancel", label: "Cancelar" }
      ],
      render: (_event, dialog) => bindModifierEditor(dialog.element, actor)
    });
  } else {
    result = await new Promise((resolve) => {
      const dialog = new Dialog({
        title: existing.name === "Novo efeito" ? "Criar efeito" : `Editar: ${existing.name}`,
        content: effectEditorContent(existing, actor),
        buttons: {
          save: { icon: '<i class="fas fa-save"></i>', label: "Salvar", callback: (html) => resolve(readEffectForm(html[0].querySelector("form"), existing)) },
          cancel: { label: "Cancelar", callback: () => resolve(null) }
        },
        default: "save", close: () => resolve(null), render: (html) => bindModifierEditor(html[0], actor)
      }, { width: 650, height: Math.min(800, Math.max(520, window.innerHeight - 120)), resizable: true });
      dialog.render(true);
    });
  }
  if (!result || typeof result !== "object" || !Array.isArray(result.modifiers)) return false;
  try { await resolveEffectRolls(result); }
  catch (error) { ui.notifications.error(`Não foi possível rolar o modificador: ${error.message}`); return false; }
  const effects = effectsFor(actor);
  const index = effects.findIndex((effect) => effect.id === result.id);
  if (index >= 0) effects[index] = result;
  else effects.push(result);
  await saveEffects(actor, effects);
  return true;
}

function measureTokenDistance(origin, target) {
  if (!origin || !target || origin === target) return 0;
  const from = origin.center ?? { x: origin.x, y: origin.y };
  const to = target.center ?? { x: target.x, y: target.y };
  const grid = globalThis.canvas?.grid;
  try {
    const measured = grid?.measurePath?.([from, to]);
    if (Number.isFinite(measured?.distance)) return measured.distance;
  } catch (_error) { /* usa o cálculo geométrico abaixo */ }
  const size = Number(globalThis.canvas?.dimensions?.size) || 1;
  const unit = Number(globalThis.canvas?.dimensions?.distance) || 1;
  return Math.hypot(Number(to.x) - Number(from.x), Number(to.y) - Number(from.y)) / size * unit;
}

function actorSnapshot(actor, context = {}) {
  const system = actor.system;
  const hpValue = Number(system.hp?.value) || 0;
  const hpMax = Math.max(1, Number(system.hp?.max) || 1);
  const attributes = ["forca", "destreza", "constituicao", "inteligencia", "sabedoria", "carisma"].map((key) => Number(system[key]) || 0);
  const items = [...actor.items];
  const equipment = items.filter((item) => ["weapon", "armor", "shield", "misc", "container", "vehicle"].includes(item.type));
  const coins = actorCoins(actor);
  const currentLoad = actor.type === "monster" ? carriedLoad(equipment, coins) : Number(system.load_current) || 0;
  const maxLoad = Number(system.load_max) || 0;
  const qdvEffects = effectsFor(actor);
  const movementNormal = Number(system.current_movement ?? system.mv) || 0;
  const combat = game.combat;
  const inCombat = Boolean(combat?.combatants?.some((combatant) => combatant.actor?.id === actor.id));
  const monsterAttacks = system.monster_attack_items ?? items.filter((item) => item.type === "monster_attack");
  const attackItem = context.item ?? context.weapon ?? null;
  const ammunition = context.ammunition ?? null;
  const attackMode = String(context.attackMode ?? attackItem?.system?.type ?? "").toLocaleLowerCase("pt-BR");
  const attackBasis = String(context.attackBasis ?? context.ba ?? "").toLocaleLowerCase("pt-BR");
  const isMagic = (item) => Boolean(item?.system?.magic_item ?? item?.system?.is_magic ?? item?.system?.magical);
  const selectedTokens = context.targets ? [...context.targets] : [...(game.user.targets ?? [])];
  const targetActor = context.targetActor ?? context.target?.actor ?? selectedTokens[0]?.actor ?? (context.target?.documentName === "Actor" ? context.target : null);
  const targetSystem = targetActor?.system ?? {};
  const targetItems = targetActor ? [...targetActor.items] : [];
  const targetQdvEffects = targetActor ? effectsFor(targetActor) : [];
  const targetRaceNames = targetItems.filter((item) => item.type === "race").map((item) => item.name);
  const targetConcept = String(targetSystem.concept ?? targetSystem.species ?? "").trim();
  const targetAlignment = String(targetSystem.alignment ?? targetSystem.details?.alignment ?? "").trim();
  const dvMatch = String(targetSystem.dv ?? "").match(/\d+(?:[.,]\d+)?/);
  const targetDv = dvMatch ? Number(dvMatch[0].replace(",", ".")) : 0;
  const targetConditions = targetActor ? [
    ...(targetActor.effects || []).map((entry) => entry.name ?? entry.label),
    ...targetQdvEffects.filter((entry) => entry.enabled).map((entry) => entry.name),
    ...[...(targetActor.statuses || [])]
  ].filter(Boolean) : [];
  const originToken = context.originToken ?? actor.getActiveTokens?.()[0] ?? null;
  const targetToken = context.targetToken ?? context.target?.object ?? context.target ?? selectedTokens.find((token) => token.actor?.id === targetActor?.id) ?? targetActor?.getActiveTokens?.()[0] ?? null;
  const targetDistance = measureTokenDistance(originToken, targetToken);
  const scene = context.scene ?? globalThis.canvas?.scene ?? game.scenes?.active;
  const sceneEnvironment = String(scene?.getFlag?.(MODULE_ID, "environment") || "").trim();
  return {
    values: {
      "hp.value": hpValue, "hp.max": hpMax, "hp.lost": Math.max(0, hpMax - hpValue), "hp.percent": Math.round(hpValue / hpMax * 100),
      "hp.isFull": hpValue >= hpMax, "hp.isWounded": hpValue < hpMax, "hp.isHalf": hpValue <= hpMax / 2, "hp.isZero": hpValue <= 0,
      level: system.level, "xp.current": system.current_xp, "xp.next": system.next_level_xp, reputation: system.details?.reputation,
      forca: system.forca, mod_forca: system.mod_forca, destreza: system.destreza, mod_destreza: system.mod_destreza,
      constituicao: system.constituicao, mod_constituicao: system.mod_constituicao, inteligencia: system.inteligencia, mod_inteligencia: system.mod_inteligencia,
      sabedoria: system.sabedoria, mod_sabedoria: system.mod_sabedoria, carisma: system.carisma, mod_carisma: system.mod_carisma,
      "attribute.highest": Math.max(...attributes), "attribute.lowest": Math.min(...attributes),
      "ac.base": system.ac_base, "ac.armor": system.ac_armor, "ac.shield": system.ac_shield, "ac.extra": system.ac_extra,
      ac: Number(system.ac_total ?? system.ca) || 0, ba: system.ba, bac: system.bac, bad: system.bad,
      "combat.active": inCombat, "combat.turn": combat?.combatant?.actor?.id === actor.id, "combat.round": combat?.round || 0,
      "targets.count": selectedTokens.length, "jp.base": system.jp, jpd: system.jpd_total, jpc: system.jpc_total, jps: system.jps_total,
      "movement.normal": movementNormal, "movement.run": Number(system.movement_run ?? system.mvc) || 0,
      "movement.climb": Number(system.movement_climb ?? system.mve) || 0, "movement.swim": Number(system.movement_swim ?? system.mvn) || 0,
      "movement.fly": Number(system.movement_fly ?? system.mvv) || 0, "movement.canFly": Number(system.movement_fly ?? system.mvv) > 0,
      "movement.canSwim": Number(system.movement_swim ?? system.mvn) > 0,
      "coins.gp": coins.gp, "coins.sp": coins.sp, "coins.cp": coins.cp, "coins.total": coins.gp + coins.sp + coins.cp,
      "load.current": currentLoad, "load.max": maxLoad, "load.available": Math.max(0, maxLoad - currentLoad),
      "load.percent": maxLoad ? Math.round(currentLoad / maxLoad * 100) : 0, "load.over": maxLoad > 0 && currentLoad > maxLoad,
      "item.weapon": items.some((item) => item.type === "weapon"), "item.weaponEquipped": items.some((item) => item.type === "weapon" && item.system.is_equipped),
      "item.armorEquipped": items.some((item) => item.type === "armor" && item.system.is_equipped), "item.shieldEquipped": items.some((item) => item.type === "shield" && item.system.is_equipped),
      "item.ammunitionEquipped": items.some((item) => item.type === "weapon" && item.system.type === "ammunition" && item.system.is_equipped),
      "item.container": items.some((item) => item.type === "container"), "item.magic": equipment.some((item) => item.system.magic_item),
      "attack.itemNamed": Boolean(attackItem), "attack.weaponMelee": attackMode === "melee",
      "attack.weaponRanged": attackMode === "ranged", "attack.weaponThrowing": attackMode === "throwing",
      "attack.usesBAC": attackBasis === "bac" || attackMode === "melee",
      "attack.usesBAD": attackBasis === "bad" || ["ranged", "throwing"].includes(attackMode),
      "attack.usesAmmunition": Boolean(ammunition), "attack.ammunitionNamed": Boolean(ammunition),
      "attack.itemMagic": isMagic(attackItem), "attack.ammunitionMagic": isMagic(ammunition),
      "target.speciesNamed": Boolean(targetActor), "target.conceptNamed": Boolean(targetConcept),
      "target.alignmentNamed": Boolean(targetAlignment), "target.conditionNamed": targetConditions.length > 0,
      "target.isMonster": targetActor?.type === "monster", "target.dv": targetDv,
      "target.selected": Boolean(targetActor), "target.distance": targetDistance,
      "scene.environmentNamed": Boolean(scene), "scene.darkness": Number(scene?.darkness) || 0,
      "rogue.has": Boolean(system.has_rogue_talents), "rogue.remaining": system.rogue_talent_points_remaining,
      "spell.count": items.filter((item) => item.type === "spell").length, "scroll.has": items.some((item) => item.getFlag?.(MODULE_ID, "scroll")),
      "effect.temporary": qdvEffects.some((effect) => effect.enabled && effect.duration.type !== "permanent"),
      "effect.passive": qdvEffects.some((effect) => effect.enabled && effect.duration.type === "permanent"),
      "monster.dv": system.dv, "monster.dvBonus": system.dv_bonus, "monster.jp": system.jp, "monster.morale": system.mo,
      "monster.xp": system.xp, "monster.variant": system.variant, "monster.attackCount": monsterAttacks.length,
      "retainer.heroicUsed": system.heroic_action_used, "retainer.hpSuggested": system.hp_max_suggested
    },
    items: items.map((item) => item.name), classes: items.filter((item) => item.type === "class").map((item) => item.name),
    races: items.filter((item) => item.type === "race").map((item) => item.name),
    classAbilities: items.filter((item) => item.type === "class_ability").map((item) => item.name),
    raceAbilities: items.filter((item) => item.type === "race_ability").map((item) => item.name),
    spells: items.filter((item) => item.type === "spell").map((item) => item.name),
    attackItems: attackItem ? [attackItem.name] : [], ammunitionItems: ammunition ? [ammunition.name] : [],
    targetSpecies: targetActor ? [targetActor.name, ...targetRaceNames] : [],
    targetConcepts: targetConcept ? [targetConcept] : [], targetAlignments: targetAlignment ? [targetAlignment] : [],
    targetConditions,
    sceneEnvironments: [sceneEnvironment, scene?.name].filter(Boolean),
    inactiveEffects: qdvEffects.filter((effect) => !effect.enabled).map((effect) => effect.name),
    conditions: [
      ...(actor.effects || []).map((entry) => entry.name ?? entry.label),
      ...qdvEffects.filter((entry) => entry.enabled).map((entry) => entry.name),
      ...[...(actor.statuses || [])]
    ].filter(Boolean)
  };
}

function applicableEffects(actor, effects, context = {}) {
  const current = activeEffects(effects, worldTime());
  const conditional = current.filter((effect) => effect.conditional.enabled);
  if (!conditional.length) return current;
  const alreadyEvaluating = evaluatingModifiers.has(actor);
  if (!alreadyEvaluating) evaluatingModifiers.add(actor);
  try {
    const snapshot = actorSnapshot(actor, context);
    return current.filter((effect) => conditionalEffectApplies(effect, snapshot));
  } finally {
    if (!alreadyEvaluating) evaluatingModifiers.delete(actor);
  }
}

async function rollConditionalValue(formula, actor) {
  const roll = new Roll(String(formula || "0"), actor.getRollData?.() ?? {});
  await roll.roll();
  return Number(roll.total) || 0;
}

function sameName(first, second) {
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  return normalize(first) === normalize(second);
}

async function executeConditionalAction(actor, action, sourceEffect) {
  if (!action || action.type === "none") return false;
  if (["hpAdd", "hpReduce", "hpSet"].includes(action.type)) {
    const rolled = await rollConditionalValue(action.value, actor);
    const before = Number(actor.system.hp?.value) || 0;
    const maximum = Number(actor.system.hp?.max) || 1;
    const after = applyHpAction(before, maximum, action, rolled);
    await actor.update({ "system.hp.value": after });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="od2qdv-effect-message"><strong>${escapeHtml(sourceEffect.name)}</strong><p>${escapeHtml(CONDITIONAL_ACTIONS[action.type])}: ${before} → ${after} PV.</p><p>${escapeHtml(action.value)} = <strong>${rolled}</strong></p></div>` });
    return before !== after;
  }
  if (["enableEffect", "disableEffect"].includes(action.type)) {
    const effects = effectsFor(actor);
    const target = effects.find((entry) => sameName(entry.name, action.target));
    if (!target) { ui.notifications.warn(`Efeito “${action.target}” não encontrado em ${actor.name}.`); return false; }
    const enabledState = action.type === "enableEffect";
    if (target.enabled === enabledState) return false;
    target.enabled = enabledState;
    if (enabledState) await resolveEffectRolls(target);
    await saveEffects(actor, effects);
    return true;
  }
  if (action.type === "chat") {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="od2qdv-effect-message"><strong>${escapeHtml(sourceEffect.name)}</strong><p>${escapeHtml(action.value)}</p></div>` });
    return true;
  }
  return false;
}

async function executeEventAction(actor, effect, context = {}) {
  const action = effect.eventAction;
  if (!action || action.type === "none") return false;
  if (effect.uses.max > 0 && effect.uses.remaining <= 0) { ui.notifications.warn(`O efeito “${effect.name}” não possui usos restantes.`); return false; }
  const selected = context.targets ? [...context.targets] : [...(game.user.targets ?? [])];
  const firstTarget = context.targetActor ?? context.target?.actor ?? selected[0]?.actor;
  const originToken = context.originToken ?? actor.getActiveTokens?.()[0];
  let recipients = action.target === "self" ? [actor] : action.target === "target" ? [firstTarget] : action.target === "targets" ? selected.map((token) => token.actor) : [];
  if (["alliesAura", "enemiesAura"].includes(action.target)) {
    const originDisposition = originToken?.document?.disposition ?? originToken?.disposition;
    recipients = (globalThis.canvas?.tokens?.placeables ?? []).filter((token) => {
      if (!token.actor || token === originToken || measureTokenDistance(originToken, token) > action.radius) return false;
      const disposition = token.document?.disposition ?? token.disposition;
      return action.target === "alliesAura" ? disposition === originDisposition : disposition !== originDisposition;
    }).map((token) => token.actor);
  }
  recipients = [...new Map(recipients.filter(Boolean).map((entry) => [entry.id, entry])).values()];
  if (!recipients.length && action.type !== "consumeItem") { ui.notifications.warn(`O efeito “${effect.name}” precisa de um alvo válido.`); return false; }
  const needsRoll = ["roll", "heal", "damage", "consumeItem"].includes(action.type);
  const roll = needsRoll ? new Roll(action.formula, actor.getRollData?.() ?? {}) : null;
  if (roll) await roll.roll();
  const value = Math.max(0, Number(roll?.total) || 0);
  let detail = roll ? `${action.formula} = <strong>${value}</strong>` : "Ação executada.";
  if (["heal", "damage"].includes(action.type)) {
    const results = [];
    for (const recipient of recipients) {
      if (!recipient.isOwner) { results.push(`${escapeHtml(recipient.name)}: sem permissão`); continue; }
      const before = Number(recipient.system.hp?.value) || 0;
      const maximum = Math.max(1, Number(recipient.system.hp?.max) || 1);
      const after = action.type === "heal" ? Math.min(maximum, before + value) : Math.max(0, before - value);
      await recipient.update({ "system.hp.value": after });
      results.push(`${escapeHtml(recipient.name)}: <strong>${before} → ${after} PV</strong>`);
    }
    detail = `${action.type === "heal" ? "Cura" : "Dano"} (${action.formula} = ${value})<br>${results.join("<br>")}`;
  }
  if (action.type === "consumeItem") {
    const item = [...actor.items].find((entry) => sameName(entry.name, action.resourceName));
    if (!item) { ui.notifications.warn(`Item/recurso “${action.resourceName}” não encontrado em ${actor.name}.`); return false; }
    const before = Math.max(0, Number(item.system.quantity ?? item.system.uses?.value) || 0);
    const after = Math.max(0, before - Math.max(1, Math.trunc(value)));
    const path = item.system.quantity !== undefined ? "system.quantity" : "system.uses.value";
    await item.update({ [path]: after });
    detail = `${escapeHtml(item.name)}: <strong>${before} → ${after}</strong>`;
  }
  if (action.type === "prepareSpell") {
    const spell = [...actor.items].find((entry) => entry.type === "spell" && sameName(entry.name, action.resourceName));
    if (!spell) { ui.notifications.warn(`Magia “${action.resourceName}” não encontrada em ${actor.name}.`); return false; }
    await spell.update({ "flags.olddragon2e.spell.memorized": true });
    detail = `Magia preparada: <strong>${escapeHtml(spell.name)}</strong>`;
  }
  if (action.type === "summon") {
    const summoned = game.actors.find((entry) => sameName(entry.name, action.resourceName));
    const scene = globalThis.canvas?.scene;
    const origin = actor.getActiveTokens?.()[0];
    if (!summoned || !scene || !origin) { ui.notifications.warn(`Não foi possível invocar “${action.resourceName}” nesta cena.`); return false; }
    const token = await summoned.getTokenDocument({ x: origin.document.x + (globalThis.canvas?.dimensions?.size || 100), y: origin.document.y });
    await scene.createEmbeddedDocuments("Token", [token.toObject()]);
    detail = `Invocado: <strong>${escapeHtml(summoned.name)}</strong>`;
  }
  if (action.type === "transform") {
    const form = game.actors.find((entry) => sameName(entry.name, action.resourceName));
    const tokens = actor.getActiveTokens?.() ?? [];
    if (!form || !tokens.length) { ui.notifications.warn(`Forma “${action.resourceName}” não encontrada ou sem token ativo.`); return false; }
    const originals = tokens.map((token) => ({ uuid: token.document.uuid, name: token.document.name, texture: token.document.texture?.src }));
    for (const token of tokens) await token.document.update({ name: `${actor.name} (${form.name})`, "texture.src": form.prototypeToken?.texture?.src || form.img });
    await actor.setFlag(MODULE_ID, "transformedForm", { actorUuid: form.uuid, name: form.name, originals });
    detail = `Aparência assumida: <strong>${escapeHtml(form.name)}</strong>. Os atributos originais foram preservados.`;
  }
  if (action.type === "revertTransform") {
    const transformed = actor.getFlag(MODULE_ID, "transformedForm");
    if (!transformed?.originals?.length) { ui.notifications.warn(`${actor.name} não possui uma transformação registrada.`); return false; }
    for (const original of transformed.originals) {
      const token = await fromUuid(original.uuid);
      if (token) await token.update({ name: original.name, "texture.src": original.texture });
    }
    await actor.unsetFlag(MODULE_ID, "transformedForm");
    detail = "A aparência original foi restaurada.";
  }
  if (effect.uses.max > 0) {
    const effects = effectsFor(actor);
    const stored = effects.find((entry) => entry.id === effect.id);
    if (stored) { stored.uses.remaining = Math.max(0, stored.uses.remaining - 1); await saveEffects(actor, effects); }
  }
  const message = { speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="od2qdv-effect-message"><strong>${escapeHtml(effect.name)}</strong><p>${detail}</p></div>` };
  if (action.privateResult) message.whisper = game.users.filter((user) => user.isGM).map((user) => user.id);
  await ChatMessage.create(message);
  return true;
}

async function executeConditional(actor, effect, trigger = "manual") {
  const rule = effect?.conditional;
  if (!effect?.enabled || !rule?.enabled || (trigger !== "manual" && rule.trigger !== trigger)) return false;
  if (executingConditionals.has(actor.id)) return false;
  executingConditionals.add(actor.id);
  try {
    const matches = () => conditionalMatches(rule, actorSnapshot(actor));
    if (effect.eventAction?.type !== "none") return matches() ? executeEventAction(actor, effect) : false;
    if (rule.flow !== "while") return executeConditionalAction(actor, matches() ? rule.thenAction : rule.elseAction, effect);
    if (!matches()) return executeConditionalAction(actor, rule.elseAction, effect);
    let changed = false;
    for (let iteration = 0; iteration < rule.maxIterations && matches(); iteration += 1) {
      const applied = await executeConditionalAction(actor, rule.thenAction, effect);
      changed ||= applied;
      if (!applied) break;
    }
    return changed;
  } catch (error) {
    console.error(`${MODULE_ID} | Falha ao executar condicional`, error);
    ui.notifications.error(`Falha na condicional “${effect.name}”: ${error.message}`);
    return false;
  } finally { executingConditionals.delete(actor.id); }
}

async function triggerActorEffects(actor, trigger, context = {}) {
  if (!enabled() || !actor || executingConditionals.has(actor.id)) return false;
  let changed = false;
  for (const effect of activeEffects(effectsFor(actor), worldTime())) {
    if (!effect.conditional.enabled || effect.conditional.trigger !== trigger) continue;
    if (!conditionalEffectApplies(effect, actorSnapshot(actor, context))) continue;
    try { changed = (await executeEventAction(actor, effect, context)) || changed; }
    catch (error) {
      console.error(`${MODULE_ID} | Falha na ação do efeito “${effect.name}”`, error);
      ui.notifications.error(`Falha na ação “${effect.name}”: ${error.message}`);
    }
  }
  return changed;
}

async function completeActorRest(actor) {
  if (!actor) return false;
  await triggerActorEffects(actor, "rest", {});
  const effects = effectsFor(actor);
  let changed = false;
  for (const effect of effects) {
    if (effect.uses.resetOnRest && effect.uses.remaining !== effect.uses.max) { effect.uses.remaining = effect.uses.max; changed = true; }
    if (effect.enabled && effect.duration.type === "rest") { effect.enabled = false; changed = true; }
  }
  if (changed) await saveEffects(actor, effects);
  return changed;
}

async function executeActorConditionals(actor, trigger) {
  if (!enabled() || !actor) return;
  for (const effect of activeEffects(effectsFor(actor), worldTime())) await executeConditional(actor, effect, trigger);
}

function newEffectForCategory(category) {
  const source = { enabled: category !== "inactive" };
  if (category === "temporary") source.duration = { type: "rounds", value: 1, remaining: 1 };
  return normalizeEffect(source, () => foundry.utils.randomID());
}

function effectRow(effect) {
  const summary = effect.modifiers.map((entry) => `${EFFECT_KEYS[entry.key]} ${EFFECT_MODES[entry.mode]} ${entry.value}${/[dD]/.test(entry.value) && entry.resolvedValue != null ? ` = ${entry.resolvedValue}` : ""}`).join(" · ");
  return `<tr data-effect-id="${effect.id}" class="od2qdv-effect-row ${effect.enabled ? "" : "is-disabled"}">
    <td class="effect-icon"><img src="${escapeHtml(effect.icon)}" alt="" width="32" height="32"></td>
    <td class="effect-name"><strong>${escapeHtml(effect.name)}</strong>${summary ? `<small>${escapeHtml(summary)}</small>` : ""}</td>
    <td class="effect-source">${escapeHtml(effect.origin)}</td><td class="effect-duration">${durationLabel(effect)}</td>
    <td class="actions">${effect.conditional.enabled ? '<button type="button" data-effect-action="execute" title="Executar condicional"><i class="fas fa-play"></i></button>' : ""}<button type="button" data-effect-action="toggle-conditional" class="${effect.conditional.enabled ? "conditional-active" : ""}" title="${effect.conditional.enabled ? "Desabilitar condicional" : "Habilitar condicional"}"><i class="fas fa-code-branch"></i></button><button type="button" data-effect-action="toggle" title="${effect.enabled ? "Desativar efeito" : "Ativar efeito"}"><i class="fas fa-${effect.enabled ? "toggle-on" : "toggle-off"}"></i></button><button type="button" data-effect-action="edit" title="Editar"><i class="fas fa-edit"></i></button><button type="button" data-effect-action="delete" title="Excluir"><i class="fas fa-trash"></i></button></td>
  </tr>`;
}

function effectGroup(title, category, effects) {
  const rows = effects.length ? effects.map(effectRow).join("") : '<tr><td colspan="5" class="empty">Nenhum efeito nesta categoria.</td></tr>';
  return `<tbody class="od2qdv-effect-group" data-effect-group="${category}"><tr class="group-heading"><th colspan="2">${title}</th><th>Origem</th><th>Duração</th><th><button type="button" data-effect-create="${category}"><i class="fas fa-plus"></i> Adicionar</button></th></tr>${rows}</tbody>`;
}

function managerContent(actor) {
  const effects = effectsFor(actor);
  const temporary = effects.filter((effect) => effect.enabled && effect.duration.type !== "permanent");
  const passive = effects.filter((effect) => effect.enabled && effect.duration.type === "permanent");
  const inactive = effects.filter((effect) => !effect.enabled);
  return `<div class="od2qdv-effect-manager"><div class="od2qdv-effect-toolbar"><button type="button" data-effect-rest><i class="fas fa-bed"></i> Concluir descanso</button>${game.user.isGM ? '<button type="button" data-effect-history><i class="fas fa-history"></i> Histórico temporal</button>' : ""}</div><table>${effectGroup("Efeitos Temporários", "temporary", temporary)}${effectGroup("Efeitos Passivos", "passive", passive)}${effectGroup("Efeitos Inativos", "inactive", inactive)}</table></div>`;
}

async function openManager(actor) {
  if (!actor?.isOwner) return ui.notifications.warn("Você não possui permissão para alterar os efeitos deste ator.");
  const V2 = dialogV2();
  const bind = (root, close) => {
    root.querySelector("[data-effect-rest]")?.addEventListener("click", async () => { await completeActorRest(actor); close(); openManager(actor); });
    root.querySelector("[data-effect-history]")?.addEventListener("click", openTemporalHistory);
    root.querySelectorAll("[data-effect-create]").forEach((button) => button.addEventListener("click", async () => { if (await editEffect(actor, newEffectForCategory(button.dataset.effectCreate))) { close(); openManager(actor); } }));
    root.querySelector(".od2qdv-effect-manager table")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-effect-action]");
      if (!button) return;
      const id = button.closest("[data-effect-id]")?.dataset.effectId;
      const effects = effectsFor(actor);
      const effect = effects.find((entry) => entry.id === id);
      if (!effect) return;
      if (button.dataset.effectAction === "edit") { if (await editEffect(actor, effect)) { close(); openManager(actor); } return; }
      if (button.dataset.effectAction === "execute") { await executeConditional(actor, effect); close(); openManager(actor); return; }
      if (button.dataset.effectAction === "toggle-conditional") effect.conditional.enabled = !effect.conditional.enabled;
      if (button.dataset.effectAction === "delete" && !(await confirmDelete(effect))) return;
      if (button.dataset.effectAction === "delete") effects.splice(effects.indexOf(effect), 1);
      if (button.dataset.effectAction === "toggle") {
        effect.enabled = !effect.enabled;
        if (effect.enabled) {
          try { await resolveEffectRolls(effect); }
          catch (error) { ui.notifications.error(`Não foi possível rolar o modificador: ${error.message}`); return; }
        }
      }
      await saveEffects(actor, effects);
      if (button.dataset.effectAction === "toggle" && effect.enabled) await executeConditional(actor, effect, "enable");
      close(); openManager(actor);
    });
  };
  if (V2) {
    await V2.wait({
      window: { title: `Efeitos: ${actor.name}` }, content: managerContent(actor), position: { width: 800 },
      buttons: [{ action: "close", label: "Fechar" }],
      render: (_event, dialog) => bind(dialog.element, () => dialog.close())
    });
  } else {
    const dialog = new Dialog({ title: `Efeitos: ${actor.name}`, content: managerContent(actor), buttons: { close: { label: "Fechar" } }, render: (html) => bind(html[0], () => dialog.close()) }, { width: 800 });
    dialog.render(true);
  }
}

function rootElement(html) {
  if (html instanceof HTMLElement) return html;
  return html?.[0] ?? html;
}

function activateEffectTab(app, root) {
  app._od2QdvEffectTabActive = true;
  const controller = app._tabs?.[0];
  if (controller?.activate) return controller.activate("od2qdv-effects");
  root.querySelectorAll('nav.tabs[data-group="primary-tabs"] .item').forEach((element) => element.classList.toggle("active", element.dataset.tab === "od2qdv-effects"));
  root.querySelectorAll("section.section > .tab").forEach((element) => element.classList.toggle("active", element.dataset.tab === "od2qdv-effects"));
}

function enhanceEffectTab(app, html) {
  if (!enabled()) return;
  const actor = app.actor ?? app.document;
  const root = rootElement(html);
  const nav = root?.querySelector('nav.tabs[data-group="primary-tabs"]');
  const section = root?.querySelector("section.section");
  if (!actor?.isOwner || !nav || !section) return;
  if (!nav.querySelector('[data-tab="od2qdv-effects"]')) {
    const link = '<a class="item" data-tab="od2qdv-effects"><i class="fas fa-wand-magic-sparkles"></i> Efeitos</a>';
    const details = nav.querySelector('[data-tab="details"]');
    if (details) details.insertAdjacentHTML("afterend", link);
    else nav.insertAdjacentHTML("beforeend", link);
  }
  if (!section.querySelector('[data-tab="od2qdv-effects"]')) {
    const tab = `<div class="tab od2qdv-effect-tab" data-group="primary-tabs" data-tab="od2qdv-effects">${managerContent(actor)}</div>`;
    const details = section.querySelector('[data-tab="details"]');
    if (details) details.insertAdjacentHTML("afterend", tab);
    else section.insertAdjacentHTML("beforeend", tab);
  }
  if (app._od2QdvEffectTabActive) activateEffectTab(app, root);
  if (boundSheets.has(root)) return;
  boundSheets.add(root);
  root.addEventListener("click", async (event) => {
    if (event.target.closest('nav.tabs[data-group="primary-tabs"] [data-tab="od2qdv-effects"]')) {
      event.preventDefault(); activateEffectTab(app, root); return;
    }
    if (event.target.closest('nav.tabs[data-group="primary-tabs"] .item')) app._od2QdvEffectTabActive = false;
    const history = event.target.closest("[data-effect-history]");
    if (history) { event.preventDefault(); event.stopPropagation(); await openTemporalHistory(); return; }
    const rest = event.target.closest("[data-effect-rest]");
    if (rest) {
      event.preventDefault(); event.stopPropagation();
      await completeActorRest(actor);
      app._od2QdvEffectTabActive = true;
      app.render(false);
      return;
    }
    const create = event.target.closest("[data-effect-create]");
    if (create) {
      event.preventDefault(); event.stopPropagation();
      if (await editEffect(actor, newEffectForCategory(create.dataset.effectCreate))) { app._od2QdvEffectTabActive = true; app.render(false); }
      return;
    }
    const button = event.target.closest("[data-effect-action]");
    if (!button || !button.closest(".od2qdv-effect-tab")) return;
    event.preventDefault(); event.stopPropagation();
    const effects = effectsFor(actor);
    const effect = effects.find((entry) => entry.id === button.closest("[data-effect-id]")?.dataset.effectId);
    if (!effect) return;
    const action = button.dataset.effectAction;
    if (action === "execute") {
      await executeConditional(actor, effect);
      app._od2QdvEffectTabActive = true;
      app.render(false);
      return;
    }
    if (action === "toggle-conditional") effect.conditional.enabled = !effect.conditional.enabled;
    if (action === "edit") {
      if (await editEffect(actor, effect)) { app._od2QdvEffectTabActive = true; app.render(false); }
      return;
    }
    if (action === "delete" && !(await confirmDelete(effect))) return;
    if (action === "delete") effects.splice(effects.indexOf(effect), 1);
    if (action === "toggle") {
      effect.enabled = !effect.enabled;
      if (effect.enabled) {
        try { await resolveEffectRolls(effect); }
        catch (error) { ui.notifications.error(`Não foi possível rolar o modificador: ${error.message}`); return; }
      }
    }
    await saveEffects(actor, effects);
    if (action === "toggle" && effect.enabled) await executeConditional(actor, effect, "enable");
    app._od2QdvEffectTabActive = true;
    app.render(false);
  }, true);
}

function wrapActorGetter(type, getter, key) {
  const prototype = CONFIG.Actor.dataModels?.[type]?.prototype;
  if (!prototype || Object.prototype.hasOwnProperty.call(prototype, `__od2QdvEffect_${getter}`)) return;
  let owner = prototype;
  let descriptor;
  while (owner && !(descriptor = Object.getOwnPropertyDescriptor(owner, getter))) owner = Object.getPrototypeOf(owner);
  if (typeof descriptor?.get !== "function") return;
  const original = descriptor.get;
  Object.defineProperty(prototype, getter, { configurable: true, enumerable: descriptor.enumerable, get() { return modifier(this.parent, key, original.call(this)); } });
  Object.defineProperty(prototype, `__od2QdvEffect_${getter}`, { value: true, configurable: true });
}

function installGetterIntegrations() {
  for (const type of ["character", "monster", "retainer"]) {
    for (const [getter, key] of Object.entries({ ac_total: "ac", bac: "bac", bad: "bad", jpd_total: "jpd", jpc_total: "jpc", jps_total: "jps" })) wrapActorGetter(type, getter, key);
  }
  for (const type of ["character", "retainer"]) {
    for (const [getter, key] of Object.entries({
      ba: "ba", current_movement: "movement.normal", movement_run: "movement.run",
      movement_climb: "movement.climb", movement_swim: "movement.swim", movement_fly: "movement.fly", load_max: "load.max"
    })) wrapActorGetter(type, getter, key);
  }
  wrapActorGetter("monster", "mvc", "movement.run");
  wrapActorGetter("monster", "mve", "movement.climb");
}

async function advanceCombatEffects(combat, changed) {
  if (!enabled() || !isPrimaryActiveGM() || correctingCombats.has(combat)) return;
  const roundChanged = Object.prototype.hasOwnProperty.call(changed, "round");
  const previousRound = previousCombatRounds.get(combat) ?? (Number(combat.round) || 0);
  previousCombatRounds.delete(combat);
  const nextRound = Number(changed.round ?? combat.round) || 0;
  const roundStarted = roundChanged && nextRound > previousRound;
  const turnChanged = roundStarted || Object.prototype.hasOwnProperty.call(changed, "turn");
  if (!roundChanged && !turnChanged) return;
  const actors = [...new Set(combat.combatants.map((combatant) => combatant.actor).filter(Boolean))];
  if (roundChanged && nextRound < previousRound) {
    let cursor = previousRound;
    while (cursor > nextRound) {
      const latest = temporalLog().filter((entry) => entry.type === "advance" && !entry.reverted).at(-1);
      if (!latest || latest.source !== "combat" || latest.reference !== combat.uuid || latest.toRound !== cursor) {
        ui.notifications.error("Não é possível voltar esta rodada: existem alterações posteriores no histórico temporal.");
        correctingCombats.add(combat);
        try { await combat.update({ round: previousRound }); } finally { correctingCombats.delete(combat); }
        return;
      }
      const rollback = await rollbackTemporalTransaction(latest.id);
      if (!rollback.ok) {
        ui.notifications.error(rollback.reason);
        correctingCombats.add(combat);
        try { await combat.update({ round: previousRound }); } finally { correctingCombats.delete(combat); }
        return;
      }
      if (latest.phase === "round") cursor -= 1;
    }
    ui.notifications.info(`Rodada retornada para ${nextRound}; alterações temporais dos efeitos foram restauradas.`);
    return;
  }
  if (roundStarted) {
    for (let round = previousRound + 1; round <= nextRound; round += 1) {
      const elapsed = round > 1 ? 1 : 0;
      await runTemporalTransaction({ source: "combat", phase: "round", reference: combat.uuid, label: `Combat Tracker: rodada ${round}`, fromRound: round - 1, toRound: round }, async () => {
        for (const actor of actors) {
          const before = effectsFor(actor);
          const after = advanceDurations(before, { roundsElapsed: elapsed });
          if (JSON.stringify(before) !== JSON.stringify(after)) await saveEffects(actor, after);
        }
        for (const actor of actors) await executeActorConditionals(actor, "roundStart");
        if (round === nextRound && combat.combatant?.actor) await executeActorConditionals(combat.combatant.actor, "turnStart");
        if (elapsed && typeof game.time?.advance === "function") await game.time.advance(OD2_TIME.ROUND_SECONDS);
      });
    }
  }
  if (turnChanged && !roundStarted && combat.combatant?.actor) {
    await runTemporalTransaction({ source: "combat", phase: "turn", reference: combat.uuid, label: `Combat Tracker: vez de ${combat.combatant.actor.name}`, fromRound: nextRound, toRound: nextRound }, async () => {
      await executeActorConditionals(combat.combatant.actor, "turnStart");
    });
  }
}

async function expireWorldTimeEffects(force = false) {
  if (!enabled() || !isPrimaryActiveGM() || (temporalMutationDepth && !force)) return;
  for (const actor of game.actors ?? []) {
    const effects = effectsFor(actor);
    let changed = false;
    for (const effect of effects) {
      if (!effect.enabled || !["turns", "minutes", "hours"].includes(effect.duration.type)) continue;
      if (effect.duration.expiresAt > 0 && worldTime() >= effect.duration.expiresAt) { effect.enabled = false; changed = true; }
    }
    if (changed) await saveEffects(actor, effects);
  }
}

async function migrateLegacyTurnDurations() {
  if (!enabled() || !isPrimaryActiveGM()) return;
  for (const actor of game.actors ?? []) {
    const effects = effectsFor(actor);
    let changed = false;
    for (const effect of effects) {
      if (effect.enabled && effect.duration.type === "turns" && effect.duration.expiresAt <= 0) {
        effect.duration.expiresAt = worldTime() + Math.max(0, effect.duration.remaining) * OD2_TIME.TURN_SECONDS;
        changed = true;
      }
    }
    if (changed) await saveEffects(actor, effects);
  }
}

async function actorChanged(actor, changed) {
  if (!enabled() || executingConditionals.has(actor.id) || !changed.system) return;
  if (changed.system.hp && Object.prototype.hasOwnProperty.call(changed.system.hp, "value")) await executeActorConditionals(actor, "hpChange");
  const attributes = ["forca", "destreza", "constituicao", "inteligencia", "sabedoria", "carisma"];
  if (attributes.some((key) => Object.prototype.hasOwnProperty.call(changed.system, key))) await executeActorConditionals(actor, "attributeChange");
  if (Object.prototype.hasOwnProperty.call(changed.system, "level")) {
    const previous = previousLevels.get(actor);
    previousLevels.delete(actor);
    if (previous !== undefined && Number(changed.system.level) > previous) await triggerActorEffects(actor, "levelUp", { level: changed.system.level, previousLevel: previous });
  }
}

async function actorEffectChanged(document) {
  const actor = document?.parent;
  if (actor?.documentName === "Actor") await executeActorConditionals(actor, "conditionChange");
}

async function chatMessageCreated(message) {
  if (!enabled() || !String(message.content || "").includes('class="spell"')) return;
  const actor = game.actors.get(message.speaker?.actor);
  if (actor) await triggerActorEffects(actor, "spell", { message });
}

function enhanceSceneConfig(app, html) {
  if (!enabled()) return;
  const root = rootElement(html);
  const form = root?.querySelector?.("form") ?? root;
  if (!form || form.querySelector('[name="flags.old-dragon-2-qualidade-de-vida.environment"]')) return;
  const value = app.document?.getFlag?.(MODULE_ID, "environment") ?? "";
  const field = `<div class="form-group"><label>Ambiente da cena (QdV)</label><input type="text" name="flags.${MODULE_ID}.environment" value="${escapeHtml(value)}" placeholder="Ermos, subterrâneo, aberto, cidade..."><p class="hint">Usado pelas condições do Gerenciador de Efeitos.</p></div>`;
  (form.querySelector('.tab[data-tab="basic"]') ?? form).insertAdjacentHTML("beforeend", field);
}

Hooks.on("renderActorSheet", enhanceEffectTab);
Hooks.on("renderActorSheetV2", enhanceEffectTab);
Hooks.on("renderOD2CharacterSheet", enhanceEffectTab);
Hooks.on("renderOD2MonsterSheet", enhanceEffectTab);
Hooks.on("renderOD2RetainerSheet", enhanceEffectTab);
Hooks.on("updateCombat", advanceCombatEffects);
Hooks.on("preUpdateCombat", (combat, changed) => {
  if (Object.prototype.hasOwnProperty.call(changed, "round")) previousCombatRounds.set(combat, Number(combat.round) || 0);
});
Hooks.on("updateWorldTime", () => expireWorldTimeEffects(false));
Hooks.on("preUpdateActor", (actor, changed) => {
  if (changed.system && Object.prototype.hasOwnProperty.call(changed.system, "level")) previousLevels.set(actor, Number(actor.system.level) || 0);
});
Hooks.on("updateActor", actorChanged);
Hooks.on("createActiveEffect", actorEffectChanged);
Hooks.on("updateActiveEffect", actorEffectChanged);
Hooks.on("deleteActiveEffect", actorEffectChanged);
Hooks.on("createChatMessage", chatMessageCreated);
Hooks.on("od2QdvRestCompleted", completeActorRest);
Hooks.on("renderSceneConfig", enhanceSceneConfig);

Hooks.once("ready", () => {
  if (!enabled()) return;
  installGetterIntegrations();
  game.od2Qdv ??= {};
  game.od2Qdv.effects = {
    open: openManager, get: effectsFor, active: (actor) => activeEffects(effectsFor(actor), worldTime()), modifier, modifierDelta,
    execute: executeConditional, trigger: triggerActorEffects, rest: completeActorRest,
    transactTime: runTemporalTransaction, rollbackTime: rollbackTemporalTransaction, history: temporalLog, openHistory: openTemporalHistory
  };
  migrateLegacyTurnDurations();
});
