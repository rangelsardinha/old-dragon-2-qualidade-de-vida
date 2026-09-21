import assert from "node:assert/strict";
import test from "node:test";

import { deleteInventoryItem, inventoryActor, inventoryItem, updateInventoryItem } from "../scripts/utils/actor-inventory.js";

function collection(items) {
  items.get = (id) => items.find((item) => item.id === id);
  return items;
}

function actor(id, items, { tokenActorId = null } = {}) {
  const value = {
    id,
    items: collection(items),
    token: tokenActorId ? { actorId: tokenActorId } : null,
    async updateEmbeddedDocuments(_type, updates) {
      return updates.map((update) => {
        const current = this.items.get(update._id);
        for (const [path, next] of Object.entries(update)) {
          if (path === "_id") continue;
          const parts = path.split(".");
          let target = current;
          for (const part of parts.slice(0, -1)) target = target[part] ??= {};
          target[parts.at(-1)] = next;
        }
        return current;
      });
    },
    async deleteEmbeddedDocuments(_type, ids) {
      const removed = this.items.filter((item) => ids.includes(item.id));
      for (const item of removed) this.items.splice(this.items.indexOf(item), 1);
      return removed;
    }
  };
  for (const item of items) item.parent = value;
  return value;
}

test("consumo iniciado em token persiste primeiro no inventário do ator", async () => {
  const storedArrow = { id: "arrow", name: "Flecha", type: "weapon", system: { type: "ammunition", quantity: 8 } };
  const tokenArrow = { id: "arrow", name: "Flecha", type: "weapon", system: { type: "ammunition", quantity: 8 } };
  const storedActor = actor("hero", [storedArrow]);
  const tokenActor = actor("synthetic", [tokenArrow], { tokenActorId: "hero" });
  globalThis.game = { actors: new Map([["hero", storedActor]]) };

  assert.equal(inventoryActor(tokenActor), storedActor);
  assert.equal(inventoryItem(tokenActor, tokenArrow), storedArrow);
  await updateInventoryItem(tokenActor, tokenArrow, { "system.quantity": 7 });
  assert.equal(storedArrow.system.quantity, 7);
  assert.equal(tokenArrow.system.quantity, 7);
});

test("remoção iniciada em token apaga o item do ator e do token", async () => {
  const storedRation = { id: "ration", name: "Ração", type: "misc", system: { quantity: 1 } };
  const tokenRation = { id: "ration", name: "Ração", type: "misc", system: { quantity: 1 } };
  const storedActor = actor("hero", [storedRation]);
  const tokenActor = actor("synthetic", [tokenRation], { tokenActorId: "hero" });
  globalThis.game = { actors: new Map([["hero", storedActor]]) };

  assert.equal(await deleteInventoryItem(tokenActor, tokenRation), true);
  assert.equal(storedActor.items.length, 0);
  assert.equal(tokenActor.items.length, 0);
});
