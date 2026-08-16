export const COIN_KEYS = ["cp", "sp", "gp"];

export function canStoreItem(item) {
  return !Boolean(item?.system?.is_equipped);
}

export function canReceiveContainer(actor) {
  return actor?.type === "character" || actor?.type === "retainer" || actor?.type === "monster";
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

export function carriedLoad(items = [], coins = {}) {
  const itemLoad = items.reduce((total, item) => {
    const calculated = Number(item?.system?.total_weight);
    if (Number.isFinite(calculated)) return total + Math.max(0, calculated);
    const quantity = Math.max(0, Number(item?.system?.quantity) || 0);
    const load = Math.max(0, Number(item?.system?.weight_in_load) || 0);
    const grams = Math.max(0, Number(item?.system?.weight_in_grams) || 0);
    return total + (load > 0 ? load * quantity : (grams * quantity) / 1000);
  }, 0);
  const money = normalizeCoins(coins);
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
