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

function spellCircle(spell) {
  for (const key of ["arcane", "divine", "necromancer", "illusionist"]) {
    const value = Number(spell.system?.[key]);
    if (value > 0) return value;
  }
  return 1;
}

async function magicTab(actor) {
  const spells = actor.items.filter((item) => item.type === "spell");
  const spellByCircle = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index + 1, { circle: index + 1, spells: [] }]));
  for (const spell of spells) spellByCircle[spellCircle(spell)].spells.push(spell);
  const content = await foundry.applications.handlebars.renderTemplate("systems/olddragon2e/templates/partials/tabs/character-tab-spells.hbs", { actor, system: actor.system, spell: spells, spell_by_circle: spellByCircle });
  return `<div class="tab od2qdv-monster-magic" data-group="primary-tabs" data-tab="od2qdv-monster-magic"><div class="olddragon2e sheet character od2qdv-monster-magic-native">${content.replace(/<div class="create">[\s\S]*?<\/div>\s*<\/div>/, '<div class="create"></div></div>')}</div></div>`;
}

async function castMonsterSpell(actor, item, { skipUsage = false } = {}) {
  const flags = item.getFlag("olddragon2e", "spell") || {};
  if (!flags.memorized) return ui.notifications.warn(game.i18n.format("olddragon2e.notifications.spell_not_memorized", { name: item.name }));
  const slots = Number(flags.slots) || 0;
  if (slots < 1) return ui.notifications.warn(game.i18n.localize("olddragon2e.notifications.spell_requires_slots"));
  if (!skipUsage) {
    const dailyUses = foundry.utils.duplicate(flags["daily-uses"] || {});
    let used = false;
    for (let index = 1; index <= slots; index++) if (!dailyUses[index]) { dailyUses[index] = true; used = true; break; }
    if (!used) return ui.notifications.warn(game.i18n.format("olddragon2e.notifications.spell_no_uses_left", { name: item.name }));
    await item.update({ "flags.olddragon2e.spell.daily-uses": dailyUses });
  }
  const content = await foundry.applications.handlebars.renderTemplate("systems/olddragon2e/templates/chat/spell-chat.hbs", { name: item.name, owner: actor.id, id: item.id, system: item.system });
  return ChatMessage.create({ user: game.user.id, speaker: { alias: actor.name }, sound: "sounds/dice.wav", content });
}

