import assert from "node:assert/strict";
import test from "node:test";

globalThis.Hooks = { on() {}, once() {}, callAll() {} };
globalThis.game = { od2Qdv: {} };

const { consumeRations, emptyWaterskins, recoverActor } = await import("../scripts/features/rest/index.js");

const MODULE_ID = "old-dragon-2-qualidade-de-vida";

function item({ id, name, quantity, states = [], type = "misc", flags = {} }) {
  return {
    id,
    name,
    type,
    system: { quantity },
    flags: { [MODULE_ID]: { waterskinStates: states, waterskinFull: states.length > 0 && states.every(Boolean) }, ...flags },
    getFlag(namespace, key) { return this.flags?.[namespace]?.[key]; }
  };
}

function actorWithItems(items) {
  items.get = (id) => items.find((entry) => entry.id === id);
  return {
    items,
    async updateEmbeddedDocuments(_type, updates) {
      return updates.map((update) => {
        const current = items.get(update._id);
        for (const [path, value] of Object.entries(update)) {
          if (path === "_id") continue;
          const parts = path.split(".");
          let target = current;
          for (const part of parts.slice(0, -1)) target = target[part] ??= {};
          target[parts.at(-1)] = value;
        }
        return current;
      });
    },
    async deleteEmbeddedDocuments(_type, ids) {
      const deleted = items.filter((entry) => ids.includes(entry.id));
      for (const entry of deleted) items.splice(items.indexOf(entry), 1);
      return deleted;
    }
  };
}

test("persiste odres esvaziados pelo ator", async () => {
  const waterskin = item({ id: "water", name: "Odre", quantity: 4, states: [true, true, true, true] });
  const actor = actorWithItems([waterskin]);

  assert.equal(await emptyWaterskins(actor, 2), 2);
  assert.deepEqual(waterskin.flags[MODULE_ID].waterskinStates, [false, false, true, true]);
  assert.equal(waterskin.flags[MODULE_ID].waterskinFull, false);
});

test("persiste a quantidade consumida e remove a pilha vazia de racoes", async () => {
  const ration = item({ id: "food", name: "Ração de viagem", quantity: 5 });
  const actor = actorWithItems([ration]);

  assert.equal(await consumeRations(actor, 1), 1);
  assert.equal(ration.system.quantity, 4);
  assert.equal(await consumeRations(actor, 4), 4);
  assert.equal(actor.items.length, 0);
});

test("desmarca usos consumidos de magias e habilidades no descanso", async () => {
  const spell = item({
    id: "spell", name: "Mísseis Mágicos", type: "spell",
    flags: { olddragon2e: { spell: { "daily-uses": { 0: true, 1: false, 2: true } } } }
  });
  const ability = item({
    id: "ability", name: "Ler Magias", type: "class_ability",
    flags: { olddragon2e: { "daily-uses": { 0: true, 1: true, 2: false } } }
  });
  const unused = item({
    id: "unused", name: "Detectar Magias", type: "class_ability",
    flags: { olddragon2e: { "daily-uses": { 0: false } } }
  });
  const actor = actorWithItems([spell, ability, unused]);

  assert.deepEqual(await recoverActor(actor), { spells: 1, abilities: 1 });
  assert.deepEqual(spell.flags.olddragon2e.spell["daily-uses"], { 0: false, 1: false, 2: false });
  assert.deepEqual(ability.flags.olddragon2e["daily-uses"], { 0: false, 1: false, 2: false });
  assert.deepEqual(unused.flags.olddragon2e["daily-uses"], { 0: false });
});
