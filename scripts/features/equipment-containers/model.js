export const COIN_KEYS = ["cp", "sp", "gp"];
const MODULE_ID = "old-dragon-2-qualidade-de-vida";
export const SACK_WEIGHT_FLAG = "sackOriginalWeight";

export const CONTAINER_RULES = Object.freeze([
  { key: "algibeira", match: /^algibeira(?:\b|\s|[-–—:])/, names: ["Algibeira"], description: "Pequeno saco de couro usado preso ao cinto da roupa. Comporta até 50 moedas.", weight_in_load: 0, weight_in_grams: 0, cost: "1 PC", coinCapacity: 50 },
  { key: "aljava", match: /^aljava(?:\b|\s|[-–—:])/, names: ["Aljava"], description: "De couro, rígida para até 40 flechas ou 80 virotes. Comporta até 150 moedas.", weight_in_load: 0, weight_in_grams: 500, cost: "1 PO", coinCapacity: 150, ammunitionCapacity: { arrow: 40, bolt: 80 } },
  { key: "small-barrel-box", match: /^(?:barril|caixa)(?:\/|\s+)(?:caixa\s+|barril\s+)?pequena(?:\b|\s|[-–—:])/, names: ["Barril/Caixa Pequena"], description: "De madeira, reforçado para transporte. Capacidade de 20 litros. Comporta até 200 moedas.", weight_in_load: 5, weight_in_grams: 0, cost: "2 PO", coinCapacity: 200, capacityLiters: 20 },
  { key: "large-barrel-box", match: /^(?:barril|caixa)(?:\/|\s+)(?:caixa\s+|barril\s+)?grande(?:\b|\s|[-–—:])/, names: ["Barril/Caixa Grande"], description: "De madeira, reforçado para transporte. Capacidade de 200 litros. Comporta até 2.000 moedas.", weight_in_load: 10, weight_in_grams: 0, cost: "5 PO", coinCapacity: 2000, capacityLiters: 200 },
  { key: "backpack", match: /^mochila(?:\b|\s|[-–—:])/, names: ["Mochila"], description: "De couro, com compartimentos para exploradores e reforço para peso. Adiciona 5 ao valor de carga do personagem. Comporta até 400 moedas.", weight_in_load: 0, weight_in_grams: 0, cost: "2 PO", coinCapacity: 400, loadBonus: 5, increases_load_by: 5 },
  { key: "waterskin", match: /^odre(?:\b|\s|[-–—:])/, names: ["Odre"], description: "Saco de couro com rolha para líquidos com capacidade para 1 litro. Não comporta moedas.", weight_in_load: 0, weight_in_grams: 500, cost: "5 PP", coinCapacity: 0, capacityLiters: 1 },
  { key: "map-case", match: /^porta mapas(?:\b|\s|[-–—:])/, names: ["Porta Mapas"], description: "Acomoda até 20 folhas de pergaminhos ou mapas. Comporta até 50 moedas.", weight_in_load: 0, weight_in_grams: 500, cost: "1 PO", coinCapacity: 50, sheetCapacity: 20 },
  { key: "sack-of-estopa", match: /^saco de estopa(?:\b|\s|[-–—:])/, names: ["Saco de Estopa"], description: "Para carregar até 15 kg. Quando carregado, reduz pela metade o peso dos objetos em seu interior. Comporta até 600 moedas.", weight_in_load: 0, weight_in_grams: 0, cost: "5 PC", coinCapacity: 600, maxWeightKg: 15, weightReduction: 0.5 }
]);

