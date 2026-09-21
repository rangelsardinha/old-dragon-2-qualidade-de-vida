import {
  inventoryResourceKind,
  isPortableLampItem,
  lightResourceKind,
  portableLampName,
  quantityAfterConsumption,
  expiresWithSessionEvent
} from "./model.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const LIGHT_SOURCES_MODULE_ID = "light-sources";
const LIGHT_FLAG = "light";
const GROUND_LIGHT_FLAG = "groundLight";
const DROPPED_ITEM_FLAG = "droppedLightItem";
const PROMPT_DELAY_MS = 750;
const pendingPrompts = new Map();
let pendingTransfers = [];
let pendingPickups = [];

function integrationEnabled() {
  try {
    return game.system.id === "olddragon2e"
      && game.modules.get(LIGHT_SOURCES_MODULE_ID)?.active;
  } catch {
    return false;
  }
}

function enabled() {
  return integrationEnabled() && game.settings.get(MODULE_ID, "enableLightResourceConsumption");
}

function activeGm() {
  return game.user?.isGM && (!game.users?.activeGM || game.users.activeGM.id === game.user.id);
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

function quantity(item) {
  return item?.system?.quantity == null ? 1 : Math.max(0, Math.trunc(Number(item.system.quantity) || 0));
}

function resourceItem(actor, kind) {
  return [...(actor?.items ?? [])].find((item) => inventoryResourceKind(item) === kind && quantity(item) > 0) ?? null;
}

function lampItem(actor, lightName) {
  return [...(actor?.items ?? [])].find((item) => isPortableLampItem(item, lightName) && quantity(item) > 0) ?? null;
}

function itemDataForTransfer(item) {
  const data = item.toObject();
  delete data._id;
  delete data._stats;
  delete data.folder;
  delete data.sort;
  delete data.ownership;
  data.system = foundry.utils.deepClone(data.system ?? {});
  data.system.quantity = 1;
  return data;
}

async function removeOneItem(item) {
  const next = quantityAfterConsumption(item.system?.quantity);
  if (next.delete) await item.delete();
  else await item.update({ "system.quantity": next.quantity });
}

async function confirmConsumption(actor, item, kind, lightName) {
  const amount = quantity(item);
  const resource = kind === "torch" ? "uma tocha" : "um frasco de óleo";
  const title = kind === "torch" ? "Consumir tocha?" : "Consumir óleo?";
  const content = `<p><strong>${escapeHtml(actor.name)}</strong> acendeu <strong>${escapeHtml(lightName)}</strong>.</p><p>Deseja remover ${resource} do inventário? Quantidade disponível: <strong>${amount}</strong>.</p>`;
  const DialogV2 = Number(game.release?.generation ?? 13) >= 14 ? foundry.applications?.api?.DialogV2 : null;
  if (DialogV2) {
    return DialogV2.confirm({
      window: { title }, content,
      yes: { label: "Consumir", default: false, callback: () => true },
      no: { label: "Não consumir", default: true, callback: () => false }
    });
  }
  return Dialog.confirm({ title, content, yes: () => true, no: () => false, defaultYes: false });
}

async function consumeForLight(actor, lightName) {
  const kind = lightResourceKind(lightName);
  if (!kind) return;
  const item = resourceItem(actor, kind);
  if (!item) {
    const resource = kind === "torch" ? "tochas" : "frascos de óleo";
    ui.notifications.warn(`${actor.name} não possui ${resource} no inventário.`);
    return;
  }
  if (!(await confirmConsumption(actor, item, kind, lightName))) return;
  await removeOneItem(item);
  ui.notifications.info(`${actor.name}: ${kind === "torch" ? "1 tocha consumida" : "1 frasco de óleo consumido"}.`);
}

function cancelPending(predicate) {
  for (const [key, pending] of pendingPrompts) {
    if (!predicate(pending)) continue;
    clearTimeout(pending.timer);
    pendingPrompts.delete(key);
  }
}

function lightCreated(effect) {
  if (!enabled() || !activeGm()) return;
  const light = effect.getFlag?.(LIGHT_SOURCES_MODULE_ID, LIGHT_FLAG);
  if (!lightResourceKind(light?.itemName)) return;
  const actor = effect.parent;
  if (!actor) return;
  const key = effect.uuid;
  const timer = setTimeout(async () => {
    pendingPrompts.delete(key);
    try {
      await consumeForLight(actor, light.itemName);
    } catch (error) {
      console.error(`${MODULE_ID} | Falha ao contabilizar a fonte de luz`, error);
      ui.notifications.error(`Não foi possível contabilizar a fonte de luz: ${error.message}`);
    }
  }, PROMPT_DELAY_MS);
  pendingPrompts.set(key, { timer, actorId: actor.id, itemName: light.itemName });
}

async function groundLightCreated(light) {
  if (!integrationEnabled() || !activeGm()) return;
  const ground = light.getFlag?.(LIGHT_SOURCES_MODULE_ID, GROUND_LIGHT_FLAG);
  if (!portableLampName(ground?.itemName)) return;
  const actor = foundry.utils.fromUuidSync?.(ground.actorUuid) ?? null;
  const item = lampItem(actor, ground.itemName);
  if (!item) {
    ui.notifications.warn(`Não foi possível retirar ${ground.itemName} do inventário de ${actor?.name ?? "seu portador"}.`);
    return;
  }
  const data = itemDataForTransfer(item);
  try {
    await light.setFlag(MODULE_ID, DROPPED_ITEM_FLAG, data);
    await removeOneItem(item);
    ui.notifications.info(`${ground.itemName} foi deixada no chão e removida do inventário de ${actor.name}.`);
  } catch (error) {
    console.error(`${MODULE_ID} | Falha ao largar o item da fonte de luz`, error);
    ui.notifications.error(`Não foi possível transferir ${ground.itemName} para o chão.`);
  }
}

function actorFromSpeaker(speaker = {}) {
  const worldActor = game.actors?.get?.(speaker.actor);
  if (worldActor) return worldActor;
  const scene = game.scenes?.get?.(speaker.scene);
  const token = scene?.tokens?.get?.(speaker.token);
  if (token?.actor) return token.actor;
  for (const candidate of game.scenes ?? []) {
    for (const document of candidate.tokens ?? []) {
      if (document.actor?.id === speaker.actor) return document.actor;
    }
  }
  return null;
}

async function addTransferredItem(actor, data) {
  const sourceId = data?.flags?.core?.sourceId;
  const existing = [...(actor?.items ?? [])].find((item) =>
    (sourceId && item.getFlag?.("core", "sourceId") === sourceId)
    || (item.type === data.type && item.name === data.name)
  );
  if (existing) {
    await existing.update({ "system.quantity": quantity(existing) + 1 });
    return;
  }
  await actor.createEmbeddedDocuments("Item", [data]);
}

async function reconcileTransfers() {
  const cutoff = Date.now() - 10000;
  pendingTransfers = pendingTransfers.filter((entry) => entry.createdAt >= cutoff);
  pendingPickups = pendingPickups.filter((entry) => entry.createdAt >= cutoff);
  for (let pickupIndex = pendingPickups.length - 1; pickupIndex >= 0; pickupIndex -= 1) {
    const pickup = pendingPickups[pickupIndex];
    const transferIndex = pendingTransfers.findIndex((entry) => pickup.content.includes(entry.itemData.name));
    if (transferIndex < 0) continue;
    const [transfer] = pendingTransfers.splice(transferIndex, 1);
    pendingPickups.splice(pickupIndex, 1);
    try {
      await addTransferredItem(pickup.actor, transfer.itemData);
      ui.notifications.info(`${transfer.itemData.name} foi adicionada ao inventário de ${pickup.actor.name}.`);
    } catch (error) {
      console.error(`${MODULE_ID} | Falha ao recolher o item da fonte de luz`, error);
      ui.notifications.error(`Não foi possível adicionar ${transfer.itemData.name} ao inventário de ${pickup.actor.name}.`);
    }
  }
}

function groundLightDeleted(light) {
  if (!integrationEnabled() || !activeGm()) return;
  const itemData = light.getFlag?.(MODULE_ID, DROPPED_ITEM_FLAG);
  if (!portableLampName(itemData?.name)) return;
  pendingTransfers.push({ itemData, createdAt: Date.now() });
  reconcileTransfers().catch((error) => console.error(`${MODULE_ID} | Falha ao reconciliar luz recolhida`, error));
}

function chatCreated(message) {
  if (!integrationEnabled() || !activeGm()) return;
  const pickupTitle = game.i18n.localize("LIGHTSOURCES.Chat.PickedUpTitle");
  const content = String(message.content ?? "");
  if (!content.includes(pickupTitle)) return;
  const actorId = message.speaker?.actor;
  const actor = actorFromSpeaker(message.speaker);
  if (enabled()) cancelPending((pending) => (pending.actorId === actorId || pending.actorId === actor?.id) && content.includes(pending.itemName));
  if (!actor) return;
  pendingPickups.push({ actor, content, createdAt: Date.now() });
  reconcileTransfers().catch((error) => console.error(`${MODULE_ID} | Falha ao reconciliar luz recolhida`, error));
}

function actorsWithTokens() {
  const actors = new Map([...(game.actors ?? [])].map((actor) => [actor.uuid, actor]));
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor) actors.set(token.actor.uuid, token.actor);
    }
  }
  return [...actors.values()];
}

