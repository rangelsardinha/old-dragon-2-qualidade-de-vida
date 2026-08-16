import { actorOwnerNames } from "../equipment-containers/model.js";
import { curseForRoll, selectRandomSpells } from "./model.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const TOMO_FLAG_ID = "tomo-de-magia-od2";
const INVENTORY_ACTOR_TYPES = new Set(["character", "retainer"]);

function enabled() {
  return game.system.id === "olddragon2e" && game.settings.get(MODULE_ID, "enableScrollGenerator");
}

function tomeEnabled() {
  return game.settings.get(MODULE_ID, "enableSpellTome");
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

function validCircle(value) {
  const circle = Number(value);
  return Number.isInteger(circle) && circle >= 1 && circle <= 9 ? circle : null;
}

async function evaluateRoll(formula) {
  const roll = new Roll(formula);
  if (Number(game.release?.generation ?? 13) >= 14) return roll.evaluateSync();
  return roll.roll({ async: true });
}

function spellEntries(document, source, uuid = document.uuid) {
  if (document.type !== "spell") return [];
  const entries = [];
  const arcane = validCircle(document.system?.arcane ?? (document.system?.school === "arcane" ? document.system?.circle : null));
  const divine = validCircle(document.system?.divine ?? (document.system?.school === "divine" ? document.system?.circle : null));
  if (arcane) entries.push({ name: document.name, circle: arcane, tradition: "arcane", source, uuid });
  if (divine) entries.push({ name: document.name, circle: divine, tradition: "divine", source, uuid });
  return entries;
}

async function loadSrdSpells() {
  const spells = [];
  for (const pack of game.packs) {
    const metadata = pack.metadata ?? {};
    const packageName = metadata.packageName ?? metadata.package;
    if (pack.documentName !== "Item" || packageName !== game.system.id) continue;
    const index = await pack.getIndex({ fields: ["type", "system.arcane", "system.divine", "system.school", "system.circle"] });
    for (const entry of index) {
      const uuid = entry.uuid ?? `Compendium.${pack.collection}.Item.${entry._id}`;
      spells.push(...spellEntries(entry, "SRD", uuid));
    }
  }
  return spells;
}

async function loadTomeSpells() {
  const response = await fetch(`modules/${MODULE_ID}/data/spell-tome/spells.json`);
  if (!response.ok) throw new Error(`Falha ao carregar Tomo de Magia: ${response.status}`);
  const data = await response.json();
  return [...(data.arcane ?? []), ...(data.divine ?? [])].flatMap((spell) => {
    const meta = spell.flags?.[TOMO_FLAG_ID] ?? {};
    const circle = validCircle(meta.circulo);
    const packName = meta.tradicao === "divine" ? "divine-spells" : "arcane-spells";
    const uuid = `Compendium.${MODULE_ID}.${packName}.Item.${spell._id}`;
    return circle ? [{ name: spell.name, circle, tradition: meta.tradicao, source: "Tomo", uuid }] : [];
  });
}

function deduplicate(spells) {
  const seen = new Set();
  return spells.filter((spell) => {
    const key = `${spell.tradition}:${spell.circle}:${spell.name.toLocaleLowerCase("pt-BR")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function spellPool({ tradition, source, maxCircle }) {
  const spells = [];
  if (source === "srd" || source === "both") spells.push(...await loadSrdSpells());
  if (source === "tome" || source === "both") spells.push(...await loadTomeSpells());
  return deduplicate(spells).filter((spell) =>
    spell.circle <= maxCircle && (tradition === "both" || spell.tradition === tradition)
  );
}

function dialogValue(html, selector) {
  return html.find?.(selector).val() ?? html.querySelector?.(selector)?.value;
}

function htmlRoot(html) {
  return html?.[0] ?? html;
}

async function promptOptions() {
  const sourceField = tomeEnabled()
    ? `<div class="form-group"><label>Fonte das magias</label><select name="source"><option value="srd">SRD</option><option value="tome">Tomo de Magia</option><option value="both">SRD e Tomo</option></select></div>`
    : '<input type="hidden" name="source" value="srd">';
  const content = `<div class="od2qdv-scroll-form">
      <div class="form-group"><label>Tradição</label><select name="tradition"><option value="arcane">Arcano</option><option value="divine">Divino</option><option value="both">Arcano e Divino</option></select></div>
      ${sourceField}
      <div class="form-group"><label>Círculo máximo</label><input type="number" name="maxCircle" value="1" min="1" max="9" step="1"></div>
    </div>`;
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (Number(game.release?.generation ?? 13) >= 14 && DialogV2) {
    return DialogV2.prompt({
      window: { title: "Gerador de Pergaminhos" },
      content,
      ok: {
        label: "Gerar pergaminho",
        callback: (_event, button) => ({
          tradition: button.form.elements.tradition.value,
          source: button.form.elements.source.value,
          maxCircle: validCircle(button.form.elements.maxCircle.value)
        })
      }
    });
  }
  const DialogClass = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  return DialogClass.prompt({
    title: "Gerador de Pergaminhos",
    content,
    label: "Gerar pergaminho",
    callback: (html) => ({
      tradition: dialogValue(html, '[name="tradition"]'),
      source: dialogValue(html, '[name="source"]'),
      maxCircle: validCircle(dialogValue(html, '[name="maxCircle"]'))
    }),
    rejectClose: false
  });
}

async function rollCurse(mode = "random") {
  if (mode === "safe") return null;
  if (mode !== "cursed") {
    const chance = await evaluateRoll("1d10");
    if (chance.total !== 1) return null;
  }
  const effect = await evaluateRoll("1d6");
  return curseForRoll(effect.total);
}

async function scrollItemData(spells, curse) {
  const storedSpells = await Promise.all(spells.map(async (spell) => {
    const document = spell.uuid ? await fromUuid(spell.uuid).catch(() => null) : null;
    const system = document?.system?.toObject?.()
      ?? (document?.system ? foundry.utils.deepClone(document.system) : null)
      ?? (spell.system ? foundry.utils.deepClone(spell.system) : null);
    return { ...spell, system };
  }));
  const tradition = [...new Set(storedSpells.map((spell) => spell.tradition))].map((value) => value === "arcane" ? "Arcana" : "Divina").join(" e ");
  return {
    name: `Pergaminho Mágico ${tradition}`,
    type: "misc",
    img: "icons/sundries/scrolls/scroll-bound-sealed-red.webp",
    system: {
      quantity: 1,
      magic_item: true,
      weight_in_load: 0,
      weight_in_grams: 10,
      description: scrollDescription(storedSpells)
    },
    flags: {
      [MODULE_ID]: {
        generatedScroll: true,
        spells: storedSpells,
        cursed: Boolean(curse),
        curse: curse ? { roll: curse.roll, key: curse.key, effect: curse.text } : null
      }
    }
  };
}

function scrollDescription(spells) {
  const lines = spells.map((spell) => `${spell.name} — ${spell.circle}º círculo (${spell.source})`);
  return `Magias do pergaminho:\n${lines.join("\n")}`;
}

async function migrateScrollDescriptions() {
  if (!game.user.isGM) return;
  const worldItems = Array.from(game.items ?? []);
  const actorItems = Array.from(game.actors ?? []).flatMap((actor) => Array.from(actor.items ?? []));
  for (const item of [...worldItems, ...actorItems]) {
    if (!item.getFlag?.(MODULE_ID, "generatedScroll")) continue;
    const updates = {};
    if (item.system?.magic_item !== true) updates["system.magic_item"] = true;
    const description = String(item.system?.description ?? "");
    if (description.includes("<") || description.includes("@UUID[")) {
      const spells = item.getFlag(MODULE_ID, "spells") ?? [];
      updates["system.description"] = scrollDescription(spells);
    }
    if (Object.keys(updates).length) await item.update(updates);
  }
}

async function chooseTarget(itemData) {
  const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  const actors = game.actors.filter((actor) => INVENTORY_ACTOR_TYPES.has(actor.type) && actor.isOwner)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!actors.length) return ui.notifications.warn("Nenhum personagem ou ajudante editável está disponível.");
  const content = `<div class="form-group"><label>Ator de destino</label><select name="targetActor">${actors.map((actor) => {
      const owners = actorOwnerNames(actor, game.users, ownerLevel);
      return `<option value="${actor.id}">${escapeHtml(actor.name)} (${escapeHtml(owners.join(", ") || "Mestre")})</option>`;
    }).join("")}</select></div>`;
  const DialogV2 = foundry.applications?.api?.DialogV2;
  const targetId = Number(game.release?.generation ?? 13) >= 14 && DialogV2
    ? await DialogV2.prompt({
      window: { title: `Transferir ${itemData.name}` }, content,
      ok: { label: "Transferir pergaminho", callback: (_event, button) => button.form.elements.targetActor.value }
    })
    : await (foundry.appv1?.api?.Dialog ?? globalThis.Dialog).prompt({
      title: `Transferir ${itemData.name}`, content, label: "Transferir pergaminho",
      callback: (html) => dialogValue(html, '[name="targetActor"]'), rejectClose: false
    });
  const actor = game.actors.get(targetId);
  if (!actor) return;
  await actor.createEmbeddedDocuments("Item", [itemData]);
  ui.notifications.info(`${itemData.name} foi transferido para ${actor.name}.`);
}

async function showResult(itemData, spells, curse) {
  const spellList = spells.map((spell) => `<li><strong>${escapeHtml(spell.name)}</strong> — ${spell.circle}º círculo, ${spell.tradition === "arcane" ? "Arcana" : "Divina"} (${spell.source})</li>`).join("");
  const curseBlock = curse ? `<aside class="od2qdv-scroll-curse"><strong><i class="fas fa-eye-slash"></i> Informação exclusiva do Mestre</strong><p>Pergaminho amaldiçoado — resultado ${curse.roll} em 1d6.</p><p>${escapeHtml(curse.text)}</p></aside>` : "";
  const content = `<section class="od2qdv-scroll-result"><h2>Magias</h2><ol>${spellList}</ol>${curseBlock}</section>`;
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (Number(game.release?.generation ?? 13) >= 14 && DialogV2) {
    await DialogV2.wait({
      window: { title: itemData.name },
      content,
      buttons: [
        { action: "transfer", icon: "fa-solid fa-people-arrows", label: "Transferir para ator", default: true, callback: () => chooseTarget(itemData) },
        { action: "close", icon: "fa-solid fa-times", label: "Fechar" }
      ]
    });
    return;
  }
  const DialogClass = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  new DialogClass({
    title: itemData.name,
    content,
    buttons: {
      transfer: { icon: '<i class="fas fa-people-arrows"></i>', label: "Transferir para ator", callback: () => chooseTarget(itemData) },
      close: { icon: '<i class="fas fa-times"></i>', label: "Fechar" }
    },
    default: "transfer"
  }).render(true);
}

async function generateRandomScroll(curseMode = "random") {
  const options = await promptOptions();
  if (!options) return;
  if (!options.maxCircle) return ui.notifications.warn("Escolha um círculo máximo entre 1 e 9.");
  const pool = await spellPool(options);
  if (!pool.length) return ui.notifications.warn("Nenhuma magia foi encontrada para os filtros escolhidos.");
  const spells = selectRandomSpells(pool, 3);
  const curse = await rollCurse(curseMode);
  const itemData = await scrollItemData(spells, curse);
  await showResult(itemData, spells, curse);
}

async function spellFromDrop(event) {
  let data = {};
  try {
    const Editor = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    data = Editor?.getDragEventData?.(event) ?? {};
    if (!data || !Object.keys(data).length) {
      const raw = event.dataTransfer?.getData("text/plain") || event.dataTransfer?.getData("application/json");
      data = raw ? JSON.parse(raw) : {};
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Dados inválidos ao soltar magia`, error, event.dataTransfer?.types);
    return null;
  }
  if (data?.type !== "Item") {
    console.warn(`${MODULE_ID} | O objeto solto não é um Item`, data);
    return null;
  }
  const ItemClass = foundry.utils.getDocumentClass?.("Item") ?? globalThis.Item?.implementation ?? globalThis.Item;
  const item = await ItemClass?.fromDropData?.(data);
  if (item?.type !== "spell") {
    console.warn(`${MODULE_ID} | O Item solto não é uma magia`, { data, item });
    return null;
  }
  // The Tomo content is incorporated into this module, so its original flag
  // scope is intentionally not an active Foundry package. Calling getFlag for
  // that scope throws in Foundry 14; read the preserved source metadata directly.
  const source = item.flags?.[TOMO_FLAG_ID]?.tradicao ? "Tomo" : "SRD";
  const spell = spellEntries(item, source, item.uuid)[0] ?? null;
  if (!spell) return null;
  const system = item.system?.toObject?.() ?? (item.system ? foundry.utils.deepClone(item.system) : null);
  return { ...spell, system };
}

const BaseApplication = foundry.appv1?.api?.Application ?? globalThis.Application;

class ManualScrollBuilder extends BaseApplication {
  constructor(options = {}) {
    super(options);
    this.selected = [];
    this.settled = false;
    this.resultPromise = new Promise((resolve) => { this.resolveResult = resolve; });
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "od2qdv-manual-scroll-builder",
      title: "Montar Pergaminho",
      template: `modules/${MODULE_ID}/scripts/features/scroll-generator/manual-builder.hbs`,
      width: 520,
      height: "auto",
      resizable: true,
      classes: ["od2qdv-scroll-builder-app"]
    });
  }

  getData() {
    return { spells: this.selected };
  }

  async _onDrop(event) {
    event.preventDefault();
    const spell = await spellFromDrop(event);
    if (!spell) return ui.notifications.warn("Somente itens do tipo magia podem ser adicionados ao pergaminho.");
    if (!this.selected.some((candidate) => candidate.uuid === spell.uuid && candidate.tradition === spell.tradition)) {
      this.selected.push(spell);
      ui.notifications.info(`${spell.name} foi adicionada ao pergaminho.`);
    }
    this.render(false);
  }

  activateListeners(html) {
    super.activateListeners(html);
    // Bind directly as well as through Application#dragDrop. Some OD2/Foundry 14
    // sheet combinations stop propagation before the legacy DragDrop controller.
    const dropZone = rootElement(html)?.querySelector(".od2qdv-scroll-drop");
    if (dropZone) {
      dropZone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        dropZone.classList.add("dragover");
      });
      dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        dropZone.classList.add("dragover");
      });
      dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
      dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove("dragover");
        this._onDrop(event).catch((error) => {
          console.error(`${MODULE_ID} | Falha ao adicionar magia ao pergaminho`, error);
          ui.notifications.error("Não foi possível ler a magia arrastada. Consulte o console (F12).");
        });
      });
    }
    html.find("[data-remove-spell]").on("click", (event) => {
      this.selected.splice(Number(event.currentTarget.dataset.removeSpell), 1);
      this.render(false);
    });
    html.find('[data-action="create"]').on("click", () => {
      if (!this.selected.length) return ui.notifications.warn("Arraste pelo menos uma magia para o pergaminho.");
      this.settled = true;
      this.resolveResult({
        spells: [...this.selected],
        curseMode: dialogValue(html, '[name="curseMode"]') ?? "random"
      });
      this.close();
    });
    html.find('[data-action="cancel"]').on("click", () => this.close());
  }

  async close(options = {}) {
    if (!this.settled) {
      this.settled = true;
      this.resolveResult(null);
    }
    return super.close(options);
  }
}

