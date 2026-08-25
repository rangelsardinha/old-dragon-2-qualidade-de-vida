export const EFFECT_KEYS = Object.freeze({
  forca: "Força", destreza: "Destreza", constituicao: "Constituição",
  inteligencia: "Inteligência", sabedoria: "Sabedoria", carisma: "Carisma",
  ac: "Classe de Armadura",
  ba: "Base de Ataque",
  bac: "Base de Ataque Corpo a Corpo",
  bad: "Base de Ataque à Distância",
  jpd: "Jogada de Proteção de Destreza",
  jpc: "Jogada de Proteção de Constituição",
  jps: "Jogada de Proteção de Sabedoria",
  attack: "Ataques",
  damage: "Dano",
  "damage.strength": "Bônus de Força no dano",
  "rogue.stealth": "Furtividade de Ladrão",
  immunity: "Imunidade",
  "incoming.attack": "Ataque realizado contra este ator",
  "test.difficulty": "Níveis de facilidade do teste",
  "damage.dieStep": "Passos do dado de dano",
  "attacks.extra": "Ataques extras",
  "hp.max": "Pontos de Vida máximos",
  "movement.normal": "Movimento normal", "movement.run": "Movimento de corrida",
  "movement.climb": "Movimento de escalada", "movement.swim": "Movimento de natação", "movement.fly": "Movimento de voo",
  "load.max": "Carga máxima", reputation: "Reputação",
  "monster.ac": "CA do monstro", "monster.jp": "JP do monstro", "monster.morale": "Moral do monstro",
  "monster.dvBonus": "Bônus de Dados de Vida do monstro"
});

export const EFFECT_MODES = Object.freeze({
  add: "Somar", reduce: "Reduzir", multiply: "Multiplicar", divide: "Dividir", override: "Substituir"
});
export const DURATION_TYPES = Object.freeze({
  permanent: "Permanente",
  rounds: "Rodadas (10 segundos)",
  turns: "Turnos (10 minutos)",
  minutes: "Minutos",
  hours: "Horas",
  rest: "Até o próximo descanso"
});

