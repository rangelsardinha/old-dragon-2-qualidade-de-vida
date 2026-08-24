import test from "node:test";
import assert from "node:assert/strict";
import {
  activeEffects, advanceDurations, applyHpAction, applyModifiers, conditionalEffectApplies, conditionalMatches, conditionalValueType, effectAssociatedWithItem, effectForCategory, normalizeEffect,
  effectExpired, OD2_TIME, shiftDamageDice, shiftDifficulty
} from "../scripts/features/effect-manager/model.js";

test("normaliza efeitos e descarta modificadores inválidos", () => {
  const effect = normalizeEffect({ name: "Aura", modifiers: [{ key: "ac", mode: "add", value: 2 }, { key: "x", value: 5 }] }, () => "abc");
  assert.equal(effect.id, "abc");
  assert.deepEqual(effect.modifiers, [{ key: "ac", mode: "add", value: "2", resolvedValue: null }]);
});

test("preserva modificador fixo depois de salvar e carregar novamente", () => {
  const saved = normalizeEffect({ name: "Inimigos", modifiers: [{ key: "attack", mode: "add", value: 2 }] });
  const loaded = normalizeEffect(saved);
  assert.equal(loaded.modifiers[0].resolvedValue, null);
  assert.equal(applyModifiers(0, [loaded], "attack"), 2);
});

test("migra o modificador antigo de PV para PV máximos", () => {
  const effect = normalizeEffect({ modifiers: [{ key: "hp", mode: "add", value: 3 }] });
  assert.equal(effect.modifiers[0].key, "hp.max");
});

test("combina modificadores ativos na ordem cadastrada", () => {
  const effects = [
    normalizeEffect({ modifiers: [{ key: "ac", mode: "add", value: 2 }] }),
    normalizeEffect({ modifiers: [{ key: "ac", mode: "multiply", value: 2 }] })
  ];
  assert.equal(applyModifiers(10, effects, "ac"), 24);
});

test("reduz, divide e usa o resultado resolvido de fórmulas", () => {
  const effects = [normalizeEffect({ modifiers: [
    { key: "hp.max", mode: "reduce", value: "1d6", resolvedValue: 4 },
    { key: "hp.max", mode: "divide", value: "2" }
  ] })];
  assert.equal(applyModifiers(20, effects, "hp.max"), 8);
});

test("expira efeitos temporizados e avança rodadas", () => {
  const effect = normalizeEffect({ duration: { type: "rounds", value: 2, remaining: 2 } });
  const once = advanceDurations([effect], { roundChanged: true });
  const twice = advanceDurations(once, { roundChanged: true });
  assert.equal(once[0].duration.remaining, 1);
  assert.equal(activeEffects(twice).length, 0);
  assert.equal(twice[0].enabled, false);
});

test("apaga efeito temporário quando a duração termina", () => {
  const effect = normalizeEffect({ deleteOnExpire: true, duration: { type: "rounds", value: 1, remaining: 1 } });
  assert.equal(advanceDurations([effect], { roundsElapsed: 1 }).length, 0);
  assert.equal(normalizeEffect({ deleteOnExpire: true }).deleteOnExpire, true);
});

test("usa as unidades de tempo oficiais do Old Dragon", () => {
  assert.equal(OD2_TIME.ROUND_SECONDS, 10);
  assert.equal(OD2_TIME.TURN_SECONDS, 600);
  const turn = normalizeEffect({ duration: { type: "turns", value: 2, remaining: 2, expiresAt: 2200 } });
  assert.equal(effectExpired(turn, 2199), false);
  assert.equal(effectExpired(turn, 2200), true);
  assert.equal(advanceDurations([turn], { turnChanged: true })[0].duration.remaining, 2);
  const rounds = normalizeEffect({ duration: { type: "rounds", value: 5, remaining: 5 } });
  assert.equal(advanceDurations([rounds], { roundsElapsed: 2 })[0].duration.remaining, 3);
});