async function promptManualSpells() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (Number(game.release?.generation ?? 13) >= 14 && DialogV2) {
    const selected = [];
    const content = (await foundry.applications.handlebars.renderTemplate(
      `modules/${MODULE_ID}/scripts/features/scroll-generator/manual-builder.hbs`,
      { spells: selected }
    )).replace(/<footer class="od2qdv-scroll-builder-actions">[\s\S]*?<\/footer>/, "");
    const refreshList = (dialog) => {
      const list = dialog.element.querySelector(".od2qdv-scroll-selected");
      if (!list) return;
      list.innerHTML = selected.length
        ? selected.map((spell, index) => `<li>${escapeHtml(spell.name)} — ${spell.circle}º círculo (${escapeHtml(spell.source)}) <a data-remove-spell="${index}" title="Remover"><i class="fas fa-trash"></i></a></li>`).join("")
        : '<li class="empty">Nenhuma magia selecionada.</li>';
    };
    return DialogV2.wait({
      window: { title: "Montar Pergaminho" },
      position: { width: 520 },
      content,
      buttons: [
        {
          action: "create", icon: "fa-solid fa-wand-magic-sparkles", label: "Criar pergaminho", default: true,
          callback: (_event, button) => {
            if (!selected.length) {
              ui.notifications.warn("Arraste pelo menos uma magia para o pergaminho.");
              return null;
            }
            return { spells: [...selected], curseMode: button.form.elements.curseMode.value };
          }
        },
        { action: "cancel", icon: "fa-solid fa-times", label: "Cancelar", callback: () => null }
      ],
      render: (_event, dialog) => {
        const dropZone = dialog.element.querySelector(".od2qdv-scroll-drop");
        dropZone?.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.classList.add("dragover"); });
        dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
        dropZone?.addEventListener("drop", async (event) => {
          event.preventDefault();
          dropZone.classList.remove("dragover");
          const spell = await spellFromDrop(event);
          if (!spell) return ui.notifications.warn("Somente itens do tipo magia podem ser adicionados ao pergaminho.");
          if (!selected.some((candidate) => candidate.uuid === spell.uuid && candidate.tradition === spell.tradition)) selected.push(spell);
          refreshList(dialog);
        });
        dialog.element.addEventListener("click", (event) => {
          const remove = event.target.closest?.("[data-remove-spell]");
          if (!remove) return;
          selected.splice(Number(remove.dataset.removeSpell), 1);
          refreshList(dialog);
        });
      }
    });
  }
  const builder = new ManualScrollBuilder();
  builder.render(true);
  return builder.resultPromise;
}