export const CONDITIONAL_TRIGGERS = Object.freeze({
  manual: "Manualmente", enable: "Quando este efeito for ativado",
  attack: "Quando realizar um ataque", damage: "Quando causar dano", natural20: "Quando obtiver 20 natural",
  spell: "Quando conjurar uma magia", rest: "Quando concluir um descanso", levelUp: "Quando subir de nível",
  hpChange: "Quando os PV mudarem", attributeChange: "Quando um atributo mudar",
  conditionChange: "Quando uma condição ou efeito mudar",
  turnStart: "No início da vez do combatente", roundStart: "No início da rodada"
});
export const OD2_TIME = Object.freeze({ ROUND_SECONDS: 10, TURN_SECONDS: 600 });
export const CONDITIONAL_FLOWS = Object.freeze({ if: "Se", while: "Enquanto" });
export const CONDITIONAL_VALUE_DEFINITIONS = Object.freeze([
  ["hp.value", "PV atuais", "Pontos de vida", "all"], ["hp.max", "PV máximos", "Pontos de vida", "all"],
  ["hp.lost", "PV perdidos", "Pontos de vida", "all"], ["hp.percent", "Percentual de PV", "Pontos de vida", "all"],
  ["hp.isFull", "Está com PV máximo", "Pontos de vida", "all"], ["hp.isWounded", "Está ferido", "Pontos de vida", "all"],
  ["hp.isHalf", "Está com metade dos PV ou menos", "Pontos de vida", "all"], ["hp.isZero", "Está com zero PV", "Pontos de vida", "all"],
  ["level", "Nível", "Progressão", "character,retainer"], ["xp.current", "Experiência atual", "Progressão", "character"],
  ["xp.next", "Experiência para o próximo nível", "Progressão", "character"], ["reputation", "Reputação", "Progressão", "character"],
  ["forca", "Força", "Atributos", "character,retainer"], ["mod_forca", "Modificador de Força", "Atributos", "character,retainer"],
  ["destreza", "Destreza", "Atributos", "character,retainer"], ["mod_destreza", "Modificador de Destreza", "Atributos", "character,retainer"],
  ["constituicao", "Constituição", "Atributos", "character,retainer"], ["mod_constituicao", "Modificador de Constituição", "Atributos", "character,retainer"],
  ["inteligencia", "Inteligência", "Atributos", "character,retainer"], ["mod_inteligencia", "Modificador de Inteligência", "Atributos", "character,retainer"],
  ["sabedoria", "Sabedoria", "Atributos", "character,retainer"], ["mod_sabedoria", "Modificador de Sabedoria", "Atributos", "character,retainer"],
  ["carisma", "Carisma", "Atributos", "character,retainer"], ["mod_carisma", "Modificador de Carisma", "Atributos", "character,retainer"],
  ["attribute.highest", "Maior atributo", "Atributos", "character,retainer"], ["attribute.lowest", "Menor atributo", "Atributos", "character,retainer"],
  ["ac.base", "CA base", "Combate", "character,retainer"], ["ac.armor", "Bônus da armadura", "Combate", "character,retainer"],
  ["ac.shield", "Bônus do escudo", "Combate", "character,retainer"], ["ac.extra", "Bônus adicional de CA", "Combate", "character,retainer"],
  ["ac", "Classe de Armadura total", "Combate", "all"], ["ba", "Base de Ataque", "Combate", "character,retainer"],
  ["bac", "BAC", "Combate", "character,retainer"], ["bad", "BAD", "Combate", "character,retainer"],
  ["combat.active", "Está em combate", "Combate", "all"], ["combat.turn", "É o turno do ator", "Combate", "all"],
  ["combat.round", "Rodada atual", "Combate", "all"], ["targets.count", "Quantidade de alvos", "Combate", "all"],
  ["jp.base", "JP base", "Jogadas de proteção", "character"], ["jpd", "JPD total", "Jogadas de proteção", "character,retainer"],
  ["jpc", "JPC total", "Jogadas de proteção", "character,retainer"], ["jps", "JPS total", "Jogadas de proteção", "character,retainer"],
  ["movement.normal", "Movimento normal", "Movimento", "all"], ["movement.run", "Movimento de corrida", "Movimento", "all"],
  ["movement.climb", "Movimento de escalada", "Movimento", "all"], ["movement.swim", "Movimento de natação", "Movimento", "all"],
  ["movement.fly", "Movimento de voo", "Movimento", "all"], ["movement.canFly", "Pode voar", "Movimento", "all"],
  ["movement.canSwim", "Pode nadar", "Movimento", "all"],
  ["coins.gp", "Peças de ouro", "Economia", "all"], ["coins.sp", "Peças de prata", "Economia", "all"],
  ["coins.cp", "Peças de cobre", "Economia", "all"], ["coins.total", "Total de moedas", "Economia", "all"],
  ["load.current", "Carga atual", "Carga", "character,retainer,monster"], ["load.max", "Carga máxima", "Carga", "character,retainer"],
  ["load.available", "Carga disponível", "Carga", "character,retainer"], ["load.percent", "Percentual da carga utilizada", "Carga", "character,retainer"],
  ["load.over", "Está sobrecarregado", "Carga", "character,retainer"],
  ["item.named", "Possui item pelo nome", "Equipamentos", "all"], ["item.count", "Quantidade do item informado", "Equipamentos", "all"],
  ["item.weapon", "Possui arma", "Equipamentos", "all"], ["item.weaponEquipped", "Possui arma equipada", "Equipamentos", "character,retainer"],
  ["item.armorEquipped", "Possui armadura equipada", "Equipamentos", "character,retainer"], ["item.shieldEquipped", "Possui escudo equipado", "Equipamentos", "character,retainer"],
  ["item.ammunitionEquipped", "Possui munição equipada", "Equipamentos", "character,retainer"], ["item.container", "Possui recipiente", "Equipamentos", "all"],
  ["item.magic", "Possui item mágico", "Equipamentos", "all"],
  ["source.itemEquipped", "Item associado está equipado", "Equipamentos", "all"],
  ["attack.itemNamed", "Ataque usa a arma/item informado", "Ataque atual", "all"],
  ["attack.weaponMelee", "Ataque com arma corpo a corpo", "Ataque atual", "all"],
  ["attack.weaponRanged", "Ataque com arma à distância", "Ataque atual", "all"],
  ["attack.weaponThrowing", "Ataque com arma de arremesso", "Ataque atual", "all"],
  ["attack.throwingBad", "Arma de arremesso usando BAD", "Ataque atual", "all"],
  ["attack.usesBAC", "Ataque usa BAC", "Ataque atual", "all"], ["attack.usesBAD", "Ataque usa BAD", "Ataque atual", "all"],
  ["attack.usesAmmunition", "Ataque utiliza munição", "Ataque atual", "all"],
  ["attack.ammunitionNamed", "Ataque utiliza a munição informada", "Ataque atual", "all"],
  ["attack.itemMagic", "Arma/item do ataque é mágico", "Ataque atual", "all"],
  ["attack.ammunitionMagic", "Munição utilizada é mágica", "Ataque atual", "all"],
  ["target.speciesNamed", "Alvo é da espécie ou raça informada", "Alvo atual", "all"],
  ["target.size", "Tamanho do alvo", "Alvo atual", "all"],
  ["target.conceptNamed", "Alvo possui o conceito informado", "Alvo atual", "all"],
  ["target.alignmentNamed", "Alvo possui o alinhamento informado", "Alvo atual", "all"],
  ["target.conditionNamed", "Alvo possui a condição ou efeito informado", "Alvo atual", "all"],
  ["target.isMonster", "Alvo é um monstro", "Alvo atual", "all"],
  ["target.dv", "Dados de Vida do alvo", "Alvo atual", "all"],
  ["target.selected", "Existe alvo selecionado", "Alvo atual", "all"],
  ["target.distance", "Distância até o alvo", "Alvo atual", "all"],
  ["scene.environmentNamed", "Ambiente ou nome da cena informado", "Cena atual", "all"],
  ["scene.darkness", "Escuridão da cena", "Cena atual", "all"],
  ["class.named", "Possui classe pelo nome", "Classe e raça", "character"], ["race.named", "Possui raça pelo nome", "Classe e raça", "character,retainer"],
  ["classAbility.named", "Possui habilidade de classe pelo nome", "Classe e raça", "character"], ["raceAbility.named", "Possui habilidade racial pelo nome", "Classe e raça", "character,retainer"],
  ["rogue.has", "Possui Talentos de Ladrão", "Classe e raça", "character"], ["rogue.remaining", "Pontos de talentos restantes", "Classe e raça", "character"],
  ["spell.named", "Possui magia pelo nome", "Magias", "character"], ["spell.count", "Quantidade de magias", "Magias", "character"],
  ["scroll.has", "Possui pergaminho", "Magias", "character,retainer"],
  ["condition", "Possui condição ou efeito pelo nome", "Condições e efeitos", "all"],
  ["effect.inactive", "Possui efeito inativo pelo nome", "Condições e efeitos", "all"], ["effect.temporary", "Possui efeito temporário", "Condições e efeitos", "all"],
  ["effect.passive", "Possui efeito passivo", "Condições e efeitos", "all"],
  ["monster.dv", "Dados de Vida", "Monstro", "monster"], ["monster.dvBonus", "Bônus de Dados de Vida", "Monstro", "monster"],
  ["monster.jp", "Jogada de Proteção", "Monstro", "monster"], ["monster.morale", "Moral", "Monstro", "monster"],
  ["monster.xp", "Experiência concedida", "Monstro", "monster"], ["monster.variant", "É uma variante", "Monstro", "monster"],
  ["monster.attackCount", "Quantidade de ataques", "Monstro", "monster"],
  ["retainer.heroicUsed", "Ação heroica utilizada", "Ajudante", "retainer"], ["retainer.hpSuggested", "PV máximo sugerido", "Ajudante", "retainer"],
  ["boolean.true", "Verdadeiro", "Verdadeiro ou falso", "all"], ["boolean.false", "Falso", "Verdadeiro ou falso", "all"],
  ["number", "Número informado", "Valores", "all"]
]);
export const CONDITIONAL_VALUES = Object.freeze(Object.fromEntries(CONDITIONAL_VALUE_DEFINITIONS.map(([key, label]) => [key, label])));
export const CONDITIONAL_OPERATORS = Object.freeze({
  eq: "Igual a", ne: "Diferente de", lt: "Menor que", lte: "Menor ou igual",
  gt: "Maior que", gte: "Maior ou igual", has: "Possui", lacks: "Não possui"
});
const BOOLEAN_CONDITIONAL_VALUES = new Set([
  "hp.isFull", "hp.isWounded", "hp.isHalf", "hp.isZero", "combat.active", "combat.turn",
  "movement.canFly", "movement.canSwim", "load.over", "item.named", "item.weapon",
  "item.weaponEquipped", "item.armorEquipped", "item.shieldEquipped", "item.ammunitionEquipped",
  "item.container", "item.magic", "attack.itemNamed", "attack.weaponMelee", "attack.weaponRanged",
  "attack.weaponThrowing", "attack.throwingBad", "attack.usesBAC", "attack.usesBAD", "attack.usesAmmunition",
  "attack.ammunitionNamed", "attack.itemMagic", "attack.ammunitionMagic",
  "target.speciesNamed", "target.conceptNamed", "target.alignmentNamed", "target.conditionNamed", "target.isMonster", "target.selected", "scene.environmentNamed",
  "class.named", "race.named", "classAbility.named",
  "raceAbility.named", "rogue.has", "spell.named", "scroll.has", "condition", "effect.inactive",
  "effect.temporary", "effect.passive", "monster.variant", "retainer.heroicUsed",
  "source.itemEquipped",
  "boolean.true", "boolean.false"
]);

