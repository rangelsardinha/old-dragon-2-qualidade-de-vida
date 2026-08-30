import {
  COIN_KEYS, actorOwnerNames, addCoins, canReceiveContainer, canStoreItem, descendantIds, isAmmunition, normalizeCoins, subtractCoins, sumAllocatedCoins, wouldCreateCycle
} from "./model.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const PARENT_FLAG = "parentContainerId";
const COINS_FLAG = "containerCoins";
const EQUIPPED_AMMO_FLAG = "allowEquippedAmmunition";
const COIN_LABELS = { gp: "PO", sp: "PP", cp: "PC" };
const INVENTORY_TYPES = new Set(["weapon", "armor", "shield", "misc", "container", "vehicle"]);
const boundActorSheets = new WeakSet();
const boundItemSheets = new WeakSet();

function enabled() {
  if (game.system.id !== "olddragon2e") return false;
  try { return game.settings.get(MODULE_ID, "enableEquipmentContainers"); }
  catch { return true; }
}

function rootElement(html) {
  if (html instanceof HTMLElement) return html;
  return html?.[0] ?? html;
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
  return sumAllocatedCoins(subtree(actor, containerId).filter((item) => item.type === "container"), containerCoins);
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
  if (!newParentId) return item.unsetFlag(MODULE_ID, PARENT_FLAG);
  return item.setFlag(MODULE_ID, PARENT_FLAG, newParentId);
}

async function nestExistingItem(item, container) {
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
  await setParent(item, container.id);
  return true;
}