function normalizedName(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

export function containerRule(itemOrName) {
  const name = normalizedName(typeof itemOrName === "string" ? itemOrName : itemOrName?.name);
  return CONTAINER_RULES.find((rule) => rule.match.test(name)) ?? null;
}

export function isSackOfEstopa(item) {
  return /^saco de estopa(?:\b|\s|[-–—:])/.test(normalizedName(item?.name));
}

export function canContainItems(item) {
  return item?.type === "container" && !/^odre(?:\b|\s|[-–—:])/.test(normalizedName(item?.name));
}

export function containerCoinCapacity(item) {
  return containerRule(item)?.coinCapacity ?? Infinity;
}

export function containerLoadRule(item) {
  return containerRule(item);
}

export function itemWeight(item) {
  const calculated = Number(item?.system?.total_weight);
  if (Number.isFinite(calculated)) return Math.max(0, calculated);
  const quantity = Math.max(0, Number(item?.system?.quantity) || 0);
  const load = Math.max(0, Number(item?.system?.weight_in_load) || 0);
  const grams = Math.max(0, Number(item?.system?.weight_in_grams) || 0);
  return load > 0 ? load * quantity : (grams * quantity) / 1000;
}

export function hasSackAdjustedWeight(item) {
  return Boolean(item?.flags?.[MODULE_ID]?.[SACK_WEIGHT_FLAG]);
}

export function containerContentsWeight(items = [], containerId) {
  return items
    .filter((item) => item?.flags?.[MODULE_ID]?.parentContainerId === containerId)
    .reduce((total, item) => total + itemWeight(item), 0);
}

export function isAmmunition(item) {
  return item?.type === "weapon" && item?.system?.type === "ammunition";
}

export function canStoreItem(item, allowEquippedAmmunition = false) {
  if (!Boolean(item?.system?.is_equipped)) return true;
  return allowEquippedAmmunition && isAmmunition(item);
}

export function canReceiveContainer(actor) {
  return actor?.type === "character" || actor?.type === "retainer" || actor?.type === "monster";
}

export function normalizeWaterskinStates(quantity, storedStates, legacyFull = false) {
  const count = Math.max(0, Math.trunc(Number(quantity) || 0));
  const states = Array.isArray(storedStates) ? storedStates : [];
  return Array.from({ length: count }, (_value, index) => typeof states[index] === "boolean" ? states[index] : legacyFull === true);
}

export function emptyWaterskinStates(states, requested) {
  const next = [...states];
  let remaining = Math.max(0, Math.trunc(Number(requested) || 0));
  let emptied = 0;
  for (let index = 0; index < next.length && remaining > 0; index += 1) {
    if (!next[index]) continue;
    next[index] = false;
    emptied += 1;
    remaining -= 1;
  }
  return { states: next, emptied };
}

export function actorOwnerNames(actor, users = [], ownerLevel = 3) {
  return users
    .filter((user) => !user.isGM)
    .filter((user) => user.character?.id === actor?.id || Number(actor?.ownership?.[user.id] ?? 0) >= ownerLevel)
    .map((user) => user.name)
    .sort((a, b) => a.localeCompare(b));
}

export function normalizeCoins(value = {}) {
  return Object.fromEntries(COIN_KEYS.map((key) => [key, Math.max(0, Math.trunc(Number(value[key]) || 0))]));
}

export function carriedLoad(items = [], coins = {}, { includeCoins = true } = {}) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const itemLoad = items.reduce((total, item) => {
    let factor = 1;
    let parentId = item?.flags?.[MODULE_ID]?.parentContainerId;
    const seen = new Set();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      if (isSackOfEstopa(parent) && !hasSackAdjustedWeight(item)) factor *= 0.5;
      parentId = parent.flags?.[MODULE_ID]?.parentContainerId;
    }
    return total + itemWeight(item) * factor;
  }, 0);
  const money = includeCoins ? normalizeCoins(coins) : normalizeCoins();
  const coinLoad = COIN_KEYS.reduce((total, key) => total + money[key], 0) / 100;
  return Math.floor(itemLoad + coinLoad);
}

export function addCoins(left, right) {
  left = normalizeCoins(left);
  right = normalizeCoins(right);
  return Object.fromEntries(COIN_KEYS.map((key) => [key, left[key] + right[key]]));
}

export function subtractCoins(left, right) {
  left = normalizeCoins(left);
  right = normalizeCoins(right);
  return Object.fromEntries(COIN_KEYS.map((key) => [key, Math.max(0, left[key] - right[key])]));
}

export function sumAllocatedCoins(items, getCoins) {
  return items.reduce((total, item) => addCoins(total, getCoins(item)), normalizeCoins());
}

export function descendantIds(items, rootId, getParentId) {
  const children = new Map();
  for (const item of items) {
    const parentId = getParentId(item);
    if (!parentId) continue;
    const list = children.get(parentId) ?? [];
    list.push(item.id);
    children.set(parentId, list);
  }
  const result = [];
  const pending = [...(children.get(rootId) ?? [])];
  const seen = new Set([rootId]);
  while (pending.length) {
    const id = pending.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    pending.push(...(children.get(id) ?? []));
  }
  return result;
}

export function wouldCreateCycle(items, itemId, proposedParentId, getParentId) {
  if (!proposedParentId) return false;
  if (itemId === proposedParentId) return true;
  return descendantIds(items, itemId, getParentId).includes(proposedParentId);
}
