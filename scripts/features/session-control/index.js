import { OD2_TIME } from "../effect-manager/model.js";
import { seedAdvancedTurns, updateTurnState } from "./model.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const LEGACY_ID = "carta-de-controle-de-sessao-od2";
const KEYS = { enabled: "sessionControlEnabled", turns: "sessionControlTurns", advanced: "sessionControlAdvancedTurns", public: "sessionControlPublicNotes", private: "sessionControlPrivateNotes" };
const LAYOUT = Array.from({ length: 4 }, (_, hour) => Array.from({ length: 6 }, (_, index) => ({
  n: index + 1,
  events: index === 1 || index === 3 ? ["E"] : index === 5 ? ["D", "T", "E", ...(hour === 3 ? ["L"] : [])] : []
})));

function enabled() { return game.system.id === "olddragon2e" && game.settings.get(MODULE_ID, "enableSessionControl"); }
function rootOf(html) { return html instanceof HTMLElement ? html : html?.[0]; }
function legacy(entry, key) { return entry.flags?.[LEGACY_ID]?.[key]; }
function value(entry, key, fallback) { return entry.getFlag(MODULE_ID, KEYS[key]) ?? legacy(entry, key === "public" ? "publicNotes" : key === "private" ? "privateNotes" : key) ?? fallback; }
function escapeHtml(text) { const node = document.createElement("div"); node.textContent = String(text ?? ""); return node.innerHTML; }

Hooks.on("renderJournalDirectory", (_app, html) => {
  if (!enabled() || !game.user.isGM) return;
  const root = rootOf(html);
  if (!root || root.querySelector(".od2sc-create-journal")) return;
  const target = root.querySelector(".directory-header .header-actions, .directory-header");
  if (!target) return;
  const button = document.createElement("button");
  button.type = "button"; button.className = "od2sc-create-journal";
  button.innerHTML = '<i class="fas fa-clock"></i> Nova Carta de Controle';
  button.addEventListener("click", createJournal);
  target.append(button);
});

for (const hook of ["renderJournalSheet", "renderJournalEntrySheet", "renderJournalPageSheet", "renderJournalTextPageSheet", "renderJournalEntryPageSheet"]) Hooks.on(hook, renderCard);

Hooks.once("ready", () => {
  game.od2Qdv ??= {};
  game.od2Qdv.sessionControl = { createJournal };
  if (enabled() && game.modules.get(LEGACY_ID)?.active && game.user.isGM) ui.notifications.warn("Carta de Controle: desative o módulo separado para evitar botões e eventos duplicados.");
});

async function createJournal() {
  if (!enabled() || !game.user.isGM) return ui.notifications.warn("Apenas o Mestre pode criar cartas de controle.");
  const entry = await JournalEntry.create({
    name: "Cartão de Controle de Sessão",
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2 },
    pages: [{ name: "Controle", type: "text", text: { content: '<div class="od2sc-placeholder">Carta de Controle de Sessão</div>' } }]
  });
  await entry.update({
    [`flags.${MODULE_ID}.${KEYS.enabled}`]: true,
    [`flags.${MODULE_ID}.${KEYS.turns}`]: {},
    [`flags.${MODULE_ID}.${KEYS.advanced}`]: {},
    [`flags.${MODULE_ID}.${KEYS.public}`]: "",
    [`flags.${MODULE_ID}.${KEYS.private}`]: ""
  });
  entry.sheet.render(true);
}

function renderCard(app, html) {
  if (!enabled()) return;
  const document = app.document;
  const entry = document?.documentName === "JournalEntry" ? document : document?.parent;
  if (!entry || !(value(entry, "enabled", false))) return;
  if (entry.getFlag(MODULE_ID, KEYS.advanced) === undefined && game.user.isGM) {
    entry.setFlag(MODULE_ID, KEYS.advanced, seedAdvancedTurns(value(entry, "turns", {}), undefined));
  }
  const root = rootOf(html); if (!root) return;
  const card = documentFromHtml(cardHtml(entry));
  const current = root.querySelector(".od2sc-card, .od2sc-placeholder");
  if (current) current.replaceWith(card);
  else (root.querySelector(".journal-page-content, .editor-content, .journal-entry-content, .window-content") ?? root).prepend(card);
  bindCard(card, entry);
}

function documentFromHtml(html) { const template = document.createElement("template"); template.innerHTML = html.trim(); return template.content.firstElementChild; }
function cardHtml(entry) {
  const turns = value(entry, "turns", {});
  const hours = LAYOUT.map((items, hour) => `<section class="od2sc-hour"><h3>${hour + 1}ª hora</h3><div class="od2sc-turn-row">${items.map(turn => {
    const key = `${hour + 1}-${turn.n}`, passed = turns[key] === "passed";
    return `<div class="od2sc-turn"><select data-od2sc-turn="${key}" ${game.user.isGM ? "" : "disabled"}><option value="" ${passed ? "" : "selected"}>${turn.n}</option><option value="passed" ${passed ? "selected" : ""}>✔</option></select><div class="od2sc-events">${turn.events.map(e => `<span class="od2sc-event od2sc-${e.toLowerCase()}">${e}</span>`).join("")}</div></div>`;
  }).join("")}</div></section>`).join("");
  return `<article class="od2sc-card"><header><h1>Cartão de Controle de Sessão</h1><strong>Old Dragon</strong></header><p class="od2sc-help"><b>Relógio:</b> cada espaço equivale a 1 turno de 10 minutos. E: encontro; D: descanso; T: tocha; L: lanterna.</p><section class="od2sc-hours">${hours}</section><section class="od2sc-notes"><label>Notas públicas<textarea data-od2sc-notes="public" ${game.user.isGM ? "" : "disabled"}>${escapeHtml(value(entry, "public", ""))}</textarea></label>${game.user.isGM ? `<label>Notas privadas do Mestre<textarea data-od2sc-notes="private">${escapeHtml(value(entry, "private", ""))}</textarea></label><div class="od2sc-actions"><button type="button" data-action="save"><i class="fas fa-save"></i> Salvar notas</button><button type="button" data-action="new"><i class="fas fa-plus"></i> Nova carta</button></div>` : ""}</section></article>`;
}