async function chooseTarget(item) {
  const candidates = game.actors
    .filter((actor) => actor.id !== item.actor.id && canReceiveContainer(actor) && actor.isOwner)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!candidates.length) return ui.notifications.warn("Nenhum ator editável está disponível para receber o item.");
  const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  const content = `<div class="form-group"><label>Destino</label><select name="targetActor">${candidates.map((actor) => {
      const owners = actorOwnerNames(actor, game.users, ownerLevel);
      const owner = owners.length ? owners.join(", ") : "Mestre";
      const kind = actor.type === "monster" ? " [Monstro]" : actor.type === "retainer" ? " [Ajudante]" : "";
      return `<option value="${actor.id}">${escapeHtml(actor.name)}${kind} (${escapeHtml(owner)})</option>`;
    }).join("")}</select></div>`;
  const DialogV2 = Number(game.release?.generation ?? 13) >= 14 ? foundry.applications?.api?.DialogV2 : null;
  const targetId = DialogV2
    ? await DialogV2.prompt({
      window: { title: `Transferir ${item.name}` }, content,
      ok: { label: "Transferir", callback: (_event, button) => button.form.elements.targetActor.value }
    })
    : await (foundry.appv1?.api?.Dialog ?? globalThis.Dialog).prompt({
      title: `Transferir ${item.name}`, content, label: "Transferir",
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

async function handleSpellDrop(event, actor) {
  let data;
  try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
  if (data?.type !== "Item") return;
  const source = await Item.implementation.fromDropData(data);
  if (source?.type !== "spell") return ui.notifications.warn("Somente magias podem ser arrastadas para esta aba.");
  if (source.actor?.id === actor.id) return;
  const itemData = source.toObject();
  delete itemData._id;
  await actor.createEmbeddedDocuments("Item", [itemData]);
}

async function saveWallet(actor, tab) {
  const coins = normalizeCoins(Object.fromEntries(["gp", "sp", "cp"].map((key) => [key, tab.querySelector(`[data-monster-coin="${key}"]`)?.value])));
  await updateActorCoins(actor, coins);
}

function activateMonsterTab(app, root, tabName) {
  app._od2qdvMonsterActiveTab = tabName;
  const controller = app._tabs?.[0];
  if (controller?.activate) return controller.activate(tabName);
  root.querySelectorAll('nav.tabs .item').forEach((element) => element.classList.toggle("active", element.dataset.tab === tabName));
  root.querySelectorAll("section.section > .tab").forEach((element) => element.classList.toggle("active", element.dataset.tab === tabName));
}

async function enhanceMonsterSheet(app, html) {
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
  if (!nav.querySelector('[data-tab="od2qdv-monster-magic"]')) nav.insertAdjacentHTML("beforeend", '<a class="item" data-tab="od2qdv-monster-magic"><i class="fas fa-book"></i> Magias</a>');
  if (!section.querySelector('[data-tab="od2qdv-monster-equipment"]')) section.insertAdjacentHTML("beforeend", equipmentTab(actor));
  if (!section.querySelector('[data-tab="od2qdv-monster-magic"]')) section.insertAdjacentHTML("beforeend", await magicTab(actor));
  if (containersEnabled()) enhanceActorSheet(app, root);
  if (app._od2qdvMonsterActiveTab) activateMonsterTab(app, root, app._od2qdvMonsterActiveTab);
  if (boundSheets.has(root)) return;
  boundSheets.add(root);

  root.addEventListener("click", async (event) => {
    if (event.target.closest('nav.tabs[data-group="primary-tabs"] [data-tab="od2qdv-monster-equipment"]')) {
      event.preventDefault(); activateMonsterTab(app, root, "od2qdv-monster-equipment"); return;
    }
    if (event.target.closest('nav.tabs[data-group="primary-tabs"] [data-tab="od2qdv-monster-magic"]')) {
      event.preventDefault(); activateMonsterTab(app, root, "od2qdv-monster-magic"); return;
    }
    if (event.target.closest('nav.tabs[data-group="primary-tabs"] .item')) {
      app._od2qdvMonsterActiveTab = null;
    }
    const button = event.target.closest("[data-monster-equipment-action]");
    const spellRow = event.target.closest(".od2qdv-monster-magic .item[data-item-id]");
    if (spellRow && event.target.closest(".spell-cast, .item-edit, .item-delete")) {
      event.preventDefault(); event.stopPropagation();
      const item = actor.items.get(spellRow.dataset.itemId);
      if (event.target.closest(".spell-cast")) await castMonsterSpell(actor, item);
      else if (event.target.closest(".item-edit")) await item?.sheet.render(true);
      else if (event.target.closest(".item-delete") && item) await actor.deleteEmbeddedDocuments("Item", [item.id]);
      app.render(false); return;
    }
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
    const magicArea = event.target.closest(".od2qdv-monster-magic");
    const equipmentArea = event.target.closest(".od2qdv-monster-equipment");
    if (!magicArea && !equipmentArea) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    if (magicArea) await handleSpellDrop(event, actor); else await handleDrop(event, actor);
    app.render(false);
  }, true);
  root.addEventListener("change", async (event) => {
    if (event.target.matches(".od2qdv-monster-magic .memorized-toggle")) {
      event.stopPropagation();
      const item = actor.items.get(event.target.dataset.itemId);
      const update = { "flags.olddragon2e.spell.memorized": event.target.checked };
      if (!event.target.checked) { update["flags.olddragon2e.spell.slots"] = ""; update["flags.olddragon2e.spell.daily-uses"] = {}; }
      await item?.update(update); app.render(false); return;
    }
    if (event.target.matches(".od2qdv-monster-magic .slots-select")) {
      event.stopPropagation();
      const item = actor.items.get(event.target.dataset.itemId);
      await item?.update({ "flags.olddragon2e.spell.slots": event.target.value ? Number(event.target.value) : "", "flags.olddragon2e.spell.daily-uses": {} });
      app.render(false); return;
    }
    if (event.target.matches(".od2qdv-monster-magic .spell-use-checkbox")) {
      event.stopPropagation();
      const item = actor.items.get(event.target.dataset.itemId);
      const flags = item?.getFlag("olddragon2e", "spell") || {};
      const uses = foundry.utils.duplicate(flags["daily-uses"] || {});
      uses[event.target.dataset.useIndex] = event.target.checked;
      await item?.update({ "flags.olddragon2e.spell.daily-uses": uses });
      if (event.target.checked) await castMonsterSpell(actor, item, { skipUsage: true });
      app.render(false); return;
    }
    if (!event.target.matches("[data-monster-coin]")) return;
    event.stopPropagation();
    await saveWallet(actor, root.querySelector(".od2qdv-monster-equipment"));
    app.render(false);
  }, true);
}

Hooks.on("renderActorSheet", enhanceMonsterSheet);
Hooks.on("renderOD2MonsterSheet", enhanceMonsterSheet);
