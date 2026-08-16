import test from "node:test";
import assert from "node:assert/strict";
import { actorOwnerNames, addCoins, canReceiveContainer, canStoreItem, carriedLoad, descendantIds, normalizeCoins, subtractCoins, wouldCreateCycle } from "../scripts/features/equipment-containers/model.js";

const items = [
  { id: "bag", parent: null },
  { id: "box", parent: "bag" },
  { id: "torch", parent: "box" },
  { id: "rope", parent: "bag" }
];
const getParent = (item) => item.parent;

test("percorre toda a árvore do recipiente", () => {
  assert.deepEqual(descendantIds(items, "bag", getParent), ["box", "rope", "torch"]);
});

test("impede ciclos de aninhamento", () => {
  assert.equal(wouldCreateCycle(items, "bag", "box", getParent), true);
  assert.equal(wouldCreateCycle(items, "box", "bag", getParent), false);
});

test("normaliza e movimenta moedas sem valores negativos", () => {
  assert.deepEqual(normalizeCoins({ gp: "5", sp: -2 }), { cp: 0, sp: 0, gp: 5 });
  assert.deepEqual(addCoins({ gp: 4 }, { gp: 3, cp: 2 }), { cp: 2, sp: 0, gp: 7 });
  assert.deepEqual(subtractCoins({ gp: 4 }, { gp: 9 }), { cp: 0, sp: 0, gp: 0 });
});

test("totaliza carga dos equipamentos, quantidades e moedas", () => {
  const equipment = [
    { system: { total_weight: 2 } },
    { system: { quantity: 3, weight_in_load: 1, weight_in_grams: 0 } },
    { system: { quantity: 2, weight_in_load: 0, weight_in_grams: 250 } }
  ];
  assert.equal(carriedLoad(equipment, { gp: 50, sp: 25, cp: 25 }), 6);
});

test("não permite guardar equipamentos que estejam equipados", () => {
  assert.equal(canStoreItem({ system: { is_equipped: true } }), false);
  assert.equal(canStoreItem({ system: { is_equipped: false } }), true);
  assert.equal(canStoreItem({ system: {} }), true);
});

test("permite transferir recipientes para personagens e ajudantes", () => {
  assert.equal(canReceiveContainer({ type: "character" }), true);
  assert.equal(canReceiveContainer({ type: "retainer" }), true);
  assert.equal(canReceiveContainer({ type: "monster" }), true);
  assert.equal(canReceiveContainer({ type: "vehicle" }), false);
});

test("lista os usuários proprietários do ator sem incluir Mestres", () => {
  const actor = { id: "actor-1", ownership: { player2: 3, gm: 3 } };
  const users = [
    { id: "player1", name: "Ana", isGM: false, character: { id: "actor-1" } },
    { id: "player2", name: "Bruno", isGM: false },
    { id: "gm", name: "Mestre", isGM: true }
  ];
  assert.deepEqual(actorOwnerNames(actor, users), ["Ana", "Bruno"]);
});