function cloneSource(item, newParentId) {
  const data = item.toObject();
  delete data._id;
  data.flags ??= {};
  data.flags[MODULE_ID] ??= {};
  if (newParentId) data.flags[MODULE_ID][PARENT_FLAG] = newParentId;
  else delete data.flags[MODULE_ID][PARENT_FLAG];
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

  const sourceItems = subtree(sourceActor, rootItem.id);
  const idMap = new Map();
  for (const source of sourceItems) {
    const oldParentId = source.id === rootItem.id ? null : parentId(source);
    const newParentId = source.id === rootItem.id ? targetParentId : idMap.get(oldParentId);
    const [created] = await targetActor.createEmbeddedDocuments("Item", [cloneSource(source, newParentId)]);
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
  if (!INVENTORY_TYPES.has(sourceItem.type)) {
    ui.notifications.warn("Somente equipamentos podem ser colocados em recipientes.");
    return;
  }
  const [created] = await container.actor.createEmbeddedDocuments("Item", [cloneSource(sourceItem, container.id)]);
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
    if (!canStoreItem(sourceItem, allowsEquippedAmmunition(targetContainer))) {
      ui.notifications.warn(`${sourceItem.name} está equipado. Apenas munições podem ser guardadas equipadas em recipientes configurados para isso.`);
      return true;
    }
    if (sourceItem.actor?.id === targetActor.id) await nestExistingItem(sourceItem, targetContainer);
    else if (sourceItem.actor) await transferEmbeddedTree(sourceItem, targetActor, targetContainer.id);
    else await createInsideContainer(sourceItem, targetContainer);
    return true;
  }
  if (sourceItem.type === "container" && sourceItem.actor && sourceItem.actor.id !== targetActor.id) {
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
  const label = container.type === "container" ? "Transferir com todo o conteúdo" : "Transferir item";
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
    const nested = item.type === "container" ? renderTree(actor, item, depth + 1) : "";
    const ammoToggle = allowsEquippedAmmunition(rootContainer) && isAmmunition(item)
      ? `<button type="button" data-od2qdv-action="toggle-ammunition" data-item-id="${item.id}" title="${item.system?.is_equipped ? "Desequipar" : "Equipar"} munição"><i class="fas ${item.system?.is_equipped ? "fa-toggle-on" : "fa-toggle-off"}"></i></button>`
      : "";
    return `<li class="od2qdv-contained-item" data-contained-item-id="${item.id}">
      <img src="${escapeHtml(item.img)}" alt="" width="24" height="24">
      <button type="button" data-od2qdv-action="open-item" data-item-id="${item.id}">${escapeHtml(item.name)}</button>
      <span class="od2qdv-contained-quantity">${escapeHtml(containedQuantity(item))}</span>
      <span class="od2qdv-contained-weight">${escapeHtml(containedWeight(item))}</span>
      <span class="od2qdv-contained-value">${escapeHtml(item.type === "container" ? coinLabel(containerCoins(item)) : containedValue(item))}</span>
      <span class="od2qdv-contained-controls">${ammoToggle}<button type="button" data-od2qdv-action="remove-item" data-item-id="${item.id}" title="Retirar do recipiente"><i class="fas fa-eject"></i></button><button type="button" data-od2qdv-action="delete-item" data-item-id="${item.id}" title="Excluir"><i class="fas fa-trash"></i></button></span>
      ${nested}
  </li>`;
  }).join("")}</ol>`;
}

export function enhanceActorSheet(app, html) {
  if (!enabled() || !app.actor?.isOwner) return;
  const root = rootElement(html);
  if (!root) return;
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
    if (container?.type !== "container" || parentId(container)) continue;
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
    const isContainerTarget = target?.type === "container";
    const dragged = globalThis.fromUuidSync?.(dropData.uuid);
    const isExternalContainer = dragged?.type === "container" && Boolean(dragged.actor) && dragged.actor.id !== actor.id;
    if (!isContainerTarget && !isExternalContainer) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const handled = await handleDrop(event, actor, target?.type === "container" ? target : null);
    if (handled) {
      app.render(false);
    }
  }, true);
  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-od2qdv-action]");
    const deleteButton = event.target.closest(".item-delete");
    const row = event.target.closest(".item[data-item-id]");
    const item = row ? actor.items.get(row.dataset.itemId) : null;
    if (deleteButton && item?.type === "container") {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      await deleteContainer(item); app.render(false); return;
    }
    if (!action) return;
    event.preventDefault(); event.stopPropagation();
    const actionItem = actor.items.get(action.dataset.itemId);
    if (action.dataset.od2qdvAction === "empty" && item?.type === "container") await emptyContainer(item);
    if (action.dataset.od2qdvAction === "transfer" && item?.type === "container") await chooseTransferTarget(item);
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
    if (action.dataset.od2qdvAction === "delete-item" && actionItem?.type === "container") await deleteContainer(actionItem);
    else if (action.dataset.od2qdvAction === "delete-item" && actionItem) await actor.deleteEmbeddedDocuments("Item", [actionItem.id]);
    app.render(false);
  }, true);
}

function itemSheetPanel(item) {
  const coins = containerCoins(item);
  return `<section class="od2qdv-container-sheet" data-container-id="${item.id}">
    <h2><i class="fas fa-box-open"></i> Conteúdo</h2>
    <p class="hint">Arraste equipamentos para esta área. Recipientes podem ser aninhados.</p>
    <label class="od2qdv-equipped-ammo-option"><input type="checkbox" data-equipped-ammo ${allowsEquippedAmmunition(item) ? "checked" : ""}> Permitir guardar munição equipada</label>
    <div class="od2qdv-coins">${COIN_KEYS.map((key) => `<label>${COIN_LABELS[key]}<input type="number" min="0" step="1" data-coin="${key}" value="${coins[key]}"></label>`).join("")}<button type="button" data-od2qdv-action="save-coins"><i class="fas fa-coins"></i> Guardar moedas</button></div>
    ${renderTree(item.actor, item)}
    <button type="button" data-od2qdv-action="transfer"><i class="fas fa-people-arrows"></i> Transferir</button>
    <button type="button" data-od2qdv-action="empty"><i class="fas fa-box-open"></i> Esvaziar recipiente</button>
  </section>`;
}

async function saveCoins(container, panel) {
  const actor = container.actor;
  const requested = normalizeCoins(Object.fromEntries(COIN_KEYS.map((key) => [key, panel.querySelector(`[data-coin="${key}"]`)?.value])));
  const others = actor.items.filter((item) => item.type === "container" && item.id !== container.id);
  const allocatedElsewhere = sumAllocatedCoins(others, containerCoins);
  const economy = actorCoins(actor);
  for (const key of COIN_KEYS) {
    if (requested[key] + allocatedElsewhere[key] > economy[key]) {
      ui.notifications.warn(`Não há moedas ${COIN_LABELS[key]} livres suficientes.`);
      return;
    }
  }
  await container.setFlag(MODULE_ID, COINS_FLAG, requested);
  ui.notifications.info(`Moedas guardadas em ${container.name}.`);
}

function enhanceItemSheet(app, html) {
  if (!enabled() || app.item?.type !== "container" || !app.item.actor || !app.item.isOwner) return;
  const root = rootElement(html);
  if (!root || root.querySelector(".od2qdv-container-sheet")) return;
  const form = root.matches?.("form") ? root : root.querySelector("form");
  if (!form) return;
  form.insertAdjacentHTML("beforeend", itemSheetPanel(app.item));
  if (boundItemSheets.has(root)) return;
  boundItemSheets.add(root);
  root.addEventListener("drop", async (event) => {
    if (!event.target.closest(".od2qdv-container-sheet")) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const handled = await handleDrop(event, app.item.actor, app.item);
    if (handled) app.render(false);
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
    if (button.dataset.od2qdvAction === "delete-item" && selected?.type === "container") await deleteContainer(selected);
    else if (button.dataset.od2qdvAction === "delete-item" && selected) await actor.deleteEmbeddedDocuments("Item", [selected.id]);
    app.render(false);
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
  if (enabled()) console.log(`${MODULE_ID} | Equipamentos em recipientes ativo`);
});
