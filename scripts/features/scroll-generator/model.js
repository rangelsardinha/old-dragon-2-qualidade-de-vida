export const CURSE_EFFECTS = {
  bodyVulnerability: "Vulnerabilidade do Corpo: o alvo perde 2 pontos na sua Classe de Armadura.",
  memoryFluidity: "Fluidez da Memória: conjuradores possuem 1-2 chances em 1d6 de se esquecer de qualquer magia que forem conjurar antes desta ser conjurada.",
  soulWeakness: "Fraqueza da Alma: o alvo perde metade dos seus pontos de Constituição e dos possíveis pontos de vida extras que um alto valor de Constituição pode conceder.",
  precisionInefficiency: "Ineficiência da Precisão: todo ataque do alvo é um teste difícil."
};

export function curseForRoll(roll) {
  const value = Math.min(6, Math.max(1, Math.trunc(Number(roll) || 1)));
  if (value <= 2) return { roll: value, key: "bodyVulnerability", text: CURSE_EFFECTS.bodyVulnerability };
  if (value === 3) return { roll: value, key: "memoryFluidity", text: CURSE_EFFECTS.memoryFluidity };
  if (value === 4) return { roll: value, key: "soulWeakness", text: CURSE_EFFECTS.soulWeakness };
  return { roll: value, key: "precisionInefficiency", text: CURSE_EFFECTS.precisionInefficiency };
}

export function selectRandomSpells(pool, maximum = 3, random = Math.random) {
  const available = [...pool];
  const limit = Math.min(Math.max(1, Math.trunc(maximum)), available.length);
  if (!limit) return [];
  const percentile = random() * 100;
  const rolledCount = percentile < 80 ? 1 : percentile < 95 ? 2 : 3;
  const count = Math.min(rolledCount, limit);
  const selected = [];
  while (selected.length < count && available.length) {
    const index = Math.min(available.length - 1, Math.floor(random() * available.length));
    selected.push(available.splice(index, 1)[0]);
  }
  return selected;
}
