const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const VALUES = ["good", "neutral", "evil"];
const LABELS = { good: "Bom", neutral: "Neutro", evil: "Mal" };
function enabled() { try { return game.settings.get(MODULE_ID, "enableAlignmentAxis"); } catch { return false; } }
function renderAxis(app, html) {
  if (!enabled()) return;
  const root = html?.[0] ?? html, actor = app?.actor ?? app?.object ?? app?.document;
  if (!root || !actor || root.querySelector(".od2qdv-alignment-axis")) return;
  const alignment = root.querySelector('[name="system.alignment"], [name="system.details.alignment"], select[name*="alignment"]');
  if (!alignment) return;
  const wrapper = document.createElement("div"); wrapper.className = "form-group od2qdv-alignment-axis";
  wrapper.innerHTML = `<select aria-label="Eixo moral"><option value="good">Bom</option><option value="neutral">Neutro</option><option value="evil">Mal</option></select><label>Eixo moral</label>`;
  const parent = alignment.closest(".form-group, .form-field, .field") || alignment.parentElement; parent?.after(wrapper);
  const select = wrapper.querySelector("select"); select.value = actor.getFlag(MODULE_ID, "moralAlignment") || "neutral";
  select.addEventListener("change", () => actor.isOwner && actor.setFlag(MODULE_ID, "moralAlignment", VALUES.includes(select.value) ? select.value : "neutral"));
}
for (const hook of ["renderActorSheet", "renderActorSheetV2", "renderOD2CharacterSheet", "renderOD2MonsterSheet", "renderOD2RetainerSheet"]) Hooks.on(hook, renderAxis);
Hooks.once("ready", async () => { if (!enabled() || !game.user?.isGM) return; for (const actor of game.actors ?? []) if (!actor.getFlag(MODULE_ID, "moralAlignment")) await actor.setFlag(MODULE_ID, "moralAlignment", "neutral"); });
