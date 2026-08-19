import test from "node:test";
import assert from "node:assert/strict";
import {
  allocationFromDice, attributeModifier, calculateHitPoints,
  classAllowsRace, experienceForLevel, hitDieForClass, hitPointBonusForClass, jpcBonusForClass, racialAttributes
} from "../scripts/features/character-generator/model.js";

test("usa a tabela oficial de modificadores de atributos", () => {
  assert.deepEqual([1, 3, 5, 8, 12, 14, 16, 18, 19].map(attributeModifier), [-4, -3, -2, -1, 0, 1, 2, 3, 4]);
});

test("mapeia atributos fortes e fracos raciais", () => {
  assert.deepEqual(racialAttributes("Anão"), { strong: "constituicao", weak: "carisma" });
  assert.deepEqual(racialAttributes("Elfo"), { strong: "destreza", weak: "constituicao" });
  assert.equal(racialAttributes("Meio-Elfo"), null);
});

test("respeita restrições raciais das classes", () => {
  const restricted = { system: { restrictions: { races: ["Elfo"] } } };
  assert.equal(classAllowsRace(restricted, "Elfo"), true);
  assert.equal(classAllowsRace(restricted, "Anão"), false);
  assert.equal(classAllowsRace({ system: { restrictions: { races: [] } } }, "Anão"), true);
});

test("obtém XP mínimo do nível na tabela da classe", () => {
  const characterClass = { system: { levels: { 2: { xp: 2000 }, 3: { xp: 4000 } } } };
  assert.equal(experienceForLevel(characterClass, 1), 0);
  assert.equal(experienceForLevel(characterClass, 3), 4000);
});

test("calcula PV máximo no primeiro nível e rolagens nos demais", () => {
  assert.equal(calculateHitPoints(8, 3, 14, [4, 7]), 22);
  assert.equal(calculateHitPoints(4, 2, 3, [1]), 2);
});

test("resolve o dado de vida pelo nome da classe quando o compêndio não informa", () => {
  assert.equal(hitDieForClass({ name: "Guerreiro", system: {} }), 10);
  assert.equal(hitDieForClass({ name: "Clérigo", system: {} }), 8);
  assert.equal(hitDieForClass({ name: "Halfling Aventureiro", system: {} }), 6);
  assert.equal(hitDieForClass({ name: "Mago", system: { hp: 6 } }), 4);
  assert.equal(hitDieForClass({ name: "Bardo Athasiano", system: {} }), 6);
  assert.equal(hitDieForClass({ name: "Clérigo Elemental", system: {} }), 8);
  assert.equal(hitDieForClass({ name: "Gladiador", system: {} }), 12);
  assert.equal(hitDieForClass({ name: "Preservador", system: {} }), 4);
  assert.equal(hitDieForClass({ name: "Profanador", system: {} }), 4);
  assert.equal(hitDieForClass({ name: "Psiônico", system: {} }), 4);
  assert.equal(hitDieForClass({ name: "Templário", system: {} }), 8);
});

test("aplica o bônus de +2 PV por nível do Bárbaro", () => {
  const barbarian = { name: "Bárbaro", system: {} };
  assert.equal(hitPointBonusForClass(barbarian), 2);
  assert.equal(calculateHitPoints(10, 3, 13, [5, 7], hitPointBonusForClass(barbarian)), 31);
  assert.equal(hitPointBonusForClass({ name: "Guerreiro", system: {} }), 0);
  assert.equal(jpcBonusForClass(barbarian), 2);
  assert.equal(jpcBonusForClass({ name: "Guerreiro", system: {} }), 0);
});

test("distribui sete dados sobre atributos com base oito", () => {
  const values = allocationFromDice([1, 2, 3, 4, 5, 6, 1], ["forca", "forca", "destreza", "constituicao", "inteligencia", "sabedoria", "carisma"]);
  assert.deepEqual(values, { forca: 11, destreza: 11, constituicao: 12, inteligencia: 13, sabedoria: 14, carisma: 9 });
});