test("compara PV, atributos e condições", () => {
  const snapshot = { values: { "hp.value": 7, "hp.max": 10, forca: 14 }, conditions: ["Envenenado"] };
  assert.equal(conditionalMatches({ left: "hp.value", operator: "lt", right: "hp.max" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "forca", operator: "gte", right: "number", number: 14 }, snapshot), true);
  assert.equal(conditionalMatches({ left: "condition", operator: "has", conditionName: "envenenado" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "condition", operator: "lacks", conditionName: "Caído" }, snapshot), true);
});

test("compara condições de verdadeiro ou falso", () => {
  const snapshot = { values: { "item.armorEquipped": true, "movement.canFly": false, "source.itemEquipped": true } };
  assert.equal(conditionalValueType("item.armorEquipped"), "boolean");
  assert.equal(conditionalMatches({ left: "item.armorEquipped", operator: "eq", right: "boolean.true" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "movement.canFly", operator: "eq", right: "boolean.false" }, snapshot), true);
  assert.equal(conditionalValueType("source.itemEquipped"), "boolean");
  assert.equal(conditionalMatches({ left: "source.itemEquipped", operator: "eq", right: "boolean.true" }, snapshot), true);
});

test("a condição controla a aplicação dos modificadores do efeito", () => {
  const snapshot = { values: { "item.armorEquipped": false } };
  const active = normalizeEffect({ conditional: {
    enabled: true, left: "item.armorEquipped", operator: "eq", right: "boolean.false", resultAction: "applyEffect"
  } });
  const noAction = normalizeEffect({ conditional: {
    enabled: true, left: "item.armorEquipped", operator: "eq", right: "boolean.false", resultAction: "none"
  } });
  assert.equal(conditionalEffectApplies(active, snapshot), true);
  assert.equal(conditionalEffectApplies(noAction, snapshot), false);
});

test("aplica Inimigos quando o alvo é um Ogro", () => {
  const effect = normalizeEffect({
    modifiers: [{ key: "attack", mode: "add", value: 2 }],
    conditional: { enabled: true, left: "target.speciesNamed", operator: "eq", right: "boolean.true", conditionName: "orc|ogro|hobgoblin", resultAction: "applyEffect" }
  });
  assert.equal(conditionalEffectApplies(effect, { values: {}, targetSpecies: ["Ogro"] }), true);
  assert.equal(applyModifiers(0, [effect], "attack"), 2);
});

test("compara arma, tipo de ataque e munição do ataque atual", () => {
  const snapshot = {
    values: {
      "attack.weaponRanged": true,
      "attack.usesBAD": true,
      "attack.usesAmmunition": true,
      "attack.itemMagic": false,
      "attack.ammunitionMagic": true
    },
    attackItems: ["Arco Longo"],
    ammunitionItems: ["Flecha +1"]
  };
  assert.equal(conditionalMatches({ left: "attack.itemNamed", operator: "eq", right: "boolean.true", conditionName: "arco longo" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "attack.ammunitionNamed", operator: "eq", right: "boolean.true", conditionName: "Flecha +1" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "attack.weaponRanged", operator: "eq", right: "boolean.true" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "attack.ammunitionMagic", operator: "eq", right: "boolean.true" }, snapshot), true);
});

test("compara espécie, alinhamento, condição e DV do alvo", () => {
  const snapshot = {
    values: { "target.isMonster": true, "target.selected": true, "target.dv": 6, "target.distance": 9 },
    targetSpecies: ["Orc Guerreiro"],
    targetConcepts: ["Humanoide"],
    targetAlignments: ["Caótico"],
    targetConditions: ["Envenenado"],
    sceneEnvironments: ["Ermos abertos"]
  };
  assert.equal(conditionalMatches({ left: "target.speciesNamed", operator: "eq", right: "boolean.true", conditionName: "orc" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "target.speciesNamed", operator: "eq", right: "boolean.true", conditionName: "ogro|orc|hobgoblin" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "target.conceptNamed", operator: "eq", right: "boolean.true", conditionName: "humanoide" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "target.alignmentNamed", operator: "eq", right: "boolean.true", conditionName: "caotico" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "target.conditionNamed", operator: "eq", right: "boolean.true", conditionName: "Envenenado" }, snapshot), true);
  assert.equal(conditionalMatches({ left: "target.dv", operator: "gte", right: "number", number: 5 }, snapshot), true);
  assert.equal(conditionalMatches({ left: "target.distance", operator: "lte", right: "number", number: 9 }, snapshot), true);
  assert.equal(conditionalMatches({ left: "scene.environmentNamed", operator: "eq", right: "boolean.true", conditionName: "ermos" }, snapshot), true);
});