function bindCard(card, entry) {
  card.addEventListener("change", async event => {
    const select = event.target.closest("[data-od2sc-turn]"); if (!select || !game.user.isGM) return;
    const key = select.dataset.od2scTurn;
    const currentTurns = foundry.utils.deepClone(value(entry, "turns", {}));
    const currentAdvanced = seedAdvancedTurns(currentTurns, entry.getFlag(MODULE_ID, KEYS.advanced));
    const update = updateTurnState(currentTurns, currentAdvanced, key, select.value === "passed", "pending");
    if (update.shouldRollback) {
      try {
        await entry.update({ [`flags.${MODULE_ID}.${KEYS.turns}`]: update.turns, [`flags.${MODULE_ID}.${KEYS.advanced}`]: update.advanced });
        const rollback = await game.od2Qdv?.effects?.rollbackTime?.(update.transactionId);
        if (!rollback?.ok) throw new Error(rollback?.reason || "O histórico temporal deste turno não está disponível.");
        ui.notifications.info("Turno desfeito: o relógio e os efeitos foram restaurados.");
      } catch (error) {
        select.value = "passed";
        await entry.update({ [`flags.${MODULE_ID}.${KEYS.turns}`]: currentTurns, [`flags.${MODULE_ID}.${KEYS.advanced}`]: currentAdvanced });
        ui.notifications.error(`Não foi possível desfazer o turno: ${error.message}`);
      }
      return;
    }
    let transaction;
    try {
      await entry.update({ [`flags.${MODULE_ID}.${KEYS.turns}`]: update.turns, [`flags.${MODULE_ID}.${KEYS.advanced}`]: update.advanced });
      if (update.shouldAdvance) {
        if (typeof game.time?.advance !== "function") throw new Error("O relógio do mundo não está disponível.");
        transaction = await game.od2Qdv?.effects?.transactTime?.({ source: "session", reference: `${entry.uuid}:${key}`, label: `Carta de Sessão: turno ${key}` }, async () => {
          await game.time.advance(OD2_TIME.TURN_SECONDS);
        });
        if (!transaction?.id) throw new Error("O Gerenciador de Efeitos não iniciou a transação temporal.");
        update.advanced[key] = transaction.id;
        await entry.update({ [`flags.${MODULE_ID}.${KEYS.advanced}`]: update.advanced });
      }
    } catch (error) {
      if (transaction?.id) await game.od2Qdv?.effects?.rollbackTime?.(transaction.id);
      select.value = update.previous === "passed" ? "passed" : "";
      await entry.update({ [`flags.${MODULE_ID}.${KEYS.turns}`]: currentTurns, [`flags.${MODULE_ID}.${KEYS.advanced}`]: currentAdvanced });
      console.error(`${MODULE_ID} | Falha ao avançar turno da carta`, error);
      ui.notifications.error(`Não foi possível avançar o turno: ${error.message}`);
      return;
    }
    if (update.shouldAdvance) {
      ui.notifications.info("1 turno transcorrido: o relógio avançou 10 minutos.");
      try { await triggerEvents(key); }
      catch (error) {
        console.error(`${MODULE_ID} | Falha nos eventos do turno ${key}`, error);
        ui.notifications.error(`O turno avançou, mas um evento falhou: ${error.message}`);
      }
    }
  });
  card.addEventListener("click", async event => {
    const action = event.target.closest("[data-action]")?.dataset.action; if (!action || !game.user.isGM) return;
    if (action === "new") return createJournal();
    await entry.update({ [`flags.${MODULE_ID}.${KEYS.public}`]: card.querySelector('[data-od2sc-notes="public"]').value, [`flags.${MODULE_ID}.${KEYS.private}`]: card.querySelector('[data-od2sc-notes="private"]').value });
    ui.notifications.info("Notas da carta de controle salvas.");
  });
}

async function triggerEvents(key) {
  const [hour, number] = key.split("-").map(Number), turn = LAYOUT[hour - 1]?.[number - 1];
  for (const event of turn?.events ?? []) {
    if (event === "E") await encounter(hour, number);
    if (event === "D") await publicMessage("Descanso necessário", "O grupo deve descansar. Sem descanso curto, os testes subsequentes são difíceis (-2) até que descansem.");
    if (event === "T") await publicMessage("Tochas queimaram", "As tochas se apagaram ao fim deste turno.");
    if (event === "L") await publicMessage("Lanterna apagou", "A lanterna se apagou ao fim deste turno.");
  }
}
async function encounter(hour, number) {
  const roll = new Roll(game.settings.get(MODULE_ID, "sessionEncounterDie") || "1d6");
  if (Number(game.release?.generation ?? 13) >= 14) await roll.evaluate(); else await roll.roll({ async: true });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ alias: "Carta de Controle" }), whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id), rolls: [roll], content: `<h3>Encontro aleatório</h3><p>Turno ${number} da ${hour}ª hora. Rolagem: <strong>${roll.total}</strong>.</p><p>${roll.total === 1 ? "<strong>Resultado 1: encontro!</strong>" : "Nenhum encontro indicado."}</p>` });
}
async function publicMessage(title, message) { await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ alias: "Carta de Controle" }), content: `<h3>${title}</h3><p>${message}</p>` }); }
