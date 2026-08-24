import test from "node:test";
import assert from "node:assert/strict";
import { academicAbilityKey, academicAbilityScore, academicRollSucceeded, dwarfAdventurerHitDieForLevel, isAcademicClassName, isDwarfAdventurerName, isDwarfName } from "../scripts/features/academic-abilities/model.js";

test("reconhece a classe e as habilidades do Acadêmico ignorando acentos", () => {
  assert.equal(isAcademicClassName("Acadêmico"), true);
  assert.equal(isAcademicClassName("Mago"), false);
  assert.equal(academicAbilityKey("Conhecimento Acadêmico"), "academicKnowledge");
  assert.equal(academicAbilityKey("Lendas e Tradições"), "legendsAndTraditions");
});
test("aplica a progressão de Conhecimento Acadêmico", () => {
  assert.deepEqual([1, 2, 3, 5, 6, 15].map((level) => academicAbilityScore("academicKnowledge", level)), [2, 2, 3, 3, 4, 4]);
});
test("aplica a progressão de Decifrar Linguagens", () => {
  assert.deepEqual([1, 5, 6, 15].map((level) => academicAbilityScore("decipherLanguages", level)), [3, 3, 4, 4]);
});
test("mantém os valores fixos de Lendas e Identificar Itens", () => {
  assert.equal(academicAbilityScore("legendsAndTraditions", 15), 4);
  assert.equal(academicAbilityScore("identifyItems", 15), 2);
});
test("aplica a progressão de Reputação", () => {
  assert.deepEqual([1, 11, 12, 13, 14, 15].map((level) => academicAbilityScore("reputation", level)), [2, 2, 3, 3, 4, 5]);
});
test("considera sucesso quando o d6 fica dentro da faixa", () => {
  assert.equal(academicRollSucceeded(3, 3), true);
  assert.equal(academicRollSucceeded(4, 3), false);
});

test("reconhece as habilidades de anão e Anão Aventureiro", () => {
  assert.equal(isDwarfName("Anão"), true);
  assert.equal(isDwarfAdventurerName("Anão Aventureiro"), true);
  assert.equal(academicAbilityKey("Mineradores"), "miners");
  assert.equal(academicAbilityScore("miners", 15), 2);
  assert.equal(dwarfAdventurerHitDieForLevel(2), 10);
  assert.equal(dwarfAdventurerHitDieForLevel(3), 12);
});