test("aplica ação de PV sem ultrapassar o máximo", () => {
  assert.equal(applyHpAction(7, 10, { type: "hpAdd", clampMax: true }, 8), 10);
  assert.equal(applyHpAction(7, 10, { type: "hpReduce" }, 9), 0);
});

test("altera níveis de dificuldade e passos do dado de dano", () => {
  assert.equal(shiftDifficulty("hard", 1), "");
  assert.equal(shiftDifficulty("", 2), "very-easy");
  assert.equal(shiftDifficulty("very-easy", 1), "very-easy");
  assert.equal(shiftDamageDice("1d6+2", 1), "1d8+2");
  assert.equal(shiftDamageDice("2d10", -2), "2d6");
});

test("normaliza ações acionadas por eventos", () => {
  const effect = normalizeEffect({ eventAction: { type: "heal", formula: "1d8", target: "target", privateResult: true } });
  assert.deepEqual(effect.eventAction, { type: "heal", formula: "1d8", target: "target", resourceName: "", radius: 0, privateResult: true });
  assert.equal(normalizeEffect({ eventAction: { type: "inexistente" } }).eventAction.type, "none");
});

test("normaliza usos limitados e recuperação no descanso", () => {
  const effect = normalizeEffect({ uses: { max: 3, remaining: 2, resetOnRest: true } });
  assert.deepEqual(effect.uses, { max: 3, remaining: 2, resetOnRest: true });
  assert.deepEqual(normalizeEffect({ uses: { max: 2 } }).uses, { max: 2, remaining: 2, resetOnRest: true });
  assert.deepEqual(
    normalizeEffect({ association: { type: "equipment", id: "item1", name: "Anel", effectId: "efeito1" } }).association,
    { type: "equipment", id: "item1", name: "Anel", effectId: "efeito1" }
  );
});

test("aceita ataques extras como modificador", () => {
  const effect = normalizeEffect({ modifiers: [{ key: "attacks.extra", mode: "add", value: 1 }] });
  assert.equal(applyModifiers(0, [effect], "attacks.extra"), 1);
});

test("adapta um modelo do compêndio para a categoria onde foi solto", () => {
  const template = normalizeEffect({ name: "Bênção", duration: { type: "permanent" }, modifiers: [{ key: "ba", mode: "add", value: 1 }] }, () => "modelo");
  const temporary = effectForCategory(template, "temporary", () => "temporario");
  const passive = effectForCategory({ ...template, duration: { type: "rounds", value: 4, remaining: 4 } }, "passive", () => "passivo");
  const inactive = effectForCategory(template, "inactive", () => "inativo");
  assert.deepEqual({ id: temporary.id, enabled: temporary.enabled, type: temporary.duration.type, remaining: temporary.duration.remaining }, { id: "temporario", enabled: true, type: "rounds", remaining: 1 });
  assert.deepEqual({ id: passive.id, enabled: passive.enabled, type: passive.duration.type }, { id: "passivo", enabled: true, type: "permanent" });
  assert.deepEqual({ id: inactive.id, enabled: inactive.enabled }, { id: "inativo", enabled: false });
});

test("reconhece efeitos associados a classe, raça ou habilidade dependente", () => {
  const academic = { id: "classe1", type: "class", name: "Acadêmico" };
  assert.equal(effectAssociatedWithItem({ origin: "Acadêmico" }, academic), true);
  assert.equal(effectAssociatedWithItem({ origin: "Conhecimento Acadêmico" }, academic, ["Conhecimento Acadêmico"]), true);
  assert.equal(effectAssociatedWithItem({ origin: "Manual" }, academic, ["Conhecimento Acadêmico"]), false);
  assert.equal(effectAssociatedWithItem({ association: { type: "class", id: "classe1", name: "Outra" } }, academic), true);
  assert.equal(effectAssociatedWithItem({ association: { type: "race", name: "Anão" } }, academic), false);
});