async function generateManualScroll(curseMode = "random") {
  const result = await promptManualSpells();
  const spells = result?.spells;
  if (!spells?.length) return;
  const curse = await rollCurse(result.curseMode ?? curseMode);
  const itemData = await scrollItemData(spells, curse);
  await showResult(itemData, spells, curse);
}

async function generateScroll() {
  if (!game.user.isGM) return ui.notifications.warn("Somente o Mestre pode gerar pergaminhos.");
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (Number(game.release?.generation ?? 13) >= 14 && DialogV2) {
    const choice = await DialogV2.wait({
      window: { title: "Gerador de Pergaminhos" },
      position: { width: 480 },
      content: `<p>Como deseja escolher as magias do pergaminho?</p><div class="form-group"><label>Maldição</label><select name="curseMode"><option value="random">Aleatória (10% de chance)</option><option value="cursed">Amaldiçoado (caótico)</option><option value="safe">Não amaldiçoado</option></select></div>`,
      buttons: [
        {
          action: "random",
          icon: "fa-solid fa-dice",
          label: "Sortear magias",
          default: true,
          callback: (_event, button) => ({ action: "random", curseMode: button.form.elements.curseMode.value })
        },
        {
          action: "manual",
          icon: "fa-solid fa-hand",
          label: "Selecionar magias",
          callback: (_event, button) => ({ action: "manual", curseMode: button.form.elements.curseMode.value })
        },
        { action: "cancel", icon: "fa-solid fa-times", label: "Cancelar", callback: () => null }
      ]
    });
    if (choice?.action === "random") return generateRandomScroll(choice.curseMode);
    if (choice?.action === "manual") return generateManualScroll(choice.curseMode);
    return;
  }
  const DialogClass = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  new DialogClass({
    title: "Gerador de Pergaminhos",
    content: `<p>Como deseja escolher as magias do pergaminho?</p><div class="form-group"><label>Maldição</label><select name="curseMode"><option value="random">Aleatória (10% de chance)</option><option value="cursed">Amaldiçoado (caótico)</option><option value="safe">Não amaldiçoado</option></select></div>`,
    buttons: {
      random: { icon: '<i class="fas fa-dice"></i>', label: "Sortear magias", callback: (html) => generateRandomScroll(dialogValue(html, '[name="curseMode"]')) },
      manual: { icon: '<i class="fas fa-hand"></i>', label: "Selecionar magias", callback: (html) => generateManualScroll(dialogValue(html, '[name="curseMode"]')) },
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" }
    },
    default: "random"
  }).render(true);
}

