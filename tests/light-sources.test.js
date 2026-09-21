import assert from "node:assert/strict";
import test from "node:test";

import { OD2_LIGHT_SOURCE_COMPATIBILITY, OD2_LIGHT_SOURCES, upgradedItemTypes } from "../scripts/features/light-sources/model.js";

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
