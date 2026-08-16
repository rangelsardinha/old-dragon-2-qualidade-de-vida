import { actorOwnerNames, canReceiveContainer, carriedLoad, normalizeCoins } from "../equipment-containers/model.js";
import {
  actorCoins, deleteContainer, enhanceActorSheet, transferEmbeddedTree, updateActorCoins
} from "../equipment-containers/index.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const INVENTORY_TYPES = new Set(["weapon", "armor", "shield", "misc", "container", "vehicle"]);
const TYPE_LABELS = {
  weapon: "Arma", armor: "Armadura", shield: "Escudo", misc: "Item geral", container: "Recipiente", vehicle: "Montaria/Transporte"
};
const boundSheets = new WeakSet();

function enabled() {
  return game.system.id === "olddragon2e" && game.settings.get(MODULE_ID, "enableMonsterEquipment");
}

function containersEnabled() {
  try { return game.settings.get(MODULE_ID, "enableEquipmentContainers"); }
  catch { return false; }
}

function rootElement(html) {
  if (html instanceof HTMLElement) return html;
  return html?.[0] ?? html;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function isNested(item) {
  return containersEnabled() && Boolean(item.getFlag(MODULE_ID, "parentContainerId"));
}

function inventoryItems(actor) {
  return actor.items
    .filter((item) => INVENTORY_TYPES.has(item.type) && !isNested(item))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
}

function itemRow(item) {
  return `<li class="item od2qdv-monster-item" data-item-id="${item.id}" draggable="true">
    <img src="${escapeHtml(item.img)}" alt="" width="32" height="32">
    <button type="button" data-monster-equipment-action="edit" title="Abrir item">${escapeHtml(item.name)}</button>
    <span>${TYPE_LABELS[item.type] ?? escapeHtml(item.type)}</span>
    <span>${escapeHtml(item.system?.quantity ?? 1)}</span>
    <span class="od2qdv-monster-item-controls">
      <a data-monster-equipment-action="transfer" title="Transferir" aria-label="Transferir"><i class="fas fa-people-arrows"></i></a>
      <a data-monster-equipment-action="delete" title="Excluir" aria-label="Excluir"><i class="fas fa-trash"></i></a>
    </span>
  </li>`;
}

function equipmentTab(actor) {
  const coins = actorCoins(actor);
  const load = carriedLoad(actor.items.filter((item) => INVENTORY_TYPES.has(item.type) && item.type !== "vehicle"), coins);
  const wallet = `<div class="od2qdv-monster-wallet">
    <strong>Moedas</strong>
    <label>PO <input type="number" min="0" data-monster-coin="gp" value="${coins.gp}"></label>
    <label>PP <input type="number" min="0" data-monster-coin="sp" value="${coins.sp}"></label>
    <label>PC <input type="number" min="0" data-monster-coin="cp" value="${coins.cp}"></label>
    <span class="od2qdv-monster-load" title="Inclui equipamentos, conteúdo dos recipientes e moedas"><i class="fas fa-weight-hanging"></i> Carga total: <strong>${load}</strong></span>
  </div>`;
  const rows = inventoryItems(actor).map(itemRow).join("");
  return `<div class="tab od2qdv-monster-equipment" data-group="primary-tabs" data-tab="od2qdv-monster-equipment">
    <header><strong>Equipamentos carregados</strong><button type="button" data-monster-equipment-action="create"><i class="fas fa-plus"></i> Criar item</button></header>
    <p class="hint">Arraste equipamentos dos compêndios ou de outra ficha para esta área.</p>
    ${wallet}
    <ol class="item-list">${rows || '<li class="od2qdv-monster-empty">Nenhum equipamento.</li>'}</ol>
  </div>`;
}

async function chooseTarget(item) {
  const candidates = game.actors
    .filter((actor) => actor.id !== item.actor.id && canReceiveContainer(actor) && actor.isOwner)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!candidates.length) return ui.notifications.warn("Nenhum ator editável está disponível para receber o item.");
  const DialogClass = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  const targetId = await DialogClass.prompt({
    title: `Transferir ${item.name}`,
    content: `<div class="form-group"><label>Destino</label><select name="targetActor">${candidates.map((actor) => {
      const owners = actorOwnerNames(actor, game.users, ownerLevel);
      const owner = owners.length ? owners.join(", ") : "Mestre";
      const kind = actor.type === "monster" ? " [Monstro]" : actor.type === "retainer" ? " [Ajudante]" : "";
      return `<option value="${actor.id}">${escapeHtml(actor.name)}${kind} (${escapeHtml(owner)})</option>`;
    }).join("")}</select></div>`,
    label: "Transferir",
    callback: (html) => html.find?.('[name="targetActor"]').val() ?? html.querySelector?.('[name="targetActor"]')?.value,
    rejectClose: false
  });
  const target = game.actors.get(targetId);
  if (target) await transferEmbeddedTree(item, target);
}