function addDirectoryButton(app, html) {
  if (!enabled() || !game.user.isGM) return;
  const root = rootElement(html);
  if (!root || root.querySelector(".od2qdv-open-scroll-generator")) return;
  const header = root.querySelector(".directory-header .header-actions, .directory-header");
  if (!header) return;
  header.insertAdjacentHTML("beforeend", '<button type="button" class="od2qdv-open-scroll-generator"><i class="fas fa-scroll"></i> Gerar Pergaminho</button>');
  header.querySelector(".od2qdv-open-scroll-generator").addEventListener("click", () => generateScroll().catch((error) => {
    console.error(`${MODULE_ID} | Falha ao gerar pergaminho`, error);
    ui.notifications.error("Não foi possível gerar o pergaminho. Consulte o console.");
  }));
}

async function enrichedSpellLink(spell) {
  if (!spell.uuid) return escapeHtml(spell.name);
  const Editor = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  if (!Editor?.enrichHTML) return escapeHtml(spell.name);
  return Editor.enrichHTML(`@UUID[${spell.uuid}]{${spell.name}}`, { async: true });
}

async function storedSpellSystem(spell) {
  const document = spell.uuid ? await fromUuid(spell.uuid).catch(() => null) : null;
  if (document?.system) return document.system;
  if (spell.system) return spell.system;
  if (spell.source !== "Tomo") return null;
  try {
    const response = await fetch(`modules/${MODULE_ID}/data/spell-tome/spells.json`);
    if (!response.ok) return null;
    const data = await response.json();
    const id = String(spell.uuid ?? "").split(".").pop();
    const source = [...(data.arcane ?? []), ...(data.divine ?? [])]
      .find((candidate) => candidate._id === id || candidate.name === spell.name);
    return source?.system ?? null;
  } catch {
    return null;
  }
}

