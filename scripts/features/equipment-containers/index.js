import {
  COIN_KEYS, SACK_WEIGHT_FLAG, actorOwnerNames, addCoins, canContainItems, canReceiveContainer, canStoreItem, carriedLoad, containerCoinCapacity, containerContentsWeight, containerLoadRule, descendantIds, isAmmunition, isSackOfEstopa, isSaddlebag, normalizeCoins, normalizeWaterskinStates, subtractCoins, sumAllocatedCoins, wouldCreateCycle
} from "./model.js";
import { updateInventoryItem } from "../../utils/actor-inventory.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const PARENT_FLAG = "parentContainerId";
const COINS_FLAG = "containerCoins";
const EQUIPPED_AMMO_FLAG = "allowEquippedAmmunition";
const WATERSKIN_FULL_FLAG = "waterskinFull";
const WATERSKIN_STATES_FLAG = "waterskinStates";
const CONTAINER_RULE_FLAG = "containerLoadRuleVersion";
const CONTAINER_RULE_VERSION = 2;
const COIN_LABELS = { gp: "PO", sp: "PP", cp: "PC" };
const INVENTORY_TYPES = new Set(["weapon", "armor", "shield", "misc", "container", "vehicle"]);
const LOAD_TYPES = new Set(["weapon", "armor", "shield", "misc", "container"]);
const boundActorSheets = new WeakSet();
const boundItemSheets = new WeakSet();
const boundWaterskinSheets = new WeakSet();
const actorSheetScrollPositions = new WeakMap();
const patchedLoadPrototypes = new WeakSet();
const waterskinScrollPositions = new Map();

function enabled() {
  if (game.system.id !== "olddragon2e") return false;
  try { return game.settings.get(MODULE_ID, "enableEquipmentContainers"); }
  catch { return true; }
}

function loadRulesEnabled() {
  try { return game.settings.get(MODULE_ID, "enableContainerLoadRules") === true; }
  catch { return false; }
}

export function countCoinsInLoad() {
  try { return game.settings.get(MODULE_ID, "countCoinsInLoad") !== false; }
  catch { return true; }
}

function containerRuleChanges(item) {
  const rule = containerLoadRule(item);
  if (!rule) return null;
  const changes = {
    "system.description": rule.description,
    [`flags.${MODULE_ID}.${CONTAINER_RULE_FLAG}`]: CONTAINER_RULE_VERSION
  };
  if (rule.cost !== undefined) changes["system.cost"] = rule.cost;
  if (rule.weight_in_load !== undefined) changes["system.weight_in_load"] = rule.weight_in_load;
  if (rule.weight_in_grams !== undefined) changes["system.weight_in_grams"] = rule.weight_in_grams;
  if (rule.increases_load_by !== undefined) changes["system.increases_load_by"] = rule.increases_load_by;
  return changes;
}

async function applyContainerRule(item) {
  if (!loadRulesEnabled() || !canContainItems(item) || !containerLoadRule(item)) return false;
  const changes = containerRuleChanges(item);
  if (!changes) return false;
  const currentRuleVersion = item.getFlag?.(MODULE_ID, CONTAINER_RULE_FLAG) ?? item.flags?.[MODULE_ID]?.[CONTAINER_RULE_FLAG];
  const needsUpdate = currentRuleVersion !== CONTAINER_RULE_VERSION
    || Object.entries(changes).some(([path, value]) => path.startsWith("system.") && item.system?.[path.slice(7)] !== value);
  if (!needsUpdate || !item.update) return false;
  await item.update(changes, { render: false });
  return true;
}

export async function migrateContainerItems() {
  if (!loadRulesEnabled()) return { scanned: 0, updated: 0 };
  const items = [
    ...[...(game.actors ?? [])].flatMap((actor) => [...(actor.items ?? [])]),
    ...[...(game.items ?? [])]
  ];
  let updated = 0;
  for (const item of items) if (await applyContainerRule(item)) updated += 1;
  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) {
      const parent = parentId(item) ? actor.items.get(parentId(item)) : null;
      if (parent && isSackOfEstopa(parent) && !storedSackWeight(item)) {
        await setSackWeight(item, true);
        updated += 1;
      }
    }
  }
  if (updated) ui.notifications.info(`Regras de carga aplicadas a ${updated} recipiente(s).`);
  console.log(`${MODULE_ID} | Regras de carga: ${updated} item(ns) atualizado(s) de ${items.length} verificado(s).`);
  return { scanned: items.length, updated };
}

function rootElement(html) {
  if (html instanceof HTMLElement) return html;
  return html?.[0] ?? html;
}

function normalizedName(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function isWaterskin(item) {
  return /^odre(?:\b|\s|[-–—:])/.test(normalizedName(item?.name));
}

function itemSheetScroller(root) {
  return root.closest?.(".window-content") ?? root.querySelector?.(".window-content") ?? root;
}

function actorSheetScroller(root) {
  return root.closest?.(".window-content") ?? root.querySelector?.(".window-content") ?? root;
}

function descriptorInPrototypeChain(prototype, key) {
  for (let current = prototype; current; current = Object.getPrototypeOf(current)) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) return descriptor;
  }
  return null;
}

