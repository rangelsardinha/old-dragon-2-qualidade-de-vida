import { actorInfravisionMeters, gridVisionRange, prototypeVisionUpdate, tokenVisionUpdate } from "./model.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const ACTOR_TYPES = new Set(["character", "monster", "retainer"]);

function enabled() {
  return game.system.id === "olddragon2e" && game.settings.get(MODULE_ID, "enableAutomatedLighting");
}

function rootOf(html) {
  return html instanceof HTMLElement ? html : html?.[0];
}

function dialogV2() {
  return Number(game.release?.generation ?? 13) >= 14 ? foundry.applications?.api?.DialogV2 : null;
}

async function askSquareSize() {
  const content = '<form><div class="form-group"><label>Tamanho do quadrado em metros</label><input type="number" name="squareMeters" min="0.01" step="0.01" value="1.5"><p class="hint">Exemplo: em um mapa onde cada quadrado representa 1,5 metro, informe 1,5.</p></div></form>';
  const read = (form) => Number(String(form.elements.squareMeters?.value ?? "").replace(",", "."));
  const V2 = dialogV2();
  if (V2) return V2.prompt({
    window: { title: "Corrigir luz dos atores" }, content,
    ok: { label: "Corrigir luz", callback: (_event, button) => read(button.form) }
  });
  return new Promise((resolve) => new Dialog({
    title: "Corrigir luz dos atores", content,
    buttons: {
      ok: { label: "Corrigir luz", callback: (html) => resolve(read(rootOf(html).querySelector("form"))) },
      cancel: { label: "Cancelar", callback: () => resolve(null) }
    },
    default: "ok", close: () => resolve(null)
  }).render(true));
}

export async function correctActorLighting() {
  if (!enabled()) return;
  if (!game.user?.isGM) return ui.notifications.warn("Apenas o Mestre pode corrigir a luz dos atores.");
  const squareMeters = await askSquareSize();
  if (squareMeters == null) return;
  if (!Number.isFinite(squareMeters) || squareMeters <= 0) return ui.notifications.error("Informe um tamanho de quadrado maior que zero.");

  const actors = [...(game.actors ?? [])].filter((actor) => ACTOR_TYPES.has(actor.type));
  const corrected = [];
  const correctedTokens = [];
  const failures = [];
  for (const actor of actors) {
    const meters = actorInfravisionMeters(actor);
    if (!meters) continue;
    const range = gridVisionRange(meters, squareMeters);
    try {
      await actor.update(prototypeVisionUpdate(meters, squareMeters));
      corrected.push({ actor, meters, range });
    } catch (error) {
      console.error(`${MODULE_ID} | Não foi possível corrigir a visão de ${actor.name}`, error);
      failures.push(actor.name);
    }
  }

  for (const token of canvas?.scene?.tokens ?? []) {
    const actor = token.actor;
    const meters = actorInfravisionMeters(actor);
    if (!meters) continue;
    const range = gridVisionRange(meters, squareMeters);
    try {
      await token.update(tokenVisionUpdate(meters, squareMeters));
      correctedTokens.push({ token, actor, meters, range });
    } catch (error) {
      console.error(`${MODULE_ID} | Não foi possível corrigir a visão do token ${token.name}`, error);
      failures.push(`token ${token.name}`);
    }
  }

  if (!corrected.length && !correctedTokens.length && !failures.length) return ui.notifications.warn("Nenhum ator ou token com infravisão foi encontrado.");
  console.info(`${MODULE_ID} | Luz corrigida`, corrected.map(({ actor, meters, range }) => `${actor.name}: ${meters} m = ${range} quadrado(s)`));
  console.info(`${MODULE_ID} | Luz dos tokens corrigida`, correctedTokens.map(({ token, meters, range }) => `${token.name}: ${meters} m = ${range} quadrado(s)`));
  ui.notifications.info(`${corrected.length} protótipo(s) e ${correctedTokens.length} token(s) com infravisão corrigido(s).`);
  if (failures.length) ui.notifications.error(`Não foi possível corrigir: ${failures.join(", ")}.`);
}

function addDirectoryButton(_app, html) {
  if (!enabled() || !game.user?.isGM) return;
  const root = rootOf(html);
  if (!root) return;
  root.querySelector(".od2qdv-automated-lighting")?.remove();
  const directoryHeader = root.querySelector(".directory-header");
  if (!directoryHeader?.parentNode) return;
  const section = document.createElement("header");
  section.classList.add("od2qdv-automated-lighting", "directory-header");
  section.innerHTML = '<div class="header-actions action-buttons flexrow"><button type="button" class="od2qdv-correct-actor-lighting"><i class="fas fa-eye"></i> Corrigir luz dos atores</button></div>';
  directoryHeader.parentNode.insertBefore(section, directoryHeader);
  section.querySelector(".od2qdv-correct-actor-lighting").addEventListener("click", correctActorLighting);
}

Hooks.on("renderActorDirectory", addDirectoryButton);
Hooks.on("renderActorDirectoryV2", addDirectoryButton);

Hooks.once("ready", () => {
  game.od2Qdv ??= {};
  game.od2Qdv.automatedLighting = { correct: correctActorLighting };
});