export function conditionalValueType(operand) {
  return BOOLEAN_CONDITIONAL_VALUES.has(operand) ? "boolean" : "number";
}
export const CONDITIONAL_ACTIONS = Object.freeze({
  applyEffect: "Ativar este efeito", none: "Não fazer nada"
});
export const EFFECT_EVENT_ACTIONS = Object.freeze({
  none: "Não executar ação", roll: "Rolar um teste", heal: "Aplicar cura", damage: "Aplicar dano",
  consumeItem: "Consumir um item/recurso", applyEffect: "Aplicar este efeito aos alvos", summon: "Invocar ator pelo nome",
  transform: "Assumir aparência de ator", revertTransform: "Restaurar aparência original",
  prepareSpell: "Preparar magia pelo nome"
});
export const EFFECT_ACTION_TARGETS = Object.freeze({
  self: "Próprio ator", target: "Primeiro alvo selecionado", targets: "Todos os alvos selecionados",
  alliesAura: "Aliados dentro da aura", enemiesAura: "Inimigos dentro da aura"
});

function normalizeAction(source = {}) {
  return {
    type: CONDITIONAL_ACTIONS[source.type] ? source.type : "none",
    value: String(source.value || "0").trim() || "0",
    target: String(source.target || "").trim(),
    clampMax: source.clampMax !== false
  };
}