function correctedLoad(system, nativeGet) {
  const nativeLoad = nativeGet.call(system);
  const actor = system.parent;
  if (!loadRulesEnabled() || !actor || (actor.type !== "character" && actor.type !== "retainer")) return nativeLoad;
  return carriedLoad([...actor.items].filter((item) => LOAD_TYPES.has(item.type) || isSaddlebag(item)), actorCoins(actor), { includeCoins: countCoinsInLoad() });
}

function patchLoadInstance(system) {
  if (!system || Object.prototype.hasOwnProperty.call(system, "load_current")) return;
  const descriptor = descriptorInPrototypeChain(Object.getPrototypeOf(system), "load_current");
  if (typeof descriptor?.get !== "function") return;
  try {
    Object.defineProperty(system, "load_current", {
      configurable: true,
      enumerable: descriptor.enumerable ?? true,
      get() { return correctedLoad(this, descriptor.get); }
    });
  } catch (error) {
    console.warn(`${MODULE_ID} | Não foi possível substituir a carga da ficha`, error);
  }
}

function installContainerLoadCalculation() {
  const modelPrototypes = new Set([
    ...[...(game.actors ?? [])]
      .filter((actor) => actor.type === "character" || actor.type === "retainer")
      .map((actor) => Object.getPrototypeOf(actor.system)),
    ...["character", "retainer"]
      .map((type) => globalThis.CONFIG?.Actor?.dataModels?.[type]?.prototype)
      .filter(Boolean)
  ]);
  for (const prototype of modelPrototypes) {
    if (patchedLoadPrototypes.has(prototype)) continue;
    const descriptor = descriptorInPrototypeChain(prototype, "load_current");
    if (typeof descriptor?.get !== "function") continue;
    const nativeGet = descriptor.get;
    Object.defineProperty(prototype, "load_current", {
      configurable: true,
      enumerable: descriptor.enumerable ?? true,
      get() {
        return correctedLoad(this, nativeGet);
      }
    });
    patchedLoadPrototypes.add(prototype);
  }
  for (const actor of game.actors ?? []) {
    if (actor.type === "character" || actor.type === "retainer") patchLoadInstance(actor.system);
  }
}

function enhanceWaterskinSheet(app, root) {
  const item = app.item ?? app.document;
  if (!isWaterskin(item) || !item?.isOwner) return;
  const scrollKey = item.uuid ?? item.id;
  const savedScroll = waterskinScrollPositions.get(scrollKey);
  if (savedScroll) requestAnimationFrame(() => {
    const scroller = itemSheetScroller(root);
    scroller.scrollTop = savedScroll.top;
    scroller.scrollLeft = savedScroll.left;
    waterskinScrollPositions.delete(scrollKey);
  });
  if (root.querySelector("[data-od2qdv-waterskin-states]")) return;
  const form = root.matches?.("form") ? root : root.querySelector("form");
  if (!form) return;
  const quantity = item.system?.quantity == null ? 1 : Math.max(0, Math.trunc(Number(item.system.quantity) || 0));
  const states = normalizeWaterskinStates(quantity, item.getFlag(MODULE_ID, WATERSKIN_STATES_FLAG), item.getFlag(MODULE_ID, WATERSKIN_FULL_FLAG));
  const field = document.createElement("div");
  field.className = "form-group od2qdv-waterskin-state";
  field.dataset.od2qdvWaterskinStates = "true";
  field.innerHTML = `<label>Estado dos odres</label><div class="od2qdv-waterskin-units">${states.length ? states.map((full, index) => `<label class="checkbox"><input type="checkbox" data-od2qdv-waterskin-index="${index}" ${full ? "checked" : ""}><span>Odre ${index + 1}: ${full ? "cheio" : "vazio"}</span></label>`).join("") : "<em>Nenhum odre nesta pilha.</em>"}</div><p class="hint">Cada checkbox representa um odre da quantidade deste item.</p>`;
  const footer = form.querySelector("footer, .form-footer");
  if (footer) footer.before(field);
  else form.append(field);
  if (boundWaterskinSheets.has(root)) return;
  boundWaterskinSheets.add(root);
  root.addEventListener("change", async (event) => {
    if (!event.target.matches?.("[data-od2qdv-waterskin-index]")) return;
    event.stopPropagation();
    event.target.nextElementSibling.textContent = `Odre ${Number(event.target.dataset.od2qdvWaterskinIndex) + 1}: ${event.target.checked ? "cheio" : "vazio"}`;
    const checkboxes = [...root.querySelectorAll("[data-od2qdv-waterskin-index]")].sort((left, right) => Number(left.dataset.od2qdvWaterskinIndex) - Number(right.dataset.od2qdvWaterskinIndex));
    const next = checkboxes.map((checkbox) => checkbox.checked);
    const scroller = itemSheetScroller(root);
    waterskinScrollPositions.set(scrollKey, { top: scroller.scrollTop, left: scroller.scrollLeft });
    await updateInventoryItem(item.parent, item, {
      [`flags.${MODULE_ID}.${WATERSKIN_STATES_FLAG}`]: next,
      [`flags.${MODULE_ID}.${WATERSKIN_FULL_FLAG}`]: next.length > 0 && next.every(Boolean)
    }, { render: false });
    requestAnimationFrame(() => {
      const currentScroller = itemSheetScroller(root);
      const saved = waterskinScrollPositions.get(scrollKey);
      if (!saved) return;
      currentScroller.scrollTop = saved.top;
      currentScroller.scrollLeft = saved.left;
      waterskinScrollPositions.delete(scrollKey);
    });
  });
}

