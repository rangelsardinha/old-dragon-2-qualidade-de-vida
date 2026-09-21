import assert from "node:assert/strict";
import test from "node:test";

globalThis.Hooks = { on() {}, once() {} };

const { consumeRations, emptyWaterskins } = await import("../scripts/features/rest/index.js");

const MODULE_ID = "old-dragon-2-qualidade-de-vida";

function item({ id, name, quantity, states = [] }) {
  return {
    id,
    name,
    system: { quantity },
    flags: { [MODULE_ID]: { waterskinStates: states, waterskinFull: states.length > 0 && states.every(Boolean) } },
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