export function normalizeConditional(source = {}) {
  const requestedAction = source.resultAction ?? source.thenAction?.type;
  return {
    enabled: source.enabled === true,
    trigger: CONDITIONAL_TRIGGERS[source.trigger] ? source.trigger : "manual",
    flow: CONDITIONAL_FLOWS[source.flow] ? source.flow : "if",
    left: CONDITIONAL_VALUES[source.left] ? source.left : "hp.value",
    operator: CONDITIONAL_OPERATORS[source.operator] ? source.operator : "eq",
    right: CONDITIONAL_VALUES[source.right] ? source.right : "hp.max",
    number: Number(source.number) || 0,
    conditionName: String(source.conditionName || "").trim(),
    resultAction: CONDITIONAL_ACTIONS[requestedAction] ? requestedAction : "none",
    thenAction: normalizeAction(source.thenAction),
    elseAction: normalizeAction(source.elseAction),
    maxIterations: Math.min(20, Math.max(1, Math.trunc(Number(source.maxIterations) || 10)))
  };
}

export function normalizeEventAction(source = {}) {
  return {
    type: EFFECT_EVENT_ACTIONS[source.type] ? source.type : "none",
    formula: String(source.formula || "1d20").trim() || "1d20",
    target: EFFECT_ACTION_TARGETS[source.target] ? source.target : "self",
    resourceName: String(source.resourceName || "").trim(),
    radius: Math.max(0, Number(source.radius) || 0),
    privateResult: source.privateResult === true
  };
}

