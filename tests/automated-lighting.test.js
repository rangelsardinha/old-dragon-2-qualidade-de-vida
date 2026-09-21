import assert from "node:assert/strict";
import test from "node:test";

import { actorInfravisionMeters, gridVisionRange, infravisionFromText, prototypeVisionUpdate } from "../scripts/features/automated-lighting/model.js";

test("lê infravisão registrada na raça do personagem ou ajudante", () => {
  const race = { type: "race", system: { infravision: 18 } };
  assert.equal(actorInfravisionMeters({ system: { race }, items: [race] }), 18);
  assert.equal(actorInfravisionMeters({ system: {}, items: [race] }), 18);
});

test("lê infravisão na descrição de monstros e mercenários", () => {
  assert.equal(infravisionFromText("<p><strong>Infravisão</strong>: 30 metros.</p>"), 30);
  assert.equal(infravisionFromText("Infravisão de até 18 metros."), 18);
  assert.equal(actorInfravisionMeters({ system: { description: "<li>Infravisão: 20 metros</li>" }, items: [] }), 20);
});

test("converte metros de infravisão em unidades de grade", () => {
  assert.equal(gridVisionRange(18, 1.5), 12);
  assert.equal(gridVisionRange(20, 1.5), 13.33);
  assert.equal(gridVisionRange(18, 0), 0);
  assert.deepEqual(prototypeVisionUpdate(18, 1.5), {
    "prototypeToken.sight.enabled": true,
    "prototypeToken.sight.range": 12,
    "prototypeToken.sight.visionMode": "darkvision"
  });
});