export async function expireSessionLights(event) {
  if (!enabled() || !activeGm()) return 0;
  const api = game.modules.get(LIGHT_SOURCES_MODULE_ID)?.api ?? game.lightSources;
  if (!api?.getActive || !api?.deactivate) return 0;
  let count = 0;
  for (const actor of actorsWithTokens()) {
    const active = api.getActive(actor);
    if (!expiresWithSessionEvent(active?.itemName, event)) continue;
    await api.deactivate(actor);
    count += 1;
  }
  for (const scene of game.scenes ?? []) {
    const matching = [...(scene.lights ?? [])]
      .filter((light) => expiresWithSessionEvent(light.getFlag?.(LIGHT_SOURCES_MODULE_ID, GROUND_LIGHT_FLAG)?.itemName, event));
    if (!matching.length) continue;
    if (event === "lamp") {
      await scene.updateEmbeddedDocuments("AmbientLight", matching.map((light) => ({ _id: light.id, hidden: true })));
    } else {
      await scene.deleteEmbeddedDocuments("AmbientLight", matching.map((light) => light.id));
    }
    count += matching.length;
  }
  return count;
}

export function installLightResourceTracking() {
  Hooks.on("createActiveEffect", lightCreated);
  Hooks.on("createAmbientLight", (light) => groundLightCreated(light).catch((error) => console.error(`${MODULE_ID} | Falha ao registrar luz largada`, error)));
  Hooks.on("deleteAmbientLight", groundLightDeleted);
  Hooks.on("createChatMessage", chatCreated);
}
