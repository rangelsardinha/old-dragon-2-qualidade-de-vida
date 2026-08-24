export const ACADEMIC_ABILITIES = Object.freeze({
  academicKnowledge: { label: "Conhecimento Acadêmico", names: ["conhecimento academico"] },
  decipherLanguages: { label: "Decifrar Linguagens", names: ["decifrar linguagens"] },
  legendsAndTraditions: { label: "Lendas e Tradições", names: ["lendas e tradicoes"] },
  identifyItems: { label: "Identificar Itens", names: ["identificar itens"] },
  reputation: { label: "Reputação", names: ["reputacao"] },
  miners: { label: "Mineradores", names: ["mineradores"] }
});

export function normalizeAcademicName(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

export function academicAbilityKey(name) {
  const normalized = normalizeAcademicName(name);
  return Object.entries(ACADEMIC_ABILITIES).find(([, ability]) => ability.names.includes(normalized))?.[0] ?? null;
}

export function academicAbilityScore(key, level) {
  const currentLevel = Math.max(1, Number(level) || 1);
  switch (key) {
    case "academicKnowledge": return currentLevel >= 6 ? 4 : currentLevel >= 3 ? 3 : 2;
    case "decipherLanguages": return currentLevel >= 6 ? 4 : 3;
    case "legendsAndTraditions": return 4;
    case "identifyItems": return 2;
    case "reputation": return currentLevel >= 15 ? 5 : currentLevel >= 14 ? 4 : currentLevel >= 12 ? 3 : 2;
    case "miners": return 2;
    default: return 0;
  }
}

export function isAcademicClassName(name) {
  return normalizeAcademicName(name) === "academico";
}

export function isDwarfName(name) { return normalizeAcademicName(name) === "anao"; }
export function isDwarfAdventurerName(name) { return normalizeAcademicName(name) === "anao aventureiro"; }
export function dwarfAdventurerHitDieForLevel(level) { return Number(level) >= 3 ? 12 : 10; }

export function academicRollSucceeded(total, score) {
  return Number(total) <= Number(score);
}
