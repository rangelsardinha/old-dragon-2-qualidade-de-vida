import { darkSunEnabled } from "../../integrations/dark-sun.js";
import { emptyWaterskinStates, normalizeWaterskinStates } from "../equipment-containers/model.js";
import { deleteInventoryItem, inventoryActor, updateInventoryItem } from "../../utils/actor-inventory.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const WATERSKIN_FULL_FLAG = "waterskinFull";
const WATERSKIN_STATES_FLAG = "waterskinStates";

function rootOf(html) {
  return html instanceof HTMLElement ? html : html?.[0];
}

function dialogV2() {
  return Number(game.release?.generation ?? 13) >= 14 ? foundry.applications?.api?.DialogV2 : null;
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function normalizedName(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function isWaterskin(item) {
  return /^odre(?:\b|\s|[-–—:])/.test(normalizedName(item?.name));
}

function isRation(item) {
  return /(?:^|\b)rac(?:ao|oes)(?:\b|\s|[-–—:])/.test(normalizedName(item?.name));
}

function itemQuantity(item) {
  if (item?.system?.quantity == null) return 1;
  return Math.max(0, Math.trunc(Number(item.system.quantity) || 0));
}

function candidateActors() {
  const actors = new Map();
  for (const actor of game.actors ?? []) if (actor.type === "character") actors.set(actor.uuid, actor);
  for (const token of canvas?.scene?.tokens ?? []) {
    const actor = inventoryActor(token.actor);
    if (actor?.type === "character" && !actors.has(actor.uuid)) actors.set(actor.uuid, actor);
  }
  return [...actors.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function selectedByDefault(actor) {
  return Boolean(canvas?.tokens?.controlled?.some((token) => token.actor?.uuid === actor.uuid || token.document?.actorId === actor.id));
}

async function chooseActors() {
  const actors = candidateActors();
  if (!actors.length) {
    ui.notifications.warn("Não há atores do tipo personagem disponíveis para descansar.");
    return null;
  }
  const rows = actors.map((actor) => `<label class="od2qdv-rest-actor"><input type="checkbox" name="actor" value="${escapeAttribute(actor.uuid)}" ${selectedByDefault(actor) ? "checked" : ""}><img src="${escapeAttribute(actor.img)}" alt="" width="32" height="32"><span>${escapeHtml(actor.name)}</span></label>`).join("");
  const content = `<form class="od2qdv-rest-form"><p>Selecione os personagens que realizarão o descanso.</p><div class="od2qdv-rest-actors">${rows}</div></form>`;
  const V2 = dialogV2();
  if (V2) return V2.prompt({
    window: { title: "Realizar descanso" }, content,
    ok: { label: "Continuar", callback: (_event, button) => [...button.form.querySelectorAll('input[name="actor"]:checked')].map((input) => input.value) }
  });
  return new Promise((resolve) => new Dialog({
    title: "Realizar descanso", content,
    buttons: { ok: { label: "Continuar", callback: (html) => resolve([...rootOf(html).querySelectorAll('input[name="actor"]:checked')].map((input) => input.value)) }, cancel: { label: "Cancelar", callback: () => resolve(null) } },
    default: "ok", close: () => resolve(null)
  }).render(true));
}

async function resolveActors(uuids) {
  const actors = [];
  for (const uuid of uuids ?? []) {
    const actor = inventoryActor(await fromUuid(uuid).catch(() => null));
    if (actor?.type === "character" && !actors.some((entry) => entry.uuid === actor.uuid)) actors.push(actor);
  }
  return actors;
}

async function askSource(title, question) {
  const content = `<p>${escapeHtml(question)}</p>`;
  const V2 = dialogV2();
  if (V2) return V2.wait({
    window: { title }, content,
    buttons: [
      { action: "yes", icon: "fa-solid fa-check", label: "Sim", default: true, callback: () => true },
      { action: "no", icon: "fa-solid fa-times", label: "Não", callback: () => false }
    ],
    close: () => null
  });
  return new Promise((resolve) => new Dialog({
    title, content,
    buttons: { yes: { label: "Sim", callback: () => resolve(true) }, no: { label: "Não", callback: () => resolve(false) } },
    default: "yes", close: () => resolve(null)
  }).render(true));
}

function waterskinStates(item) {
  return normalizeWaterskinStates(itemQuantity(item), item.getFlag(MODULE_ID, WATERSKIN_STATES_FLAG), item.getFlag(MODULE_ID, WATERSKIN_FULL_FLAG));
}

function fullWaterskinCount(actor) {
  return inventoryActor(actor).items.filter(isWaterskin).reduce((total, item) => total + waterskinStates(item).filter(Boolean).length, 0);
}

function rations(actor) {
  return inventoryActor(actor).items.filter(isRation);
}

function availableCount(items) {
  return items.reduce((total, item) => total + itemQuantity(item), 0);
}

async function resourceChoices(actors, type, { darkSun = false } = {}) {
  const water = type === "water";
  const data = actors.map((actor) => ({ actor, available: water ? fullWaterskinCount(actor) : availableCount(rations(actor)) }));
  const note = water
    ? darkSun
      ? "Personagens consomem 4 litros de água por dia. Thri-kreen consome 1 litro de água. Meio-gigantes consomem 8 litros."
      : "Personagens consomem 2 litros de água por dia."
    : "Personagens consomem 1 ração por dia. Thri-kreen consome 1 ração a cada 2 dias. Meio-gigantes consomem 2 rações.";
  const unit = water ? "odres cheios" : "rações";
  const rows = data.map(({ actor, available }, index) => `<tr><td>${escapeHtml(actor.name)}</td><td>${available} ${unit}</td><td><input type="number" name="amount-${index}" min="0" max="${available}" step="1" value="0"></td></tr>`).join("");
  const content = `<form class="od2qdv-rest-form"><p class="od2qdv-rest-note">${escapeHtml(note)}</p><table><thead><tr><th>Personagem</th><th>Disponível</th><th>${water ? "Esvaziar" : "Remover"}</th></tr></thead><tbody>${rows}</tbody></table></form>`;
  const read = (form) => data.map((entry, index) => ({ actor: entry.actor, amount: Math.max(0, Math.min(entry.available, Math.trunc(Number(form.elements[`amount-${index}`]?.value) || 0))) }));
  const V2 = dialogV2();
  if (V2) return V2.prompt({
    window: { title: water ? "Consumo de água" : "Consumo de comida" }, content,
    ok: { label: water ? "Esvaziar odres" : "Consumir rações", callback: (_event, button) => read(button.form) }
  });
  return new Promise((resolve) => new Dialog({
    title: water ? "Consumo de água" : "Consumo de comida", content,
    buttons: { ok: { label: water ? "Esvaziar odres" : "Consumir rações", callback: (html) => resolve(read(rootOf(html).querySelector("form"))) }, cancel: { label: "Cancelar", callback: () => resolve(null) } },
    default: "ok", close: () => resolve(null)
  }).render(true));
}

async function updateActorItem(actor, item, changes) {
  return updateInventoryItem(actor, item, changes);
}

export async function emptyWaterskins(actor, requested) {
  const sourceActor = actor;
  actor = inventoryActor(actor);
  let remaining = Math.max(0, Math.trunc(Number(requested) || 0));
  let emptied = 0;
  for (const item of actor.items.filter(isWaterskin)) {
    if (!remaining) break;
    const previousStates = waterskinStates(item);
    const result = emptyWaterskinStates(previousStates, remaining);
    if (!result.emptied) continue;
    const updatedItem = await updateActorItem(sourceActor, item, {
      [`flags.${MODULE_ID}.${WATERSKIN_STATES_FLAG}`]: result.states,
      [`flags.${MODULE_ID}.${WATERSKIN_FULL_FLAG}`]: result.states.length > 0 && result.states.every(Boolean)
    });
    if (!updatedItem) continue;
    const persistedStates = waterskinStates(updatedItem);
    const persisted = Math.max(0, previousStates.filter(Boolean).length - persistedStates.filter(Boolean).length);
    emptied += persisted;
    remaining -= persisted;
  }
  return emptied;
}

export async function consumeRations(actor, requested) {
  const sourceActor = actor;
  actor = inventoryActor(actor);
  let remaining = Math.max(0, Math.trunc(Number(requested) || 0));
  let consumed = 0;
  for (const item of rations(actor)) {
    if (!remaining) break;
    const quantity = itemQuantity(item);
    const amount = Math.min(quantity, remaining);
    if (!amount) continue;
    const nextQuantity = Math.max(0, quantity - amount);
    let persisted = 0;
    if (nextQuantity === 0) {
      const deleted = await deleteInventoryItem(sourceActor, item);
      const stillExists = actor.items?.get?.(item.id) ?? actor.items?.find?.((entry) => entry.id === item.id);
      if (deleted || !stillExists) persisted = quantity;
    } else {
      const updatedItem = await updateActorItem(sourceActor, item, { "system.quantity": nextQuantity });
      if (updatedItem) persisted = Math.max(0, quantity - itemQuantity(updatedItem));
    }
    consumed += persisted;
    remaining -= persisted;
  }
  return consumed;
}

function usedDailyUses(item, spell = false) {
  const flags = spell ? item.getFlag?.("olddragon2e", "spell")?.["daily-uses"] : item.getFlag?.("olddragon2e", "daily-uses");
  const uses = { ...(flags ?? {}) };
  return Object.values(uses).some((used) => used === true) ? uses : {};
}

function resetDailyUses(uses) {
  return Object.fromEntries(Object.keys(uses).map((key) => [key, false]));
}

export async function recoverActor(actor) {
  actor = inventoryActor(actor);
  const spells = actor.items.map((item) => ({ item, uses: item.type === "spell" ? usedDailyUses(item, true) : {} }))
    .filter(({ uses }) => Object.keys(uses).length);
  const abilities = actor.items.map((item) => ({ item, uses: ["class_ability", "race_ability"].includes(item.type) ? usedDailyUses(item) : {} }))
    .filter(({ uses }) => Object.keys(uses).length);
  if (spells.length) await actor.updateEmbeddedDocuments("Item", spells.map(({ item, uses }) => ({ _id: item.id, "flags.olddragon2e.spell.daily-uses": resetDailyUses(uses) })));
  if (abilities.length) await actor.updateEmbeddedDocuments("Item", abilities.map(({ item, uses }) => ({ _id: item.id, "flags.olddragon2e.daily-uses": resetDailyUses(uses) })));
  await game.od2Qdv?.classRaceAbilities?.rest?.(actor);
  if (game.od2Qdv?.effects?.rest) await game.od2Qdv.effects.rest(actor);
  else Hooks.callAll("od2QdvRestCompleted", actor);
  return { spells: spells.length, abilities: abilities.length };
}

async function performRest() {
  if (!game.user?.isGM) return ui.notifications.warn("Apenas o Mestre pode realizar o descanso do grupo.");
  const selected = await chooseActors();
  if (!selected) return;
  const actors = await resolveActors(selected);
  if (!actors.length) return ui.notifications.warn("Selecione ao menos um personagem para realizar o descanso.");

  const recovered = new Map();
  for (const actor of actors) recovered.set(actor.uuid, await recoverActor(actor));

  const consumedWater = new Map();
  const darkSun = darkSunEnabled();
  const hasWater = await askSource("Fonte de água", "Existe uma fonte de água disponível?");
  if (hasWater === null) return;
  if (!hasWater) {
    const choices = await resourceChoices(actors, "water", { darkSun });
    if (choices) for (const { actor, amount } of choices) consumedWater.set(actor.uuid, await emptyWaterskins(actor, amount));
  }

  const consumedFood = new Map();
  const hasFood = await askSource("Fonte de comida ou caça", "Existe uma fonte de comida ou caça disponível?");
  if (hasFood === null) return;
  if (!hasFood && darkSun) {
    const choices = await resourceChoices(actors, "food");
    if (choices) for (const { actor, amount } of choices) consumedFood.set(actor.uuid, await consumeRations(actor, amount));
  }

  const rows = actors.map((actor) => {
    const recovery = recovered.get(actor.uuid) ?? { spells: 0, abilities: 0 };
    const details = [`${recovery.spells} magia(s) recuperada(s)`, `${recovery.abilities} habilidade(s) diária(s) recuperada(s)`];
    if (hasWater) details.push("nenhum odre esvaziado devido à fonte natural de água");
    else if (consumedWater.has(actor.uuid)) details.push(`${consumedWater.get(actor.uuid)} odre(s) esvaziado(s)`);
    if (hasFood) details.push("nenhuma ração descontada devido à fonte natural de comida ou caça");
    else if (consumedFood.has(actor.uuid)) details.push(`${consumedFood.get(actor.uuid)} ração(ões) descontada(s)`);
    return `<li><strong>${escapeHtml(actor.name)}</strong>: ${details.join("; ")}.</li>`;
  }).join("");
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ alias: "Descanso" }), content: `<h3>Descanso realizado</h3><ul>${rows}</ul>` });
  ui.notifications.info(`Descanso realizado por ${actors.length} personagem(ns).`);
}

Hooks.on("renderJournalDirectory", (_app, html) => {
  if (game.system.id !== "olddragon2e" || !game.user?.isGM) return;
  const root = rootOf(html);
  if (!root || root.querySelector(".od2qdv-perform-rest")) return;
  const target = root.querySelector(".directory-header .header-actions, .directory-header");
  if (!target) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "od2qdv-perform-rest";
  button.innerHTML = '<i class="fas fa-bed"></i> Realizar descanso';
  button.addEventListener("click", performRest);
  target.append(button);
});

Hooks.once("ready", () => {
  game.od2Qdv ??= {};
  game.od2Qdv.rest = { perform: performRest };
});
