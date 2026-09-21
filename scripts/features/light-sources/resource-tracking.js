import {
  inventoryResourceKind,
  lightResourceKind,
  quantityAfterConsumption,
  expiresWithSessionEvent
} from "./model.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const LIGHT_SOURCES_MODULE_ID = "light-sources";
const LIGHT_FLAG = "light";
const PROMPT_DELAY_MS = 750;
const pendingPrompts = new Map();

function enabled() {
  try {
    return game.system.id === "olddragon2e"
      && game.settings.get(MODULE_ID, "enableLightResourceConsumption")
      && game.modules.get(LIGHT_SOURCES_MODULE_ID)?.active;
  } catch {
    return false;
  }
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
  const next = quantityAfterConsumption(item.system?.quantity);
  if (next.delete) await item.delete();
  else await item.update({ "system.quantity": next.quantity });
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

function chatCreated(message) {
  if (!enabled() || !activeGm()) return;
  const pickupTitle = game.i18n.localize("LIGHTSOURCES.Chat.PickedUpTitle");
  const content = String(message.content ?? "");
  if (!content.includes(pickupTitle)) return;
  const actorId = message.speaker?.actor;
  cancelPending((pending) => pending.actorId === actorId && content.includes(pending.itemName));
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
    const ids = [...(scene.lights ?? [])]
      .filter((light) => expiresWithSessionEvent(light.getFlag?.(LIGHT_SOURCES_MODULE_ID, "groundLight")?.itemName, event))
      .map((light) => light.id);
    if (!ids.length) continue;
    await scene.deleteEmbeddedDocuments("AmbientLight", ids);
    count += ids.length;
  }
  return count;
}

export function installLightResourceTracking() {
  Hooks.on("createActiveEffect", lightCreated);
  Hooks.on("createChatMessage", chatCreated);
}
