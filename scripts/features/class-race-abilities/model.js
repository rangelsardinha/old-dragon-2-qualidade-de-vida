export const CLASS_RACE_ABILITIES = Object.freeze({
  academicKnowledge: { label: "Conhecimento Acadêmico", names: ["conhecimento academico"] },
  decipherLanguages: { label: "Decifrar Linguagens", names: ["decifrar linguagens"] },
  legendsAndTraditions: { label: "Lendas e Tradições", names: ["lendas e tradicoes"] },
  identifyItems: { label: "Identificar Itens", names: ["identificar itens"] },
  reputation: { label: "Reputação", names: ["reputacao"] },
  miners: { label: "Mineradores", names: ["mineradores"] }
  , naturalPerception: { label: "Percepção Natural", names: ["percepcao natural"] },
  evaluators: { label: "Avaliadores", names: ["avaliadores"] },
  assassination: { label: "Assassinato", names: ["assassinato"] },
  climb: { label: "Escalar", names: ["escalar"] },
  naturalCamouflage: { label: "Camuflagem Natural", names: ["camuflagem natural"] },
  wildSurprise: { label: "Surpresa Selvagem", names: ["surpresa selvagem"] }
});

export function normalizeAbilityName(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

export function abilityKey(name) {
  const normalized = normalizeAbilityName(name);
  if (normalized === "reputacao" || normalized.startsWith("reputacao ") || normalized.startsWith("reputacao:")) return "reputation";
  return Object.entries(CLASS_RACE_ABILITIES).find(([, ability]) => ability.names.includes(normalized))?.[0] ?? null;
}

export function abilityScore(key, level) {
  const currentLevel = Math.max(1, Number(level) || 1);
  switch (key) {
    case "academicKnowledge": return currentLevel >= 6 ? 4 : currentLevel >= 3 ? 3 : 2;
    case "decipherLanguages": return currentLevel >= 6 ? 4 : 3;
    case "legendsAndTraditions": return 4;
    case "identifyItems": return 2;
    case "reputation": return currentLevel >= 15 ? 5 : currentLevel >= 14 ? 4 : currentLevel >= 12 ? 3 : 2;
    case "miners": return 2;
    case "naturalPerception": return 2;
    case "evaluators": return 4;
    case "assassination": return currentLevel >= 10 ? 3 : currentLevel >= 6 ? 2 : 0;
    case "climb": return 3;
    case "naturalCamouflage": return 2;
    case "wildSurprise": return 4;
    default: return 0;
  }
}

export function isAcademicClassName(name) {
  return normalizeAbilityName(name) === "academico";
}

export function isDwarfName(name) { const value = normalizeAbilityName(name); return value === "anao" || value.startsWith("anao athasiano"); }
export function isDwarfAdventurerName(name) { return normalizeAbilityName(name) === "anao aventureiro"; }
export function isElfName(name) { const value = normalizeAbilityName(name); return ["elfo", "elfo aventureiro", "elfo athasiano", "elfo aventureiro athasiano"].includes(value); }
export function isHalfElfName(name) { const value = normalizeAbilityName(name); return ["meio elfo", "meio-elfo", "meio elfo aventureiro", "meio-elfo aventureiro", "meio elfo athasiano", "meio-elfo athasiano"].includes(value); }
export function isArcherName(name) { return normalizeAbilityName(name) === "arqueiro"; }
export function isBarbarianName(name) { return normalizeAbilityName(name) === "barbaro"; }
export function isGnomeName(name) { return normalizeAbilityName(name) === "gnomo"; }
export function isHalflingName(name) { const value = normalizeAbilityName(name); return ["halfling", "halfling aventureiro", "halfling athasiano", "halfling aventureiro athasiano"].includes(value); }
export function isHalfGiantName(name) { const value = normalizeAbilityName(name); return ["meio gigante", "meio-gigante", "meio gigante athasiano", "meio-gigante athasiano"].includes(value); }
export function isAarakocraName(name) { const value = normalizeAbilityName(name); return value === "aarakocra" || value === "aarakocra athasiano"; }
export function dwarfAdventurerHitDieForLevel(level) { return Number(level) >= 3 ? 12 : 10; }

export function rollSucceeded(total, score) {
  return Number(total) <= Number(score);
}

export const ACADEMIC_ABILITIES = CLASS_RACE_ABILITIES;
export const normalizeAcademicName = normalizeAbilityName;
export const academicAbilityKey = abilityKey;
export const academicAbilityScore = abilityScore;
export const academicRollSucceeded = rollSucceeded;