async function whisperCurse(item, curse) {
  const recipients = ChatMessage.getWhisperRecipients?.("GM") ?? game.users.filter((user) => user.isGM);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    whisper: recipients.map((user) => user.id),
    content: `<section class="od2qdv-scroll-curse"><h2>Pergaminho amaldiçoado</h2><p><strong>${escapeHtml(item.name)}</strong> foi usado por ${escapeHtml(game.user.name)}.</p><p>Resultado ${curse.roll} em 1d6: ${escapeHtml(curse.effect)}</p></section>`
  });
}

async function useScrollSpell(app, item, spell) {
  if (!item?.isOwner) return ui.notifications.warn("Você não possui permissão para usar este pergaminho.");
  const document = spell.uuid ? await fromUuid(spell.uuid).catch(() => null) : null;
  const system = document?.system ?? spell.system ?? await storedSpellSystem(spell);
  if (!system) return ui.notifications.error("Os dados da magia deste pergaminho não estão disponíveis.");
  const template = "systems/olddragon2e/templates/chat/spell-chat.hbs";
  const content = await foundry.applications.handlebars.renderTemplate(template, {
    name: spell.name,
    owner: item.actor?.id,
    id: document?.id,
    system
  });
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    sound: "sounds/dice.wav",
    content
  });
  const curse = item.getFlag(MODULE_ID, "curse");
  if (curse) await whisperCurse(item, curse);
  await item.delete();
  app.close?.();
}

