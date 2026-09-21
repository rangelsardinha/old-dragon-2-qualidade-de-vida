import assert from "node:assert/strict";
import test from "node:test";

import {
  expiresWithSessionEvent,
  inventoryResourceKind,
  isFlintItem,
  isPortableLampItem,
  lightResourceKind,
  OD2_LIGHT_SOURCE_COMPATIBILITY,
  OD2_LIGHT_SOURCES,
  quantityAfterConsumption,
  portableLampName,
  upgradedItemTypes
} from "../scripts/features/light-sources/model.js";

test("configura o Light Sources para itens gerais do Old Dragon 2", () => {
  assert.deepEqual(OD2_LIGHT_SOURCE_COMPATIBILITY, {
    itemTypes: ["misc", "spell"],
    actorTypes: [],
    quantityPath: ""
  });
});

test("preserva as seis fontes configuradas no mundo teste", () => {
  assert.deepEqual(
    OD2_LIGHT_SOURCES.map(({ uuid, patterns }) => ({
      uuid,
      light: patterns[0].light
    })),
    [
      {
        uuid: "Compendium.olddragon2e.equipment.Item.TXUSIkFDzA0Y5u5T",
        light: { dim: 6, bright: 12, negative: false, angle: 360, color: "#ff8800", alpha: 0.4, animation: { type: "torch", speed: 5, intensity: 5, reverse: false } }
      },
      {
        uuid: "Compendium.olddragon2e.equipment.Item.5RwY59f3nG4xKQZ3",
        light: { dim: 12, bright: 24, negative: false, angle: 60, color: "#ff8800", alpha: 0.45, animation: { type: "torch", speed: 5, intensity: 1, reverse: false } }
      },
      {
        uuid: "Compendium.olddragon2e.equipment.Item.W0jMlPQ594L2tMfd",
        light: { dim: 1, bright: 2, negative: false, angle: 360, color: "#ff8800", alpha: 0.4, animation: { type: "flame", speed: 5, intensity: 5, reverse: false } }
      },
      {
        uuid: "Compendium.olddragon2e.equipment.Item.D20RuafQR6u26MF1",
        light: { dim: 6, bright: 12, negative: false, angle: 330, color: "#ff8800", alpha: 0.4, animation: { type: "flame", speed: 5, intensity: 5, reverse: false } }
      },
      {
        uuid: "Compendium.olddragon2e.spells.Item.R8L5MhdnzRM5k3BR",
        light: { dim: 4, bright: 8, negative: false, angle: 360, color: "#ff8800", alpha: 0.4, animation: { type: "flame", speed: 5, intensity: 5, reverse: false } }
      },
      {
        uuid: "Compendium.olddragon2e.spells.Item.MJEu3lz6sXtfEiDz",
        light: { dim: 4, bright: 8, negative: false, angle: 360, color: "#ff8800", alpha: 0.4, animation: { type: "flame", speed: 5, intensity: 5, reverse: false } }
      }
    ]
  );
  assert.ok(OD2_LIGHT_SOURCES.every((entry) => entry.consume === false && entry.durationMinutes === 0));
});

test("migra apenas o padrão antigo de tipos de item", () => {
  assert.deepEqual(upgradedItemTypes(["misc"], 0), ["misc", "spell"]);
  assert.deepEqual(upgradedItemTypes(["misc", "weapon"], 0), ["misc", "weapon"]);
  assert.deepEqual(upgradedItemTypes(["misc"], 2), ["misc"]);
});

test("identifica os recursos consumidos pelas fontes físicas", () => {
  assert.equal(lightResourceKind("Tocha"), "torch");
  assert.equal(lightResourceKind("Vela"), "candle");
  assert.equal(lightResourceKind("Lamparina"), "oil");
  assert.equal(lightResourceKind("Lanterna furta-fogo"), "oil");
  assert.equal(lightResourceKind("Luz Contínua"), null);
  assert.equal(inventoryResourceKind({ name: "Óleo", system: { odo_id: "oleo" } }), "oil");
  assert.equal(inventoryResourceKind({ name: "Tocha", system: { odo_id: "tocha" } }), "torch");
  assert.equal(inventoryResourceKind({ name: "Vela", system: { odo_id: "vela" } }), "candle");
});

test("reduz pilhas e remove a última unidade do recurso", () => {
  assert.deepEqual(quantityAfterConsumption(4), { delete: false, quantity: 3 });
  assert.deepEqual(quantityAfterConsumption(1), { delete: true, quantity: 0 });
  assert.deepEqual(quantityAfterConsumption(null), { delete: true, quantity: 0 });
});

test("eventos da carta apagam somente a fonte correspondente", () => {
  assert.equal(expiresWithSessionEvent("Tocha", "torch"), true);
  assert.equal(expiresWithSessionEvent("Vela", "torch"), true);
  assert.equal(expiresWithSessionEvent("Lamparina", "torch"), false);
  assert.equal(expiresWithSessionEvent("Lamparina", "lamp"), true);
  assert.equal(expiresWithSessionEvent("Lanterna furta-fogo", "lamp"), true);
  assert.equal(expiresWithSessionEvent("Luz", "lamp"), false);
});

test("reconhece lamparinas e lanternas como itens transferíveis", () => {
  assert.equal(portableLampName("Lamparina"), "lamparina");
  assert.equal(portableLampName("Lanterna furta-fogo"), "lanterna furta-fogo");
  assert.equal(portableLampName("Tocha"), null);
  assert.equal(isPortableLampItem({ name: "Lamparina", system: { odo_id: "lamparina" } }, "Lamparina"), true);
  assert.equal(isPortableLampItem({ name: "Lanterna furta-fogo", system: { odo_id: "lanterna-furta-fogo" } }, "Lanterna furta-fogo"), true);
  assert.equal(isPortableLampItem({ name: "Óleo", system: { odo_id: "oleo" } }, "Lamparina"), false);
});

test("reconhece uma pederneira disponível no inventário", () => {
  assert.equal(isFlintItem({ name: "Pederneira", system: { odo_id: "pederneira", quantity: 1 } }), true);
  assert.equal(isFlintItem({ name: "Pederneira", system: { odo_id: "pederneira", quantity: 0 } }), false);
  assert.equal(isFlintItem({ name: "Óleo", system: { odo_id: "oleo", quantity: 2 } }), false);
});