async function handleDrop(event, actor) {
  let data;
  try { data = JSON.parse(event.dataTransfer.getData("text/plain")); }
  catch { return; }
  if (data?.type !== "Item") return;
  const source = await Item.implementation.fromDropData(data);
  if (!source || !INVENTORY_TYPES.has(source.type)) {
    ui.notifications.warn("Somente equipamentos podem ser carregados por monstros.");
    return;
  }
  if (source.actor?.id === actor.id) return;
  if (source.actor) return transferEmbeddedTree(source, actor);
  const itemData = source.toObject();
  delete itemData._id;
  await actor.createEmbeddedDocuments("Item", [itemData]);
}

async function saveWallet(actor, tab) {
  const coins = normalizeCoins(Object.fromEntries(["gp", "sp", "cp"].map((key) => [key, tab.querySelector(`[data-monster-coin="${key}"]`)?.value])));
  await updateActorCoins(actor, coins);
}

function activateEquipmentTab(app, root) {
  app._od2qdvMonsterEquipmentActive = true;
  const controller = app._tabs?.[0];
  if (controller?.activate) return controller.activate("od2qdv-monster-equipment");
  root.querySelectorAll('nav.tabs .item').forEach((element) => element.classList.toggle("active", element.dataset.tab === "od2qdv-monster-equipment"));
  root.querySelectorAll("section.section > .tab").forEach((element) => element.classList.toggle("active", element.dataset.tab === "od2qdv-monster-equipment"));
}

function enhanceMonsterSheet(app, html) {
  if (!enabled() || app.actor?.type !== "monster" || !app.actor.isOwner) return;
  const root = rootElement(html);
  if (!root) return;
  const actor = app.actor;
  const nav = root.querySelector('nav.tabs[data-group="primary-tabs"]');
  const section = root.querySelector("section.section");
  if (!nav || !section) return;
  if (!nav.querySelector('[data-tab="od2qdv-monster-equipment"]')) {
    nav.insertAdjacentHTML("beforeend", '<a class="item" data-tab="od2qdv-monster-equipment"><i class="fas fa-suitcase"></i> Equipamentos</a>');
  }
  if (!section.querySelector('[data-tab="od2qdv-monster-equipment"]')) section.insertAdjacentHTML("beforeend", equipmentTab(actor));
  if (containersEnabled()) enhanceActorSheet(app, root);
  if (app._od2qdvMonsterEquipmentActive) activateEquipmentTab(app, root);
  if (boundSheets.has(root)) return;
  boundSheets.add(root);

  root.addEventListener("click", async (event) => {
    if (event.target.closest('nav.tabs[data-group="primary-tabs"] [data-tab="od2qdv-monster-equipment"]')) {
      event.preventDefault(); activateEquipmentTab(app, root); return;
    }
    if (event.target.closest('nav.tabs[data-group="primary-tabs"] .item')) {
      app._od2qdvMonsterEquipmentActive = false;
    }
    const button = event.target.closest("[data-monster-equipment-action]");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const item = actor.items.get(button.closest(".item[data-item-id]")?.dataset.itemId);
    const action = button.dataset.monsterEquipmentAction;
    if (action === "create") await actor.createEmbeddedDocuments("Item", [{ name: "Novo item", type: "misc" }]);
    if (action === "edit") item?.sheet.render(true);
    if (action === "transfer" && item) await chooseTarget(item);
    if (action === "delete" && item?.type === "container" && containersEnabled()) await deleteContainer(item);
    else if (action === "delete" && item) await actor.deleteEmbeddedDocuments("Item", [item.id]);
    app.render(false);
  }, true);
  root.addEventListener("dragstart", (event) => {
    const item = actor.items.get(event.target.closest(".item[data-item-id]")?.dataset.itemId);
    if (!item) return;
    event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
  }, true);
  root.addEventListener("drop", async (event) => {
    if (!event.target.closest(".od2qdv-monster-equipment")) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    await handleDrop(event, actor);
    app.render(false);
  }, true);
  root.addEventListener("change", async (event) => {
    if (!event.target.matches("[data-monster-coin]")) return;
    event.stopPropagation();
    await saveWallet(actor, root.querySelector(".od2qdv-monster-equipment"));
    app.render(false);
  }, true);
}

Hooks.on("renderActorSheet", enhanceMonsterSheet);
Hooks.on("renderOD2MonsterSheet", enhanceMonsterSheet);