export function normalizeEffect(source = {}, randomId = () => "effect") {
  const durationType = DURATION_TYPES[source.duration?.type] ? source.duration.type : "permanent";
  const durationValue = Math.max(0, Math.trunc(Number(source.duration?.value) || 0));
  return {
    id: String(source.id || randomId()),
    name: String(source.name || "Novo efeito").trim() || "Novo efeito",
    icon: String(source.icon || "icons/svg/aura.svg"),
    enabled: source.enabled !== false,
    origin: String(source.origin || "Manual"),
    association: {
      type: ["class", "race", "class_ability", "race_ability", "spell", "equipment"].includes(source.association?.type) ? source.association.type : "",
      id: String(source.association?.id || ""),
      name: String(source.association?.name || "").trim(),
      effectId: String(source.association?.effectId || "")
    },
    description: String(source.description || ""),
    gmNotes: String(source.gmNotes || ""),
    deleteOnExpire: source.deleteOnExpire === true,
    duration: {
      type: durationType,
      value: durationValue,
      remaining: Math.max(0, Math.trunc(Number(source.duration?.remaining ?? durationValue) || 0)),
      expiresAt: Math.max(0, Number(source.duration?.expiresAt) || 0)
    },
    conditional: normalizeConditional(source.conditional),
    eventAction: normalizeEventAction(source.eventAction),
    uses: {
      max: Math.max(0, Math.trunc(Number(source.uses?.max) || 0)),
      remaining: Math.max(0, Math.trunc(Number(source.uses?.remaining ?? source.uses?.max) || 0)),
      resetOnRest: source.uses?.resetOnRest !== false
    },
    modifiers: (Array.isArray(source.modifiers) ? source.modifiers : []).flatMap((modifier) => {
      const originalKey = String(modifier?.key || "");
      const key = originalKey === "hp" ? "hp.max" : originalKey;
      const mode = String(modifier?.mode || "add");
      const value = String(modifier?.value ?? "").trim();
      const hasResolvedValue = modifier?.resolvedValue !== null && modifier?.resolvedValue !== undefined && String(modifier.resolvedValue).trim() !== "";
      const resolvedValue = hasResolvedValue ? Number(modifier.resolvedValue) : Number.NaN;
      if (!EFFECT_KEYS[key] || !EFFECT_MODES[mode] || !value) return [];
      return [{ key, mode, value, resolvedValue: Number.isFinite(resolvedValue) ? resolvedValue : null }];
    })
  };
}

export function effectAssociatedWithItem(effect, item, dependentNames = []) {
  const normalized = normalizeEffect(effect);
  const simplify = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  const names = [item?.name, ...dependentNames].map(simplify).filter(Boolean);
  const association = normalized.association;
  if (association.id && [item?.id, item?._id, item?.uuid].filter(Boolean).includes(association.id)) return true;
  if (association.type === item?.type && names.includes(simplify(association.name))) return true;
  return names.includes(simplify(normalized.origin));
}

export function effectForCategory(source = {}, category = "passive", randomId = () => "effect") {
  const effect = normalizeEffect({ ...source, id: randomId() }, randomId);
  if (category === "temporary") {
    effect.enabled = true;
    if (effect.duration.type === "permanent") {
      effect.duration = { type: "rounds", value: 1, remaining: 1, expiresAt: 0 };
    }
  } else if (category === "passive") {
    effect.enabled = true;
    effect.duration = { type: "permanent", value: 0, remaining: 0, expiresAt: 0 };
  } else if (category === "inactive") {
    effect.enabled = false;
  }
  return effect;
}

function normalizedText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function conditionalValue(snapshot, operand, rule = {}) {
  if (operand === "boolean.true") return true;
  if (operand === "boolean.false") return false;
  if (operand === "number") return Number(rule.number) || 0;
  if (operand === "condition") return (snapshot.conditions || []).some((name) => normalizedText(name) === normalizedText(rule.conditionName));
  const namedCollections = {
    "item.named": snapshot.items, "item.count": snapshot.items, "class.named": snapshot.classes,
    "race.named": snapshot.races, "classAbility.named": snapshot.classAbilities,
    "raceAbility.named": snapshot.raceAbilities, "spell.named": snapshot.spells,
    "effect.inactive": snapshot.inactiveEffects, "attack.itemNamed": snapshot.attackItems,
    "attack.ammunitionNamed": snapshot.ammunitionItems, "target.speciesNamed": snapshot.targetSpecies,
    "target.conceptNamed": snapshot.targetConcepts, "target.alignmentNamed": snapshot.targetAlignments,
    "target.conditionNamed": snapshot.targetConditions, "scene.environmentNamed": snapshot.sceneEnvironments
  };
  if (namedCollections[operand]) {
    const expectedValues = String(rule.conditionName || "").split(/[|,;]/).map(normalizedText).filter(Boolean);
    const count = namedCollections[operand].filter((name) => {
      const actual = normalizedText(name);
      return expectedValues.some((expected) => ["target.speciesNamed", "scene.environmentNamed", "attack.itemNamed", "attack.ammunitionNamed"].includes(operand) ? actual === expected || actual.includes(expected) : actual === expected);
    }).length;
    return operand === "item.count" ? count : count > 0;
  }
  const value = snapshot.values?.[operand];
  if (typeof value === "boolean") return value;
  return Number(value) || 0;
}

