function itemsOf(actor) {
  return [...(actor?.items ?? [])];
}

function itemFlag(item, namespace, key) {
  return item?.getFlag?.(namespace, key) ?? item?.flags?.[namespace]?.[key];
}

function normalized(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

/** Resolve o ator persistente do diretório mesmo quando a ação veio de um token sintético. */
export function inventoryActor(actor) {
  if (!actor) return null;
  const actorId = actor.token?.actorId ?? actor.parent?.actorId ?? actor.id;
  return globalThis.game?.actors?.get?.(actorId) ?? actor;
}

/** Localiza no ator-base o mesmo item selecionado na ficha de um token. */
export function inventoryItem(actor, item) {
  if (!item) return null;
  const owner = inventoryActor(actor ?? item.parent);
  if (!owner) return item;
  const byId = owner.items?.get?.(item.id) ?? itemsOf(owner).find((candidate) => candidate.id === item.id);
  if (byId) return byId;

  const sourceId = itemFlag(item, "core", "sourceId");
  if (sourceId) {
    const bySource = itemsOf(owner).find((candidate) => itemFlag(candidate, "core", "sourceId") === sourceId);
    if (bySource) return bySource;
  }

  const odoId = normalized(item?.system?.odo_id);
  if (odoId) {
    const byOdoId = itemsOf(owner).find((candidate) => candidate.type === item.type && normalized(candidate.system?.odo_id) === odoId);
    if (byOdoId) return byOdoId;
  }

  return itemsOf(owner).find((candidate) =>
    candidate.type === item.type
    && normalized(candidate.name) === normalized(item.name)
    && normalized(candidate.system?.type) === normalized(item.system?.type)
  ) ?? null;
}

async function updateEmbedded(actor, item, changes, options = {}) {
  if (!actor || !item) return null;
  if (actor.updateEmbeddedDocuments) {
    const updated = await actor.updateEmbeddedDocuments("Item", [{ _id: item.id, ...changes }], options);
    return updated?.[0] ?? actor.items?.get?.(item.id) ?? item;
  }
  if (item.update) return item.update(changes, options);
  return null;
}

/** Persiste primeiro no ator-base e, se necessário, espelha a alteração no token sintético. */
export async function updateInventoryItem(actor, item, changes, options = {}) {
  const owner = inventoryActor(actor ?? item?.parent);
  const storedItem = inventoryItem(owner, item);
  if (!owner || !storedItem) return null;
  const updated = await updateEmbedded(owner, storedItem, changes, options);

  if (actor && actor !== owner) {
    const tokenItem = actor.items?.get?.(item.id) ?? itemsOf(actor).find((candidate) => candidate.id === item.id);
    if (tokenItem && tokenItem !== storedItem) {
      try { await updateEmbedded(actor, tokenItem, changes, options); }
      catch (error) { console.warn("old-dragon-2-qualidade-de-vida | Item persistido no ator, mas não foi possível sincronizar o token", error); }
    }
  }
  return updated;
}

async function deleteEmbedded(actor, item) {
  if (!actor || !item) return [];
  if (actor.deleteEmbeddedDocuments) return actor.deleteEmbeddedDocuments("Item", [item.id]);
  if (item.delete) return [await item.delete()];
  return [];
}

/** Remove primeiro do ator-base e depois limpa uma eventual cópia no token sintético. */
export async function deleteInventoryItem(actor, item) {
  const owner = inventoryActor(actor ?? item?.parent);
  const storedItem = inventoryItem(owner, item);
  if (!owner || !storedItem) return false;
  await deleteEmbedded(owner, storedItem);

  if (actor && actor !== owner) {
    const tokenItem = actor.items?.get?.(item.id) ?? itemsOf(actor).find((candidate) => candidate.id === item.id);
    if (tokenItem && tokenItem !== storedItem) {
      try { await deleteEmbedded(actor, tokenItem); }
      catch (error) { console.warn("old-dragon-2-qualidade-de-vida | Item removido do ator, mas não foi possível sincronizar o token", error); }
    }
  }
  return true;
}