function parentId(item) {
  return item?.getFlag(MODULE_ID, PARENT_FLAG) ?? null;
}

function containerCoins(item) {
  return normalizeCoins(item?.getFlag(MODULE_ID, COINS_FLAG));
}

function allowsEquippedAmmunition(container) {
  const configured = container?.getFlag?.(MODULE_ID, EQUIPPED_AMMO_FLAG);
  if (typeof configured === "boolean") return configured;
  return String(container?.name ?? "").trim().toLocaleLowerCase("pt-BR") === "aljava";
}

export function actorCoins(actor) {
  return actor?.type === "monster"
    ? normalizeCoins(actor.getFlag(MODULE_ID, "monsterCoins"))
    : normalizeCoins(actor?.system?.economy);
}

export async function updateActorCoins(actor, coins) {
  const normalized = normalizeCoins(coins);
  if (actor.type === "monster") return actor.setFlag(MODULE_ID, "monsterCoins", normalized);
  return actor.update(Object.fromEntries(COIN_KEYS.map((key) => [`system.economy.${key}`, normalized[key]])));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function itemFromElement(actor, element) {
  return actor.items.get(element?.closest?.(".item[data-item-id]")?.dataset.itemId);
}

function subtree(actor, containerId) {
  const ids = [containerId, ...descendantIds(actor.items, containerId, parentId)];
  return ids.map((id) => actor.items.get(id)).filter(Boolean);
}

function subtreeCoins(actor, containerId) {
  return sumAllocatedCoins(subtree(actor, containerId).filter(canContainItems), containerCoins);
}

function coinLabel(coins) {
  const normalized = normalizeCoins(coins);
  return `${normalized.gp} PO · ${normalized.sp} PP · ${normalized.cp} PC`;
}

function containedQuantity(item) {
  return Math.max(0, Number(item?.system?.quantity) || 0);
}

function containedWeight(item) {
  const quantity = containedQuantity(item);
  const load = Math.max(0, Number(item?.system?.weight_in_load) || 0);
  const grams = Math.max(0, Number(item?.system?.weight_in_grams) || 0);
  return load > 0 ? load * quantity : (grams * quantity) / 1000;
}

function containerContentsWeightFor(container) {
  return containerContentsWeight([...container.actor.items], container.id);
}

function canAddToContainer(item, container) {
  if (!canApplyContainerLoadRule(item, container)) return false;
  if (!isSackOfEstopa(container)) return true;
  if (canContainItems(item)) {
    ui.notifications.warn("Sacos de estopa não podem armazenar outros recipientes.");
    return false;
  }
  const nextWeight = containerContentsWeightFor(container) + containedWeight(item);
  if (nextWeight > 15) {
    ui.notifications.warn("O Saco de estopa comporta no máximo 15 kg.");
    return false;
  }
  return true;
}

function ammunitionKind(item) {
  const name = normalizedName(item?.name);
  if (name.includes("flecha")) return "arrow";
  if (name.includes("virote") || name.includes("virotes")) return "bolt";
  return null;
}

function directContents(container) {
  return [...(container?.actor?.items ?? [])].filter((item) => item.flags?.[MODULE_ID]?.[PARENT_FLAG] === container.id);
}

function canApplyContainerLoadRule(item, container) {
  if (!loadRulesEnabled()) return true;
  const rule = containerLoadRule(container);
  if (!rule) return true;
  const kind = ammunitionKind(item);
  const maxAmmunition = rule.ammunitionCapacity?.[kind];
  if (maxAmmunition && isAmmunition(item)) {
    const current = directContents(container)
      .filter((candidate) => isAmmunition(candidate) && ammunitionKind(candidate) === kind)
      .reduce((total, candidate) => total + containedQuantity(candidate), 0);
    if (current + containedQuantity(item) > maxAmmunition) {
      ui.notifications.warn(`${container.name} comporta no máximo ${maxAmmunition} ${kind === "arrow" ? "flechas" : "virotes"}.`);
      return false;
    }
  }
  return true;
}

function containedValue(item) {
  const quantity = containedQuantity(item);
  const raw = item?.system?.cost ?? item?.system?.value ?? item?.system?.price ?? 0;
  if (typeof raw === "number") return raw * quantity;
  const text = String(raw ?? "").trim();
  const match = text.match(/(-?\d+(?:[.,]\d+)?)\s*(PO|PP|PC|GP|SP|CP)?/i);
  if (!match) return text || "0";
  const amount = Number(match[1].replace(",", ".")) * quantity;
  const currency = match[2] ? match[2].toUpperCase().replace("GP", "PO").replace("SP", "PP").replace("CP", "PC") : "";
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}${currency ? ` ${currency}` : ""}`;
}

async function confirmDialog({ title, content }) {
  const DialogV2 = Number(game.release?.generation ?? 13) >= 14
    ? foundry.applications?.api?.DialogV2
    : null;
  if (DialogV2) {
    return DialogV2.confirm({
      window: { title }, content,
      yes: { default: false, callback: () => true },
      no: { default: true, callback: () => false }
    });
  }
  const DialogClass = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  if (!DialogClass) return globalThis.confirm?.(content.replace(/<[^>]+>/g, " ")) ?? false;
  return DialogClass.confirm({ title, content, yes: () => true, no: () => false, defaultYes: false });
}

async function setParent(item, newParentId) {
  if (loadRulesEnabled() && item?.actor) {
    const previousParent = item.actor.items.get(parentId(item));
    const nextParent = newParentId ? item.actor.items.get(newParentId) : null;
    if (previousParent && isSackOfEstopa(previousParent) && previousParent !== nextParent) await setSackWeight(item, false);
    if (nextParent && isSackOfEstopa(nextParent) && previousParent !== nextParent) await setSackWeight(item, true);
  }
  if (!newParentId) return item.unsetFlag(MODULE_ID, PARENT_FLAG);
  return item.setFlag(MODULE_ID, PARENT_FLAG, newParentId);
}

function storedSackWeight(item) {
  return item?.getFlag?.(MODULE_ID, SACK_WEIGHT_FLAG) ?? item?.flags?.[MODULE_ID]?.[SACK_WEIGHT_FLAG] ?? null;
}

async function setSackWeight(item, insideSack) {
  if (!item?.update) return;
  const stored = storedSackWeight(item);
  if (insideSack) {
    if (stored) return;
    const load = Math.max(0, Number(item.system?.weight_in_load) || 0);
    const grams = Math.max(0, Number(item.system?.weight_in_grams) || 0);
    const original = { weight_in_load: load, weight_in_grams: grams };
    const totalGrams = load > 0 ? load * 1000 : grams;
    await item.update({
      "system.weight_in_load": 0,
      "system.weight_in_grams": Math.round(totalGrams / 2),
      [`flags.${MODULE_ID}.${SACK_WEIGHT_FLAG}`]: original
    }, { render: false });
    return;
  }
  if (!stored) return;
  await item.update({
    "system.weight_in_load": stored.weight_in_load,
    "system.weight_in_grams": stored.weight_in_grams
  }, { render: false });
  await item.unsetFlag(MODULE_ID, SACK_WEIGHT_FLAG);
}

async function nestExistingItem(item, container) {
  if (!canContainItems(container)) {
    ui.notifications.warn(isSackOfEstopa(container) ? "Sacos de estopa não podem armazenar outros recipientes." : "Odres não podem armazenar itens.");
    return true;
  }
  const actor = container.actor;
  if (!item?.actor || item.actor.id !== actor.id) return false;
  if (!INVENTORY_TYPES.has(item.type)) {
    ui.notifications.warn("Somente equipamentos podem ser colocados em recipientes.");
    return true;
  }
  if (wouldCreateCycle(actor.items, item.id, container.id, parentId)) {
    ui.notifications.warn("Um recipiente não pode ser colocado dentro de si mesmo ou de seus descendentes.");
    return true;
  }
  if (!canAddToContainer(item, container)) return true;
  await setParent(item, container.id);
  return true;
}

function cloneSource(item, newParentId, targetContainer = null) {
  const data = item.toObject();
  const storedWeight = data.flags?.[MODULE_ID]?.[SACK_WEIGHT_FLAG];
  const originalWeight = storedWeight ?? {
    weight_in_load: Number(item.system?.weight_in_load) || 0,
    weight_in_grams: Number(item.system?.weight_in_grams) || 0
  };
  if (storedWeight) {
    data.system ??= {};
    data.system.weight_in_load = storedWeight.weight_in_load;
    data.system.weight_in_grams = storedWeight.weight_in_grams;
    delete data.flags[MODULE_ID][SACK_WEIGHT_FLAG];
  }
  const rule = loadRulesEnabled() ? containerLoadRule(item) : null;
  if (rule) {
    data.system ??= {};
    Object.assign(data.system, {
      description: rule.description,
      cost: rule.cost,
      weight_in_load: rule.weight_in_load,
      weight_in_grams: rule.weight_in_grams,
      increases_load_by: rule.increases_load_by ?? 0
    });
    data.flags ??= {};
    data.flags[MODULE_ID] ??= {};
    data.flags[MODULE_ID][CONTAINER_RULE_FLAG] = CONTAINER_RULE_VERSION;
  }
  delete data._id;
  data.flags ??= {};
  data.flags[MODULE_ID] ??= {};
  if (newParentId) data.flags[MODULE_ID][PARENT_FLAG] = newParentId;
  else delete data.flags[MODULE_ID][PARENT_FLAG];
  if (loadRulesEnabled() && targetContainer && isSackOfEstopa(targetContainer)) {
    const totalGrams = Number(data.system?.weight_in_load) > 0
      ? Number(data.system.weight_in_load) * 1000
      : Math.max(0, Number(data.system?.weight_in_grams) || 0);
    data.system.weight_in_load = 0;
    data.system.weight_in_grams = Math.round(totalGrams / 2);
    data.flags[MODULE_ID][SACK_WEIGHT_FLAG] = {
      weight_in_load: originalWeight.weight_in_load,
      weight_in_grams: originalWeight.weight_in_grams
    };
  }
  return data;
}

export async function transferEmbeddedTree(rootItem, targetActor, targetParentId = null) {
  const sourceActor = rootItem.actor;
  if (!sourceActor?.isOwner || !targetActor?.isOwner) {
    ui.notifications.warn("Você precisa ser proprietário dos dois atores para transferir o item.");
    return;
  }
  if (sourceActor.id === targetActor.id) {
    if (targetParentId) await nestExistingItem(rootItem, targetActor.items.get(targetParentId));
    else await setParent(rootItem, null);
    return;
  }

  if (targetParentId && !canContainItems(targetActor.items.get(targetParentId))) {
    ui.notifications.warn("Este recipiente não pode armazenar itens.");
    return;
  }
  if (targetParentId && !canAddToContainer(rootItem, targetActor.items.get(targetParentId))) return;

  const sourceItems = subtree(sourceActor, rootItem.id);
  const idMap = new Map();
  for (const source of sourceItems) {
    const oldParentId = source.id === rootItem.id ? null : parentId(source);
    const newParentId = source.id === rootItem.id ? targetParentId : idMap.get(oldParentId);
    const targetContainer = source.id === rootItem.id && targetParentId ? targetActor.items.get(targetParentId) : null;
    const [created] = await targetActor.createEmbeddedDocuments("Item", [cloneSource(source, newParentId, targetContainer)]);
    idMap.set(source.id, created.id);
  }

  const coins = subtreeCoins(sourceActor, rootItem.id);
  const sourceEconomy = actorCoins(sourceActor);
  const targetEconomy = actorCoins(targetActor);
  await updateActorCoins(targetActor, addCoins(targetEconomy, coins));
  await updateActorCoins(sourceActor, subtractCoins(sourceEconomy, coins));
  await sourceActor.deleteEmbeddedDocuments("Item", sourceItems.map((item) => item.id));
  if (targetActor.type === "monster") {
    const sheet = targetActor.sheet;
    if (sheet) {
      sheet._od2qdvMonsterEquipmentActive = true;
      sheet.render(false);
    }
  }
  ui.notifications.info(`${rootItem.name} e seu conteúdo foram transferidos para ${targetActor.name}.`);
}

async function createInsideContainer(sourceItem, container) {
  if (!canContainItems(container)) {
    ui.notifications.warn(isSackOfEstopa(container) ? "Sacos de estopa não podem armazenar outros recipientes." : "Odres não podem armazenar itens.");
    return;
  }
  if (!INVENTORY_TYPES.has(sourceItem.type)) {
    ui.notifications.warn("Somente equipamentos podem ser colocados em recipientes.");
    return;
  }
  if (!canAddToContainer(sourceItem, container)) return;
  const [created] = await container.actor.createEmbeddedDocuments("Item", [cloneSource(sourceItem, container.id, container)]);
  return created;
}

async function handleDrop(event, targetActor, targetContainer = null) {
  let data;
  try {
    data = JSON.parse(event.dataTransfer?.getData("text/plain") || event.originalEvent?.dataTransfer?.getData("text/plain"));
  } catch {
    return false;
  }
  if (data?.type !== "Item") return false;
  const sourceItem = await Item.implementation.fromDropData(data);
  if (!sourceItem) return false;

  if (targetContainer) {
    if (!canContainItems(targetContainer)) {
      ui.notifications.warn(isSackOfEstopa(targetContainer) ? "Sacos de estopa não podem armazenar outros recipientes." : "Odres não podem armazenar itens.");
      return true;
    }
    if (!canStoreItem(sourceItem, allowsEquippedAmmunition(targetContainer))) {
      ui.notifications.warn(`${sourceItem.name} está equipado. Apenas munições podem ser guardadas equipadas em recipientes configurados para isso.`);
      return true;
    }
    if (!canAddToContainer(sourceItem, targetContainer)) return true;
    if (sourceItem.actor?.id === targetActor.id) await nestExistingItem(sourceItem, targetContainer);
    else if (sourceItem.actor) await transferEmbeddedTree(sourceItem, targetActor, targetContainer.id);
    else await createInsideContainer(sourceItem, targetContainer);
    return true;
  }
  if (canContainItems(sourceItem) && sourceItem.actor && sourceItem.actor.id !== targetActor.id) {
    await transferEmbeddedTree(sourceItem, targetActor);
    return true;
  }
  return false;
}

async function emptyContainer(container) {
  const actor = container.actor;
  const contents = descendantIds(actor.items, container.id, parentId).map((id) => actor.items.get(id)).filter(Boolean);
  await Promise.all(contents.map((item) => setParent(item, null)));
  await container.setFlag(MODULE_ID, COINS_FLAG, normalizeCoins());
  ui.notifications.info(`${container.name} foi esvaziado.`);
}

export async function deleteContainer(container) {
  const actor = container.actor;
  const items = subtree(actor, container.id);
  const descendants = items.slice(1);
  const coins = subtreeCoins(actor, container.id);
  const hasCoins = COIN_KEYS.some((key) => coins[key] > 0);
  if (descendants.length || hasCoins) {
    const confirmed = await confirmDialog({
      title: "Excluir recipiente com conteúdo",
      content: `<p><strong>${escapeHtml(container.name)}</strong> contém ${descendants.length} item(ns)${hasCoins ? ` e ${coinLabel(coins)}` : ""}.</p><p>O recipiente e todo o conteúdo serão excluídos. Deseja continuar?</p>`
    });
    if (!confirmed) return;
  }
  if (hasCoins) {
    await updateActorCoins(actor, subtractCoins(actorCoins(actor), coins));
  }
  await actor.deleteEmbeddedDocuments("Item", items.map((item) => item.id));
}

async function chooseTransferTarget(container) {
  const monstersEnabled = (() => {
    try { return game.settings.get(MODULE_ID, "enableMonsterEquipment"); }
    catch { return false; }
  })();
  const candidates = game.actors
    .filter((actor) => actor.id !== container.actor.id && canReceiveContainer(actor) && actor.isOwner)
    .filter((actor) => actor.type !== "monster" || monstersEnabled)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!candidates.length) {
    ui.notifications.warn("Nenhum outro personagem editável está disponível para receber o recipiente.");
    return;
  }
  const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  const content = `<div class="form-group"><label>Ator de destino</label><select name="targetActor">${candidates.map((actor) => {
      const owners = actorOwnerNames(actor, game.users, ownerLevel);
      const ownerLabel = owners.length ? owners.join(", ") : "Mestre";
      const kind = actor.type === "monster" ? " [Monstro]" : actor.type === "retainer" ? " [Ajudante]" : "";
      return `<option value="${actor.id}">${escapeHtml(actor.name)}${kind} (${escapeHtml(ownerLabel)})</option>`;
    }).join("")}</select></div>`;
  const label = canContainItems(container) ? "Transferir com todo o conteúdo" : "Transferir item";
  const DialogV2 = Number(game.release?.generation ?? 13) >= 14 ? foundry.applications?.api?.DialogV2 : null;
  const targetId = DialogV2
    ? await DialogV2.prompt({
      window: { title: `Transferir ${container.name}` }, content,
      ok: { label, callback: (_event, button) => button.form.elements.targetActor.value }
    })
    : await (foundry.appv1?.api?.Dialog ?? globalThis.Dialog).prompt({
      title: `Transferir ${container.name}`, content, label,
      callback: (html) => html.find?.('[name="targetActor"]').val() ?? html.querySelector?.('[name="targetActor"]')?.value,
      rejectClose: false
    });
  const target = game.actors.get(targetId);
  if (target) await transferEmbeddedTree(container, target);
}

function renderTree(actor, rootContainer, depth = 0) {
  const children = actor.items.filter((item) => parentId(item) === rootContainer.id);
  if (!children.length) return `<div class="od2qdv-container-empty">Vazio</div>`;
  const header = depth === 0 ? `<div class="od2qdv-container-contents-header"><span></span><span>Item</span><span>Qtd</span><span>Peso T.</span><span>Valor T.</span><span></span></div>` : "";
  return `${header}<ol class="od2qdv-container-contents">${children.map((item) => {
    const nested = canContainItems(item) ? renderTree(actor, item, depth + 1) : "";
    const ammoToggle = allowsEquippedAmmunition(rootContainer) && isAmmunition(item)
      ? `<button type="button" data-od2qdv-action="toggle-ammunition" data-item-id="${item.id}" title="${item.system?.is_equipped ? "Desequipar" : "Equipar"} munição"><i class="fas ${item.system?.is_equipped ? "fa-toggle-on" : "fa-toggle-off"}"></i></button>`
      : "";
    return `<li class="od2qdv-contained-item" data-contained-item-id="${item.id}">
      <img src="${escapeHtml(item.img)}" alt="" width="24" height="24">
      <button type="button" data-od2qdv-action="open-item" data-item-id="${item.id}">${escapeHtml(item.name)}</button>
      <span class="od2qdv-contained-quantity">${escapeHtml(containedQuantity(item))}</span>
      <span class="od2qdv-contained-weight">${escapeHtml(containedWeight(item))}</span>
      <span class="od2qdv-contained-value">${escapeHtml(canContainItems(item) ? coinLabel(containerCoins(item)) : containedValue(item))}</span>
      <span class="od2qdv-contained-controls">${ammoToggle}<button type="button" data-od2qdv-action="remove-item" data-item-id="${item.id}" title="Retirar do recipiente"><i class="fas fa-eject"></i></button><button type="button" data-od2qdv-action="delete-item" data-item-id="${item.id}" title="Excluir"><i class="fas fa-trash"></i></button></span>
      ${nested}
  </li>`;
  }).join("")}</ol>`;
}

export function enhanceActorSheet(app, html) {
  if (!enabled() || !app.actor?.isOwner) return;
  const root = rootElement(html);
  if (!root) return;
  const savedScroll = actorSheetScrollPositions.get(app);
  if (savedScroll) requestAnimationFrame(() => {
    const scroller = actorSheetScroller(root);
    scroller.scrollTop = savedScroll.top;
    scroller.scrollLeft = savedScroll.left;
    actorSheetScrollPositions.delete(app);
  });
  const actor = app.actor;

  for (const row of root.querySelectorAll(".item[data-item-id]")) {
    const item = actor.items.get(row.dataset.itemId);
    if (!item || !parentId(item)) continue;
    const equipmentArea = row.closest('.character-tab-equipment, .retainer-tab-equipment, [data-tab="equipment"], .od2qdv-monster-equipment');
    if (equipmentArea) row.classList.add("od2qdv-nested-original");
  }
  for (const row of root.querySelectorAll(".item[data-item-id]")) {
    const item = actor.items.get(row.dataset.itemId);
    if (!item || !INVENTORY_TYPES.has(item.type) || parentId(item)) continue;
    const controls = row.querySelector(".item-controls");
    if (!controls || controls.querySelector('[data-od2qdv-action="transfer-item"]')) continue;
    controls.insertAdjacentHTML("beforeend", '<a data-od2qdv-action="transfer-item" title="Transferir para outro ator"><i class="fas fa-people-arrows"></i></a>');
  }
  for (const row of root.querySelectorAll(".item[data-item-id]")) {
    const container = actor.items.get(row.dataset.itemId);
    if (!canContainItems(container) || parentId(container)) continue;
    if (row.querySelector(":scope > .od2qdv-container-summary")) continue;
    row.classList.add("od2qdv-container-row");
    row.insertAdjacentHTML("beforeend", `<div class="od2qdv-container-summary"><span><i class="fas fa-box-open"></i> ${subtree(actor, container.id).length - 1} item(ns) · ${coinLabel(containerCoins(container))}</span><span><button type="button" data-od2qdv-action="transfer" title="Transferir recipiente e conteúdo"><i class="fas fa-people-arrows"></i> Transferir</button><button type="button" data-od2qdv-action="empty" title="Esvaziar recipiente"><i class="fas fa-box-open"></i> Esvaziar</button></span></div>${renderTree(actor, container)}`);
  }

  if (boundActorSheets.has(root)) return;
  boundActorSheets.add(root);
  root.addEventListener("drop", async (event) => {
    const row = event.target.closest(".item[data-item-id]");
    const target = row ? actor.items.get(row.dataset.itemId) : null;
    let dropData;
    try { dropData = JSON.parse(event.dataTransfer?.getData("text/plain")); } catch { return; }
    if (dropData?.type !== "Item") return;
    const isRejectedWaterskinTarget = canContainItems(target) && isWaterskin(target);
    const isContainerTarget = canContainItems(target);
    const dragged = globalThis.fromUuidSync?.(dropData.uuid);
    const isExternalContainer = canContainItems(dragged) && Boolean(dragged.actor) && dragged.actor.id !== actor.id;
    if (!isContainerTarget && !isExternalContainer && !isRejectedWaterskinTarget) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    if (isRejectedWaterskinTarget) {
      ui.notifications.warn("Odres não podem armazenar itens.");
      return;
    }
    await handleDrop(event, actor, isContainerTarget ? target : null);
    // A criação/atualização do Item já dispara a renderização da ficha pelo Foundry.
    // Evite uma segunda renderização manual, que causa um recarregamento visível do ator.
  }, true);
  root.addEventListener("click", async (event) => {
    const clickedRow = event.target.closest?.(".item[data-item-id]");
    if (clickedRow) {
      const scroller = actorSheetScroller(root);
      actorSheetScrollPositions.set(app, { top: scroller.scrollTop, left: scroller.scrollLeft });
    }
    const action = event.target.closest("[data-od2qdv-action]");
    const deleteButton = event.target.closest(".item-delete");
    const row = event.target.closest(".item[data-item-id]");
    const item = row ? actor.items.get(row.dataset.itemId) : null;
    if (deleteButton && canContainItems(item)) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      await deleteContainer(item); app.render(false); return;
    }
    if (!action) return;
    event.preventDefault(); event.stopPropagation();
    const actionItem = actor.items.get(action.dataset.itemId);
    if (action.dataset.od2qdvAction === "empty" && canContainItems(item)) await emptyContainer(item);
    if (action.dataset.od2qdvAction === "transfer" && canContainItems(item)) await chooseTransferTarget(item);
    if (action.dataset.od2qdvAction === "transfer-item" && item) {
      if (!canStoreItem(item)) ui.notifications.warn(`${item.name} está equipado. Desequipe o item antes de transferi-lo.`);
      else await chooseTransferTarget(item);
    }
    if (action.dataset.od2qdvAction === "open-item") actionItem?.sheet.render(true);
    if (action.dataset.od2qdvAction === "toggle-ammunition" && actionItem && isAmmunition(actionItem)) {
      const containing = actor.items.get(parentId(actionItem));
      if (containing && allowsEquippedAmmunition(containing)) await actionItem.update({ "system.is_equipped": !Boolean(actionItem.system?.is_equipped) });
    }
    if (action.dataset.od2qdvAction === "remove-item" && actionItem) await setParent(actionItem, null);
    if (action.dataset.od2qdvAction === "delete-item" && canContainItems(actionItem)) await deleteContainer(actionItem);
    else if (action.dataset.od2qdvAction === "delete-item" && actionItem) await actor.deleteEmbeddedDocuments("Item", [actionItem.id]);
  }, true);
}

function itemSheetPanel(item) {
  const coins = containerCoins(item);
  const rule = loadRulesEnabled() ? containerLoadRule(item) : null;
  const capacityHint = rule?.ammunitionCapacity
    ? ` Comporta até ${rule.ammunitionCapacity.arrow} flechas ou ${rule.ammunitionCapacity.bolt} virotes.`
    : rule?.capacityLiters ? ` Capacidade: ${rule.capacityLiters} litro(s).` : "";
  return `<section class="od2qdv-container-sheet" data-container-id="${item.id}">
    <h2><i class="fas fa-box-open"></i> Conteúdo</h2>
    <p class="hint">Arraste equipamentos para esta área.${isSackOfEstopa(item) ? " Este saco comporta até 15 kg e não aceita recipientes." : " Recipientes podem ser aninhados."}${capacityHint}</p>
    <label class="od2qdv-equipped-ammo-option"><input type="checkbox" data-equipped-ammo ${allowsEquippedAmmunition(item) ? "checked" : ""}> Permitir guardar munição equipada</label>
    <div class="od2qdv-coins">${["gp", "sp", "cp"].map((key) => `<label>${COIN_LABELS[key]}<input type="number" min="0" step="1" data-coin="${key}" value="${coins[key]}"></label>`).join("")}<button type="button" data-od2qdv-action="save-coins"><i class="fas fa-coins"></i> Guardar moedas</button></div>
    ${renderTree(item.actor, item)}
    <button type="button" data-od2qdv-action="transfer"><i class="fas fa-people-arrows"></i> Transferir</button>
    <button type="button" data-od2qdv-action="empty"><i class="fas fa-box-open"></i> Esvaziar recipiente</button>
  </section>`;
}

async function saveCoins(container, panel) {
  const actor = container.actor;
  const requested = normalizeCoins(Object.fromEntries(COIN_KEYS.map((key) => [key, panel.querySelector(`[data-coin="${key}"]`)?.value])));
  const others = actor.items.filter((item) => canContainItems(item) && item.id !== container.id);
  const allocatedElsewhere = sumAllocatedCoins(others, containerCoins);
  const economy = actorCoins(actor);
  for (const key of COIN_KEYS) {
    if (requested[key] <= 0) continue;
    if (requested[key] + allocatedElsewhere[key] > economy[key]) {
      ui.notifications.warn(`Não há moedas ${COIN_LABELS[key]} livres suficientes.`);
      return;
    }
  }
  const coinCapacity = loadRulesEnabled() ? containerCoinCapacity(container) : Infinity;
  if (requested.cp + requested.sp + requested.gp > coinCapacity) {
    ui.notifications.warn(`${container.name} comporta no máximo ${coinCapacity} moedas.`);
    return;
  }
  await container.setFlag(MODULE_ID, COINS_FLAG, requested);
  ui.notifications.info(`Moedas guardadas em ${container.name}.`);
}

function enhanceItemSheet(app, html) {
  if (game.system.id !== "olddragon2e") return;
  const root = rootElement(html);
  if (!root) return;
  enhanceWaterskinSheet(app, root);
  if (!enabled()) return;
  if (!canContainItems(app.item) || !app.item.actor || !app.item.isOwner) return;
  if (!root || root.querySelector(".od2qdv-container-sheet")) return;
  const form = root.matches?.("form") ? root : root.querySelector("form");
  if (!form) return;
  form.insertAdjacentHTML("beforeend", itemSheetPanel(app.item));
  if (boundItemSheets.has(root)) return;
  boundItemSheets.add(root);
  root.addEventListener("drop", async (event) => {
    if (!event.target.closest(".od2qdv-container-sheet")) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    await handleDrop(event, app.item.actor, app.item);
  }, true);
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-od2qdv-action]");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const actor = app.item.actor;
    const selected = actor.items.get(button.dataset.itemId);
    if (button.dataset.od2qdvAction === "save-coins") await saveCoins(app.item, root.querySelector(".od2qdv-container-sheet"));
    if (button.dataset.od2qdvAction === "transfer") await chooseTransferTarget(app.item);
    if (button.dataset.od2qdvAction === "empty") await emptyContainer(app.item);
    if (button.dataset.od2qdvAction === "open-item") selected?.sheet.render(true);
    if (button.dataset.od2qdvAction === "toggle-ammunition" && selected && isAmmunition(selected) && allowsEquippedAmmunition(app.item)) await selected.update({ "system.is_equipped": !Boolean(selected.system?.is_equipped) });
    if (button.dataset.od2qdvAction === "remove-item" && selected) await setParent(selected, null);
    if (button.dataset.od2qdvAction === "delete-item" && canContainItems(selected)) await deleteContainer(selected);
    else if (button.dataset.od2qdvAction === "delete-item" && selected) await actor.deleteEmbeddedDocuments("Item", [selected.id]);
  }, true);
  root.addEventListener("change", async (event) => {
    if (event.target.matches?.(".od2qdv-container-sheet [data-equipped-ammo]")) {
      event.stopPropagation();
      await app.item.setFlag(MODULE_ID, EQUIPPED_AMMO_FLAG, event.target.checked);
      app.render(false);
      return;
    }
    if (!event.target.matches?.(".od2qdv-container-sheet [data-coin]")) return;
    event.stopPropagation();
    await saveCoins(app.item, root.querySelector(".od2qdv-container-sheet"));
    app.render(false);
  }, true);
}

Hooks.on("renderActorSheet", enhanceActorSheet);
Hooks.on("renderItemSheet", enhanceItemSheet);
Hooks.on("renderOD2CharacterSheet", enhanceActorSheet);
Hooks.on("renderOD2RetainerSheet", enhanceActorSheet);
Hooks.on("renderOD2ItemSheet", enhanceItemSheet);
Hooks.once("ready", () => {
  if (enabled()) {
    console.log(`${MODULE_ID} | Equipamentos em recipientes ativo`);
    installContainerLoadCalculation();
    migrateContainerItems().catch((error) => console.error(`${MODULE_ID} | Falha ao atualizar recipientes`, error));
  }
});

Hooks.on("createItem", (item) => {
  applyContainerRule(item).catch((error) => console.error(`${MODULE_ID} | Falha ao atualizar recipiente criado`, error));
});
