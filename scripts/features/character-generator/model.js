export const ATTRIBUTES = ["forca", "destreza", "constituicao", "inteligencia", "sabedoria", "carisma"];

export const ATTRIBUTE_LABELS = {
  forca: "Força", destreza: "Destreza", constituicao: "Constituição",
  inteligencia: "Inteligência", sabedoria: "Sabedoria", carisma: "Carisma"
};

export function normalizeName(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function attributeModifier(value) {
  const score = Number(value) || 0;
  if (score < 2) return -4;
  if (score < 4) return -3;
  if (score < 6) return -2;
  if (score < 9) return -1;
  if (score < 13) return 0;
  if (score < 15) return 1;
  if (score < 17) return 2;
  if (score < 19) return 3;
  return 4;
}

export function racialAttributes(raceName) {
  const race = normalizeName(raceName);
  if (race.includes("elfo") && !race.includes("meio")) return { strong: "destreza", weak: "constituicao" };
  if (race.includes("anao")) return { strong: "constituicao", weak: "carisma" };
  if (race.includes("halfling")) return { strong: "destreza", weak: "forca" };
  if (race.includes("gnomo")) return { strong: "inteligencia", weak: "sabedoria" };
  return null;
}

export function classAllowsRace(characterClass, raceName) {
  let restrictions = characterClass?.system?.restrictions?.races ?? [];
  if (restrictions.length && typeof restrictions[0] === "string") {
    restrictions = restrictions.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean);
  }
  return !restrictions.length || restrictions.some((entry) => normalizeName(entry) === normalizeName(raceName));
}

export function experienceForLevel(characterClass, level) {
  if (Number(level) <= 1) return 0;
  return Math.max(0, Math.trunc(Number(characterClass?.system?.levels?.[level]?.xp) || 0));
}

const CLASS_HIT_DICE = new Map([
  ["guerreiro", 10], ["barbaro", 10], ["paladino", 10], ["clerigo", 8],
  ["druida", 8], ["academico", 8], ["ladrao", 6], ["ranger", 6],
  ["bardo", 6], ["mago", 4], ["ilusionista", 4], ["necromante", 4],
  ["anao aventureiro", 10], ["arqueiro", 10], ["xama", 8], ["proscrito", 8],
  ["assassino", 6], ["halfling aventureiro", 6], ["bruxo", 4], ["elfo aventureiro", 4],
  ["bardo athasiano", 6], ["clerigo elemental", 8], ["gladiador", 12],
  ["preservador", 4], ["profanador", 4], ["psionico", 4], ["templario", 8]
]);

const CLASS_HIT_POINT_BONUSES = new Map([["barbaro", 2]]);
const CLASS_JPC_BONUSES = new Map([["barbaro", 2]]);

export function hitDieForClass(characterClass) {
  const byName = CLASS_HIT_DICE.get(normalizeName(characterClass?.name));
  if (byName) return byName;
  const configured = Math.trunc(Number(characterClass?.system?.hp));
  if (configured > 0) return configured;
  return 4;
}

export function hitDieForClassLevel(characterClass, level) {
  if (normalizeName(characterClass?.name) === "anao aventureiro" && Number(level) >= 3) return 12;
  return hitDieForClass(characterClass);
}

export function hitPointBonusForClass(characterClass) {
  return CLASS_HIT_POINT_BONUSES.get(normalizeName(characterClass?.name)) ?? 0;
}

export function jpcBonusForClass(characterClass) {
  return CLASS_JPC_BONUSES.get(normalizeName(characterClass?.name)) ?? 0;
}

export function calculateHitPoints(hitDie, level, constitution, rolls = [], perLevelBonus = 0) {
  const die = Math.max(1, Math.trunc(Number(hitDie) || 1));
  const levels = Math.max(1, Math.trunc(Number(level) || 1));
  const modifier = attributeModifier(constitution);
  const classBonus = Math.trunc(Number(perLevelBonus) || 0);
  let total = Math.max(1, die + modifier + classBonus);
  for (let index = 1; index < levels; index += 1) {
    total += Math.max(1, Math.trunc(Number(rolls[index - 1]) || 1) + modifier + classBonus);
  }
  return total;
}

export function allocationFromDice(dice, assignments) {
  const result = Object.fromEntries(ATTRIBUTES.map((attribute) => [attribute, 8]));
  dice.forEach((die, index) => { result[assignments[index]] += Number(die) || 0; });
  return result;
}