export function compareConditional(left, operator, right) {
  if (operator === "has") return Boolean(left);
  if (operator === "lacks") return !left;
  if (operator === "ne") return left !== right;
  if (operator === "lt") return left < right;
  if (operator === "lte") return left <= right;
  if (operator === "gt") return left > right;
  if (operator === "gte") return left >= right;
  return left === right;
}

export function conditionalMatches(conditional, snapshot) {
  const rule = normalizeConditional(conditional);
  return compareConditional(conditionalValue(snapshot, rule.left, rule), rule.operator, conditionalValue(snapshot, rule.right, rule));
}

export function conditionalEffectApplies(effect, snapshot) {
  const rule = normalizeConditional(effect?.conditional);
  return !rule.enabled || (rule.resultAction === "applyEffect" && conditionalMatches(rule, snapshot));
}

export function applyHpAction(current, maximum, action, rolledValue) {
  const hp = Number(current) || 0;
  const max = Math.max(1, Number(maximum) || 1);
  const value = Number(rolledValue) || 0;
  let result = hp;
  if (action?.type === "hpAdd") result += value;
  if (action?.type === "hpReduce") result -= value;
  if (action?.type === "hpSet") result = value;
  return Math.max(0, Math.min(action?.clampMax === false ? Number.POSITIVE_INFINITY : max, Math.round(result)));
}

export function shiftDamageDice(formula, steps = 0) {
  const direction = Math.sign(Number(steps) || 0);
  const amount = Math.abs(Math.trunc(Number(steps) || 0));
  if (!direction || !amount) return String(formula);
  const dice = [3, 4, 6, 8, 10, 12];
  return String(formula).replace(/(\d*)d(3|4|6|8|10|12)\b/gi, (match, count, faces) => {
    const index = dice.indexOf(Number(faces));
    const shifted = Math.max(0, Math.min(dice.length - 1, index + direction * amount));
    return `${count || 1}d${dice[shifted]}`;
  });
}

export function shiftDifficulty(adjustment, steps = 0) {
  const levels = ["very-hard", "hard", "", "easy", "very-easy"];
  const current = levels.indexOf(String(adjustment ?? ""));
  const start = current >= 0 ? current : 2;
  return levels[Math.max(0, Math.min(levels.length - 1, start + Math.trunc(Number(steps) || 0)))];
}

export function effectExpired(effect, worldTime = 0) {
  if (!effect?.enabled) return true;
  const duration = effect.duration || {};
  if (duration.type === "rounds") return Number(duration.remaining) <= 0;
  if (["turns", "minutes", "hours"].includes(duration.type)) return Number(duration.expiresAt) > 0 && Number(worldTime) >= Number(duration.expiresAt);
  return false;
}

export function activeEffects(effects, worldTime = 0) {
  return (Array.isArray(effects) ? effects : []).filter((effect) => !effectExpired(effect, worldTime));
}

export function applyModifiers(base, effects, key, worldTime = 0) {
  let result = Number(base) || 0;
  for (const effect of activeEffects(effects, worldTime)) {
    for (const modifier of effect.modifiers || []) {
      if (modifier.key !== key) continue;
      const value = modifier.resolvedValue !== null && modifier.resolvedValue !== undefined && String(modifier.resolvedValue).trim() !== "" && Number.isFinite(Number(modifier.resolvedValue))
        ? Number(modifier.resolvedValue) : Number(modifier.value) || 0;
      if (modifier.mode === "override") result = value;
      else if (modifier.mode === "multiply") result *= value;
      else if (modifier.mode === "divide") result = value === 0 ? result : result / value;
      else if (modifier.mode === "reduce") result -= value;
      else result += value;
    }
  }
  return result;
}

export function advanceDurations(effects, { roundChanged = false, roundsElapsed = roundChanged ? 1 : 0 } = {}) {
  return (Array.isArray(effects) ? effects : []).flatMap((effect) => {
    const normalized = normalizeEffect(effect, () => effect.id);
    if (roundsElapsed > 0 && normalized.duration.type === "rounds" && normalized.enabled && normalized.duration.remaining > 0) {
      normalized.duration.remaining = Math.max(0, normalized.duration.remaining - Math.trunc(roundsElapsed));
      if (normalized.duration.remaining <= 0) normalized.enabled = false;
    }
    if (!normalized.enabled && normalized.duration.type === "rounds" && normalized.deleteOnExpire) return [];
    return [normalized];
  });
}