async function addScrollPanel(app, html) {
  if (!enabled()) return;
  const item = app.item ?? app.document;
  if (!item?.getFlag?.(MODULE_ID, "generatedScroll")) return;
  const spells = item.getFlag(MODULE_ID, "spells") ?? [];
  const curse = item?.getFlag?.(MODULE_ID, "curse");
  const root = rootElement(html);
  const form = root?.querySelector("form") ?? root;
  if (!form || form.querySelector(".od2qdv-scroll-use")) return;
  const links = await Promise.all(spells.map(enrichedSpellLink));
  const rows = spells.map((spell, index) => `<li><span>${links[index]} — ${spell.circle}º círculo</span><button type="button" data-use-scroll-spell="${index}"><i class="fas fa-hand-sparkles"></i> Usar</button></li>`).join("");
  const cursePanel = game.user.isGM && curse
    ? `<aside class="od2qdv-scroll-curse"><strong><i class="fas fa-eye-slash"></i> Maldição — somente Mestre</strong><p>Resultado ${curse.roll} em 1d6: ${escapeHtml(curse.effect)}</p></aside>`
    : "";
  form.insertAdjacentHTML("beforeend", `<section class="od2qdv-scroll-use"><h2><i class="fas fa-scroll"></i> Magias do pergaminho</h2><ol>${rows}</ol><p class="hint">Usar uma magia publica seu cartão no chat e consome este pergaminho.</p>${cursePanel}</section>`);
  form.querySelector(".od2qdv-scroll-use").addEventListener("click", (event) => {
    const button = event.target.closest("[data-use-scroll-spell]");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    button.disabled = true;
    useScrollSpell(app, item, spells[Number(button.dataset.useScrollSpell)]).catch((error) => {
      button.disabled = false;
      console.error(`${MODULE_ID} | Falha ao usar pergaminho`, error);
      ui.notifications.error("Não foi possível usar o pergaminho. Consulte o console.");
    });
  });
}

Hooks.on("renderItemDirectory", addDirectoryButton);
Hooks.on("renderItemSheet", addScrollPanel);

Hooks.once("ready", () => {
  game.od2Qdv ??= {};
  game.od2Qdv.scrollGenerator = { open: generateScroll };
  if (enabled()) migrateScrollDescriptions().catch((error) => console.error(`${MODULE_ID} | Falha ao corrigir descrições de pergaminhos`, error));
});
