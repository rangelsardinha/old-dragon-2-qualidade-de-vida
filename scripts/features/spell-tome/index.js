const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const SOURCE_FLAG_ID = "tomo-de-magia-od2";
const DATA_PATH = `modules/${MODULE_ID}/data/spell-tome/spells.json`;
const RULES_PATH = `modules/${MODULE_ID}/data/spell-tome/rules.json`;

let spellData = null;
let rulesData = null;
const PACK_VERSION = "1.9.2-qvd.1";
const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const PACK_CONFIGS = [
  { name: "arcane-spells", dataKey: "arcane", mode: "circle" },
  { name: "arcane-spells-by-school", dataKey: "arcane", mode: "school" },
  { name: "divine-spells", dataKey: "divine", mode: "circle" },
  { name: "divine-spells-by-sphere", dataKey: "divine", mode: "sphere" },
  { name: "wild-spells", dataKey: "wild", mode: "circle" },
  { name: "mission-spells", dataKey: "mission", mode: "circle" },
  { name: "cooperative-spells", dataKey: "cooperative", mode: "circle" },
];

const WILD_LEVEL_VARIATION = {
  1: ["-1", "-1", "-1", "-1", "-1", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "+1", "+1", "+1", "+1", "+1"],
  2: ["-1", "-1", "-1", "-1", "-1", "-1", "0", "0", "0", "0", "0", "0", "0", "0", "+1", "+1", "+1", "+1", "+1", "+1"],
  3: ["-2", "-1", "-1", "-1", "-1", "-1", "-1", "0", "0", "0", "0", "0", "0", "+1", "+1", "+1", "+1", "+1", "+1", "+2"],
  4: ["-2", "-2", "-1", "-1", "-1", "-1", "-1", "-1", "0", "0", "0", "0", "+1", "+1", "+1", "+1", "+1", "+1", "+2", "+2"],
  5: ["-3", "-2", "-2", "-1", "-1", "-1", "-1", "-1", "-1", "0", "0", "+1", "+1", "+1", "+1", "+1", "+1", "+2", "+2", "+3"],
  6: ["-3", "-3", "-2", "-2", "-1", "-1", "-1", "-1", "-1", "0", "0", "+1", "+1", "+1", "+1", "+1", "+2", "+2", "+3", "+3"],
  7: ["-4", "-3", "-3", "-2", "-2", "-1", "-1", "-1", "-1", "0", "0", "+1", "+1", "+1", "+1", "+2", "+2", "+3", "+3", "+4"],
  8: ["-4", "-4", "-3", "-3", "-2", "-2", "-1", "-1", "-1", "0", "0", "+1", "+1", "+1", "+2", "+2", "+3", "+3", "+4", "+4"],
  9: ["-5", "-4", "-4", "-3", "-3", "-2", "-2", "-1", "-1", "0", "0", "+1", "+1", "+2", "+2", "+3", "+#", "+4", "+4", "+5"],
};

const WILD_SURGE_CELLS = new Set(["1:20", "2:13", "3:12", "4:19", "5:8", "6:5", "7:11", "8:15", "9:9", "9:17"]);

const WILD_SURGE_RESULTS = [
  "Uma parede de força aparece diante do lançador",
  "O lançador cheira a um gambá pela duração da magia",
  "O lançador dispara oito cobras não-venenosas das pontas dos dedos. As cobras não atacam.",
  "As roupas do lançador causam coceira (+2 na iniciativa)",
  "O lançador brilha como em uma magia de luz",
  "O efeito da magia tem um raio de 18 metros centrado no lançador",
  "A próxima frase dita pelo lançador torna-se verdadeira, durando por 1 turno",
  "O cabelo do lançador cresce 30 cm de comprimento",
  "O lançador gira 180 graus",
  "O rosto do lançador fica enegrecido por uma pequena explosão",
  "O lançador desenvolve alergia aos seus itens mágicos. O personagem não pode controlar o espirro até que todos os itens mágicos sejam removidos. A alergia dura 1d6 turnos.",
  "A cabeça do lançador aumenta de tamanho por 1d3 turnos",
  "O lançador diminui de tamanho (encolhimento reverso) por 1d3 turnos",
  "O lançador se apaixona loucamente pelo alvo até que uma magia de remover maldição seja lançada",
  "A magia não pode ser cancelada voluntariamente pelo lançador",
  "O lançador se transforma aleatoriamente",
  "A língua reversa afeta todos dentro de 18 metros do lançador",
  "A língua reversa afeta todos dentro de 60 pés do lançador",
  "Um muro de fogo circunda o lançador",
  "Os pés do lançador aumentam, reduzindo o movimento pela metade e adicionando +4 à iniciativa por 1d3 turnos",
  "O lançador sofre o mesmo efeito de magia que o alvo",
  "O lançador levita 6 metros por 1d4 turnos",
  "Causar medo com um raio de 60 pés centrado no lançador. Todos dentro do raio, exceto o lançador, devem fazer uma jogada de proteção.",
  "O lançador fala com uma voz esganiçada por 1d6 dias",
  "O lançador ganha visão de raio-x por 1d6 rodadas",
  "O lançador envelhece 10 anos",
  "Silêncio, raio de 4,5 metros centrado no lançador",
  "Um poço de 3x3 metros aparece imediatamente diante do lançador, com 1,5 metro de profundidade por nível do lançador",
  "Gravidade reversa sob os pés do lançador por 1 rodada",
  "Serpentinas coloridas jorram das pontas dos dedos do lançador",
  "O efeito da magia rebate no lançador",
  "O lançador se torna invisível",
  "Rajada de cor das pontas dos dedos do lançador",
  "Um fluxo de borboletas jorra da boca do lançador",
  "O lançador deixa pegadas em forma de monstro em vez das próprias até que uma magia de dissipar magia seja lançada",
  "De 3 a 30 gemas disparam das pontas dos dedos do lançador. Cada gema vale 1d6 x 10 peças de ouro.",
  "Música enche o ar",
  "Criar comida e água",
  "Todos os fogos normais dentro de 18 metros do lançador são apagados",
  "Um item mágico dentro de 9 metros do lançador (escolhido aleatoriamente) é permanentemente drenado",
  "Um item normal dentro de 9 metros do lançador (escolhido aleatoriamente) se torna permanentemente mágico",
  "Todas as armas mágicas dentro de 9 metros do lançador são aumentadas em +2 por 1 turno",
  "Fumaça escorre dos ouvidos de todas as criaturas dentro de 18 metros do lançador por 1 turno",
  "Luzes dançantes",
  "Todas as criaturas dentro de 9 metros do lançador começam a soluçar (+1 nos tempos de lançamento de magia, -1 no BAC) por 2d4 turnos",
  "Todas as portas normais, portas secretas, pontes levadiças, etc. dentro de 18 metros do lançador se abrem.",
  "O lançador e o alvo trocam de lugar",
  "A magia afeta um alvo aleatório dentro de 18 metros do lançador",
  "A magia falha, mas não é apagada da mente do lançador",
  "Invocação de monstros II",
  "Mudança repentina no clima (aumento de temperatura, neve, chuva, etc.) durando 1d6 turnos",
  "Estrondo ensurdecedor afeta todos dentro de 18 metros. Todos os que podem ouvir devem fazer uma JPS ou ficarão atordoados por 1d3 rodadas.",
  "O lançador e o alvo trocam de vozes até que uma magia de remover maldição seja lançada",
  "Um portal se abre para um plano exterior escolhido aleatoriamente; 50% de chance de que uma criatura extraplanar apareça.",
  "A magia funciona, mas grita como um gritador",
  "A eficácia da magia (alcance, duração, área de efeito, dano, etc.) diminui 50%",
  "A magia é revertida, se a reversão for possível",
  "A magia assume a forma física de um elemental com vontade livre e não pode ser controlada pelo lançador. O elemental permanece pela duração da magia. O toque do elemental causa o efeito da magia (BAC igual ao do lançador).",
  "Todas as armas dentro de 18 metros do lançador brilham por 1d4 rodadas",
  "A magia funciona; nenhuma Jogada de Proteção aplicável é permitido",
  "A magia parece falhar quando lançada, mas ocorre de 1 a 4 rodadas depois",
  "Todos os itens mágicos a 18 metros do lançador brilham",
  "O lançador e o alvo trocam de personalidades por 2d10 rodadas",
  "Magia lenta centrada no alvo",
  "Alvo iludido",
  "Raio de relâmpago dispara em direção ao alvo",
  "Alvo aumentado",
  "Escuridão centrada no alvo",
  "Crescimento de plantas centrado no alvo",
  "45 kg de matéria não viva dentro de 3 metros do alvo desaparece",
  "Bola de fogo se centra no alvo",
  "Alvo se transforma em pedra",
  "A magia é lançada; a memória da magia é retida",
  "Todos dentro de 3 metros do lançador recebem os benefícios de uma cura",
  "Alvo fica tonto (-4 CA e BAC, não pode lançar magias) por 2d4 rodadas",
  "Parede de fogo cerca o alvo",
  "Alvo levita 6 metros por 1d3 rodadas",
  "Alvo sofre cegueira",
  "Alvo é encantado como por encantar monstro",
  "Alvo esquece",
  "Pés do alvo aumentam, reduzindo o movimento pela metade e adicionando +4 a todas as jogadas de iniciativa por 1-3 rodadas",
  "Monstro de ferrugem aparece na frente do alvo",
  "Alvo sofre polimorfia aleatória",
  "Alvo se apaixona loucamente pelo lançador até que uma magia de dissipação seja lançada.",
  "Alvo muda de sexo",
  "Pequena nuvem negra se forma sobre o alvo",
  "Nuvem fétida se centra no alvo",
  "Objeto pesado (pedra, bigorna, cofre, etc.) aparece sobre o alvo e cai causando 2d20 pontos de dano",
  "Alvo começa a espirrar. Nenhuma magia pode ser lançada até que o acesso passe (1d6 rodadas).",
  "Efeito da magia tem raio de 60 pés centrado no alvo (todos dentro do raio sofrem o efeito)",
  "As roupas do alvo causam coceira (+2 na iniciativa por 1d10 rodadas)",
  "Raça do alvo muda aleatoriamente até ser cancelada por magia de dissipação",
  "Alvo se torna etéreo por 2d4 rodadas",
  "Alvo é apressado",
  "Todos os tecidos no alvo se desfazem em pó",
  "Alvo brota folhas (nenhum dano causado, pode ser podado sem prejudicar)",
  "Alvo brota novo apêndice inútil (asas, braço, orelha, etc.) que permanece até que magia de dissipação seja lançada",
  "Alvo muda de cor (cancelado por magia de dissipação)",
  "A magia tem uma duração mínima de 1 turno (ou seja, uma bola de fogo cria uma bola de chamas que permanece por 1 turno, um raio de relâmpago ricocheteia e continua, possivelmente voltando, por 1 turno, etc.)",
  "A eficácia da magia (alcance, duração, área de efeito, dano, etc.) aumenta 200%",
];

const SPECIALIST_REQUIREMENTS = [
  ["Abjurante", "Abjuração", "H", "15 SAB", "Alteração e Ilusão"],
  ["Conjurador", "Conjur/Convoc", "H, 1/2 E", "15 CON", "Profecia e Invocação"],
  ["Adivinho", "Profecia", "H, 1/2 E, E", "16 SAB", "Conjuração/Convocação"],
  ["Feiticeiro", "Encant/Evocação", "H, 1/2 E, E", "16 CAR", "Invocação/Evocação e Necromancia"],
  ["Ilusionista", "Ilusão", "H, G", "16 DES", "Invocação/Evocação, Necromancia e Abjuração"],
  ["Invocador", "Invocação/Evocação", "H", "16 CON", "Conjuração/Convocação"],
  ["Necromante", "Necromancia", "H", "16 SAB", "Ilusão e Encantamento/Feitiço"],
  ["Transmutador", "Alteração", "H, 1/2 E", "16 DES", "Abjuração e Necromancia"],
];

const traditionLabels = {
  arcane: "Arcana",
  divine: "Divina",
};

async function loadSpells() {
  if (!spellData) {
    const response = await fetch(DATA_PATH);
    spellData = await response.json();
  }
  return spellData;
}

async function loadRules() {
  if (!rulesData) {
    const response = await fetch(RULES_PATH);
    rulesData = await response.json();
  }
  return rulesData;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function metaOf(spell) {
  return spell.flags?.[SOURCE_FLAG_ID] ?? {};
}

function enabled() {
  return game.system.id === "olddragon2e"
    && game.settings.get(MODULE_ID, "enableSpellTome")
    && !game.modules.get(SOURCE_FLAG_ID)?.active;
}

function isWildSpell(spell) {
  return Boolean(metaOf(spell).selvagem);
}

function isMissionSpell(spell) {
  return Boolean(metaOf(spell).missao);
}

function isCooperativeSpell(spell) {
  return Boolean(metaOf(spell).cooperativa);
}

function stableId(seed) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  let number = (BigInt(h1 >>> 0) << 32n) + BigInt(h2 >>> 0);
  let id = "";
  for (let i = 0; i < 16; i += 1) {
    id += ID_ALPHABET[Number(number % BigInt(ID_ALPHABET.length))];
    number /= BigInt(ID_ALPHABET.length);
  }
  return id.padEnd(16, "a");
}

function circleLabel(circle) {
  return `${circle || "?"}º Circulo`;
}

function toDropData(spell) {
  return {
    type: "Item",
    data: foundry.utils.deepClone(spell),
  };
}

async function addSpellToActor(spell) {
  const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character;
  if (!actor) {
    ui.notifications.warn("Selecione um token ou defina um personagem do usuario antes de adicionar a magia.");
    return;
  }
  if (!actor.isOwner) {
    ui.notifications.warn(`Voce nao tem permissao para editar ${actor.name}.`);
    return;
  }
  const itemData = foundry.utils.deepClone(spell);
  delete itemData._id;
  await actor.createEmbeddedDocuments("Item", [itemData]);
  ui.notifications.info(`${spell.name} adicionada a ${actor.name}.`);
}

async function clearPack(pack, documentClass = Item) {
  const index = await pack.getIndex();
  const ids = index.map((entry) => entry._id);
  if (ids.length) {
    await documentClass.deleteDocuments(ids, { pack: pack.collection });
  }

  const folderIds = pack.folders ? Array.from(pack.folders.keys()) : [];
  if (folderIds.length) {
    await Folder.deleteDocuments(folderIds, {
      pack: pack.collection,
      deleteSubfolders: true,
      deleteContents: false,
    });
  }
}

function specialistRequirementsDescription() {
  const rows = SPECIALIST_REQUIREMENTS.map(
    ([specialist, school, race, minimum, opposed]) =>
      `<tr><td><strong>${specialist}</strong></td><td>${school}</td><td>${race}</td><td>${minimum}</td><td>${opposed}</td></tr>`,
  ).join("");

  return `
    <h2>Exigencias para Magos Especialistas</h2>
    <p><strong>Tabela 1.3</strong></p>
    <table>
      <thead>
        <tr>
          <th>Especialista</th>
          <th>Escola</th>
          <th>Raca</th>
          <th>Minimo</th>
          <th>Escolas Opostas</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildSpecialistRequirementsTable() {
  return {
    _id: stableId(`${MODULE_ID}:table:specialist-requirements`),
    name: "Exigencias para Magos Especialistas (Tabela 1.3)",
    img: "icons/svg/d20-grey.svg",
    description: specialistRequirementsDescription(),
    formula: "1d8",
    replacement: true,
    displayRoll: true,
    results: SPECIALIST_REQUIREMENTS.map(([specialist, school, race, minimum, opposed], index) => ({
      _id: stableId(`${MODULE_ID}:table:specialist-requirements:${index + 1}`),
      type: "text",
      text: `${specialist} | Escola: ${school} | Raca: ${race} | Minimo: ${minimum} | Escolas opostas: ${opposed}`,
      img: "icons/svg/d20-black.svg",
      weight: 1,
      range: [index + 1, index + 1],
      drawn: false,
      flags: {},
    })),
    flags: {
      [MODULE_ID]: {
        source: "Tabela 1.3",
      },
    },
  };
}

function wildLevelVariationDescription() {
  const header = Array.from({ length: 20 }, (_, i) => `<th>${i + 1}</th>`).join("");
  const rows = Object.entries(WILD_LEVEL_VARIATION).map(([level, results]) => {
    const cells = results
      .map((result, index) => {
        const roll = index + 1;
        const isSurge = WILD_SURGE_CELLS.has(`${level}:${roll}`);
        return `<td>${isSurge ? `<strong>${result}</strong>` : result}</td>`;
      })
      .join("");
    return `<tr><th>${level === "9" ? "9+" : level}</th>${cells}</tr>`;
  }).join("");

  return `
    <h2>Variacao de Nivel</h2>
    <p><strong>Tabela 1.1</strong></p>
    <p>Quando uma magia selvagem e lancada, role 1d20. Consulte a linha do nivel da magia lancada e aplique o modificador ao nivel para obter o nivel real da magia.</p>
    <table>
      <thead>
        <tr><th>Nivel real</th>${header}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p><em>Resultados em negrito indicam Surto Selvagem; consulte a Tabela 1.2, Resultado de Surto Selvagem.</em></p>
  `;
}

function buildWildLevelVariationTable() {
  return {
    _id: stableId(`${MODULE_ID}:table:wild-level-variation`),
    name: "Variacao de Nivel (Tabela 1.1)",
    img: "icons/svg/d20-grey.svg",
    description: wildLevelVariationDescription(),
    formula: "1d20",
    replacement: true,
    displayRoll: true,
    results: Array.from({ length: 20 }, (_, index) => ({
      _id: stableId(`${MODULE_ID}:table:wild-level-variation:${index + 1}`),
      type: "text",
      text: `Resultado no d20: ${index + 1}. Consulte a linha do nivel da magia na descricao da tabela.`,
      img: "icons/svg/d20-black.svg",
      weight: 1,
      range: [index + 1, index + 1],
      drawn: false,
      flags: {},
    })),
    flags: {
      [MODULE_ID]: {
        source: "Tabela 1.1",
      },
    },
  };
}

function wildSurgeDescription() {
  const rows = WILD_SURGE_RESULTS.map((result, index) => `<tr><th>${index + 1}</th><td>${result}</td></tr>`).join("");

  return `
    <h2>Resultado de Surto Selvagem</h2>
    <p><strong>Tabela 1.2</strong></p>
    <p>Role 1d100 quando uma celula de surto for indicada na Tabela 1.1 - Variacao de Nivel.</p>
    <table>
      <thead>
        <tr>
          <th>D100</th>
          <th>Resultado do Surto Selvagem</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildWildSurgeTable() {
  return {
    _id: stableId(`${MODULE_ID}:table:wild-surge-results`),
    name: "Resultado de Surto Selvagem (Tabela 1.2)",
    img: "icons/svg/d20-grey.svg",
    description: wildSurgeDescription(),
    formula: "1d100",
    replacement: true,
    displayRoll: true,
    results: WILD_SURGE_RESULTS.map((result, index) => ({
      _id: stableId(`${MODULE_ID}:table:wild-surge-results:${index + 1}`),
      type: "text",
      text: result,
      img: "icons/svg/d20-black.svg",
      weight: 1,
      range: [index + 1, index + 1],
      drawn: false,
      flags: {},
    })),
    flags: {
      [MODULE_ID]: {
        source: "Tabela 1.2",
      },
    },
  };
}

function tablesForPack() {
  return [buildSpecialistRequirementsTable(), buildWildLevelVariationTable(), buildWildSurgeTable()];
}

function pdfLinksContent(rules) {
  const links = rules
    .map(
      (rule) =>
        `<li><a href="${rule.assetPath}" target="_blank" rel="nofollow noopener">${rule.pdfTitle}</a> - paginas ${rule.startPage} a ${rule.endPage} extraidas em ${rule.title}.</li>`,
    )
    .join("");

  return `
    <h1>PDFs para consulta</h1>
    <p>Os arquivos abaixo ficam dentro do modulo e podem ser abertos para consulta no Foundry.</p>
    <ul>${links}</ul>
  `;
}

function journalFromRule(rule) {
  return {
    _id: stableId(`${MODULE_ID}:journal:${rule.id}`),
    name: rule.title,
    ownership: {
      default: 2,
    },
    pages: rule.pages.map((page, index) => ({
      _id: stableId(`${MODULE_ID}:journal:${rule.id}:page:${page.pageNumber}`),
      name: `Pagina ${page.pageNumber}`,
      type: "text",
      title: {
        show: true,
        level: 1,
      },
      text: {
        format: 1,
        content: page.content,
      },
      sort: (index + 1) * 100000,
    })),
    flags: {
      [MODULE_ID]: {
        generated: true,
        ruleId: rule.id,
      },
    },
  };
}

function pdfJournal(rules) {
  return {
    _id: stableId(`${MODULE_ID}:journal:pdfs`),
    name: "PDFs do Tomo de Magia",
    ownership: {
      default: 2,
    },
    pages: [
      {
        _id: stableId(`${MODULE_ID}:journal:pdfs:links`),
        name: "PDFs",
        type: "text",
        title: {
          show: true,
          level: 1,
        },
        text: {
          format: 1,
          content: pdfLinksContent(rules),
        },
        sort: 100000,
      },
    ],
    flags: {
      [MODULE_ID]: {
        generated: true,
        ruleId: "pdfs",
      },
    },
  };
}

function rulesJournals(rulesData) {
  return [...rulesData.rules.map(journalFromRule), pdfJournal(rulesData.rules)];
}

async function createFolders(pack, folderSpecs) {
  if (!folderSpecs.length) return;

  const toFolderDoc = (spec, index) => ({
    _id: spec.id,
    name: spec.name,
    type: "Item",
    folder: spec.parent ?? null,
    sorting: "a",
    sort: (index + 1) * 1000,
    color: spec.color ?? null,
    flags: {
      [MODULE_ID]: {
        generated: true,
      },
    },
  });

  const rootFolders = folderSpecs.filter((spec) => !spec.parent).map(toFolderDoc);
  const childFolders = folderSpecs.filter((spec) => spec.parent).map(toFolderDoc);

  if (rootFolders.length) {
    await Folder.createDocuments(rootFolders, { pack: pack.collection, keepId: true });
  }
  if (childFolders.length) {
    await Folder.createDocuments(childFolders, { pack: pack.collection, keepId: true });
  }
}

function buildCirclePack(spells, packName) {
  const circles = uniq(spells.map((spell) => metaOf(spell).circulo)).sort((a, b) => Number(a) - Number(b));
  const folderSpecs = circles.map((circle) => ({
    key: circle,
    id: stableId(`${packName}:circle:${circle}`),
    name: circleLabel(circle),
  }));
  const folderByCircle = Object.fromEntries(folderSpecs.map((folder) => [folder.key, folder.id]));
  const items = spells.map((spell) => ({
    ...foundry.utils.deepClone(spell),
    folder: folderByCircle[metaOf(spell).circulo] ?? null,
  }));
  return { folderSpecs, items };
}

function buildGroupedPack(spells, packName, groupKey, fallbackGroup, color) {
  const groups = uniq(spells.flatMap((spell) => metaOf(spell)[groupKey] ?? []));
  if (spells.some((spell) => !metaOf(spell)[groupKey]?.length)) {
    groups.push(fallbackGroup);
  }
  const folderSpecs = [];

  for (const group of groups) {
    const groupId = stableId(`${packName}:group:${group}`);
    folderSpecs.push({
      key: group,
      id: groupId,
      name: group,
      color,
    });

    const circles = uniq(
      spells
        .filter((spell) => (metaOf(spell)[groupKey] ?? []).includes(group))
        .map((spell) => metaOf(spell).circulo),
    ).sort((a, b) => Number(a) - Number(b));

    for (const circle of circles) {
      folderSpecs.push({
        key: `${group}:${circle}`,
        id: stableId(`${packName}:group:${group}:circle:${circle}`),
        name: circleLabel(circle),
        parent: groupId,
      });
    }
  }

  const folderByKey = Object.fromEntries(folderSpecs.map((folder) => [folder.key, folder.id]));
  const items = [];

  for (const spell of spells) {
    const meta = metaOf(spell);
    const spellGroups = meta[groupKey]?.length ? meta[groupKey] : [fallbackGroup];
    for (const group of spellGroups) {
      const item = foundry.utils.deepClone(spell);
      item._id = stableId(`${packName}:item:${spell._id}:${group}`);
      item.folder = folderByKey[`${group}:${meta.circulo}`] ?? folderByKey[group] ?? null;
      items.push(item);
    }
  }

  return { folderSpecs, items };
}

function buildPackContent(packName, spells, mode) {
  if (mode === "circle") return buildCirclePack(spells, packName);
  if (mode === "school") return buildGroupedPack(spells, packName, "escolas", "Sem escola", "#6f2138");
  if (mode === "sphere") return buildGroupedPack(spells, packName, "esferas", "Sem esfera", "#2f5f73");
  return { folderSpecs: [], items: spells.map((spell) => foundry.utils.deepClone(spell)) };
}

async function populatePack(config, spells) {
  const { name: packName, mode } = config;
  const pack = game.packs.get(`${MODULE_ID}.${packName}`);
  if (!pack) {
    console.warn(`${MODULE_ID} | Compendio nao encontrado: ${packName}`);
    return;
  }

  const { folderSpecs, items } = buildPackContent(packName, spells, mode);

  const currentVersion = game.settings.get(MODULE_ID, `${packName}Version`);
  const index = await pack.getIndex();
  const indexSize = index.size ?? index.length ?? 0;
  if (currentVersion === PACK_VERSION && indexSize === items.length) {
    return;
  }

  const wasLocked = pack.locked;
  await pack.configure({ locked: false });
  await clearPack(pack);
  await createFolders(pack, folderSpecs);

  const batchSize = 100;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize).map((spell) => foundry.utils.deepClone(spell));
    await Item.createDocuments(batch, { pack: pack.collection, keepId: true });
  }

  await game.settings.set(MODULE_ID, `${packName}Version`, PACK_VERSION);
  await pack.configure({ locked: wasLocked });
}

async function ensureCompendiaPopulated() {
  const primaryGm = game.users.filter((user) => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!game.user.isGM || primaryGm?.id !== game.user.id) return;

  const data = await loadSpells();
  const packData = {
    ...data,
    wild: [...(data.arcane ?? []), ...(data.divine ?? [])].filter(isWildSpell),
    mission: (data.divine ?? []).filter(isMissionSpell),
    cooperative: (data.divine ?? []).filter(isCooperativeSpell),
  };
  for (const config of PACK_CONFIGS) {
    await populatePack(config, packData[config.dataKey]);
  }
  await populateTablesPack();
  await populateRulesPack();
  await ensurePublicRulesJournals();
}

async function populateTablesPack() {
  const packName = "tables";
  const pack = game.packs.get(`${MODULE_ID}.${packName}`);
  if (!pack) {
    console.warn(`${MODULE_ID} | Compendio nao encontrado: ${packName}`);
    return;
  }

  const currentVersion = game.settings.get(MODULE_ID, `${packName}Version`);
  const index = await pack.getIndex();
  const indexSize = index.size ?? index.length ?? 0;
  const tables = tablesForPack();
  if (currentVersion === PACK_VERSION && indexSize === tables.length) {
    return;
  }

  const wasLocked = pack.locked;
  await pack.configure({ locked: false });
  await clearPack(pack, RollTable);
  await RollTable.createDocuments(tables, { pack: pack.collection, keepId: true });
  await game.settings.set(MODULE_ID, `${packName}Version`, PACK_VERSION);
  await pack.configure({ locked: wasLocked });
}

async function populateRulesPack() {
  const packName = "rules";
  const pack = game.packs.get(`${MODULE_ID}.${packName}`);
  if (!pack) {
    console.warn(`${MODULE_ID} | Compendio nao encontrado: ${packName}`);
    return;
  }

  const rules = await loadRules();
  const journals = rulesJournals(rules);
  const currentVersion = game.settings.get(MODULE_ID, `${packName}Version`);
  const index = await pack.getIndex();
  const indexSize = index.size ?? index.length ?? 0;
  if (currentVersion === PACK_VERSION && indexSize === journals.length) {
    return;
  }

  const wasLocked = pack.locked;
  await pack.configure({ locked: false });
  await clearPack(pack, JournalEntry);
  await JournalEntry.createDocuments(journals, { pack: pack.collection, keepId: true });
  await game.settings.set(MODULE_ID, `${packName}Version`, PACK_VERSION);
  await pack.configure({ locked: wasLocked });
}

async function ensurePublicRulesJournals() {
  const currentVersion = game.settings.get(MODULE_ID, "worldRulesVersion");
  const needsUpdate = currentVersion !== PACK_VERSION;

  const rules = await loadRules();
  const folderName = "Tomo de Magia - Regras";
  let folder = game.folders.find((candidate) => candidate.type === "JournalEntry" && candidate.name === folderName);
  if (!folder) {
    folder = await Folder.create({
      name: folderName,
      type: "JournalEntry",
      sorting: "a",
      color: "#6f2138",
      flags: {
        [MODULE_ID]: {
          generated: true,
        },
      },
    });
  }

  for (const journalData of rulesJournals(rules)) {
    const ruleId = journalData.flags?.[MODULE_ID]?.ruleId;
    const matches = game.journal.filter((entry) => entry.getFlag(MODULE_ID, "ruleId") === ruleId);
    const existing = matches[0];
    const payload = {
      ...journalData,
      folder: folder.id,
      ownership: {
        default: 2,
      },
    };
    delete payload._id;

    if (existing && (needsUpdate || existing.folder?.id !== folder.id)) {
      await existing.update(payload, { diff: false, recursive: false });
    } else if (!existing) {
      await JournalEntry.create(payload);
    }
    const duplicateIds = matches.slice(1).map((entry) => entry.id);
    if (duplicateIds.length) await JournalEntry.deleteDocuments(duplicateIds);
  }

  await game.settings.set(MODULE_ID, "worldRulesVersion", PACK_VERSION);
}

async function browserContext(filters) {
  const data = await loadSpells();
  const all = data[filters.tradition] ?? [];
  const filtered = all.filter((spell) => {
    const meta = metaOf(spell);
    const haystack = [spell.name, spell.system?.description, meta.fonte, ...(meta.escolas ?? []), ...(meta.esferas ?? [])]
      .join(" ").toLocaleLowerCase("pt-BR");
    return (!filters.query || haystack.includes(filters.query.toLocaleLowerCase("pt-BR")))
      && (!filters.circle || meta.circulo === filters.circle)
      && (!filters.school || (meta.escolas ?? []).includes(filters.school))
      && (!filters.sphere || (meta.esferas ?? []).includes(filters.sphere));
  }).map((spell) => {
    const copy = foundry.utils.deepClone(spell);
    copy.tomoMeta = metaOf(spell);
    return copy;
  });
  const grouped = filtered.reduce((acc, spell) => {
    const circle = metaOf(spell).circulo || "?";
    acc[circle] ??= [];
    acc[circle].push(spell);
    return acc;
  }, {});
  return {
    filters, traditions: traditionLabels,
    circles: uniq(all.map((spell) => metaOf(spell).circulo)).sort((a, b) => Number(a) - Number(b)),
    schools: uniq(all.flatMap((spell) => metaOf(spell).escolas ?? [])),
    spheres: uniq((data.divine ?? []).flatMap((spell) => metaOf(spell).esferas ?? [])),
    grouped, total: all.length, shown: filtered.length,
    isDivine: filters.tradition === "divine",
  };
}

function initialBrowserFilters() {
  return { tradition: "arcane", query: "", circle: "", school: "", sphere: "" };
}

async function spellFromBrowserElement(element) {
  const id = element.closest("[data-spell-id]").dataset.spellId;
  const data = await loadSpells();
  return [...data.arcane, ...data.divine].find((spell) => spell._id === id);
}

const BaseApplication = foundry.appv1?.api?.Application ?? globalThis.Application;

class TomoDeMagiaBrowser extends BaseApplication {
  constructor(options = {}) {
    super(options);
    this.filters = initialBrowserFilters();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "tomo-de-magia-browser",
      title: "Tomo de Magia",
      template: `modules/${MODULE_ID}/scripts/features/spell-tome/browser.hbs`,
      width: 920,
      height: 720,
      resizable: true,
      classes: ["tomo-de-magia"],
    });
  }

  async getData() {
    return browserContext(this.filters);
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("[data-filter]").on("input change click", (event) => {
      const input = event.currentTarget;
      this.filters[input.dataset.filter] = input.value;
      if (input.dataset.filter === "tradition" && input.value === "arcane") {
        this.filters.sphere = "";
      }
      this.render();
    });

    html.find(".tomo-spell-row").each((_, row) => {
      row.addEventListener("dragstart", async (event) => {
        const spell = await this._spellFromElement(row);
        event.dataTransfer.setData("text/plain", JSON.stringify(toDropData(spell)));
      });
    });

    html.find("[data-action='add']").click(async (event) => {
      const spell = await this._spellFromElement(event.currentTarget);
      await addSpellToActor(spell);
    });

    html.find("[data-action='preview']").click(async (event) => {
      const spell = await this._spellFromElement(event.currentTarget);
      const item = new Item.implementation(foundry.utils.deepClone(spell), { temporary: true });
      item.sheet.render(true);
    });
  }

  async _spellFromElement(element) {
    return spellFromBrowserElement(element);
  }
}

const ApplicationV2 = foundry.applications?.api?.ApplicationV2;
const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;
const TomoDeMagiaBrowserV2 = ApplicationV2 && HandlebarsApplicationMixin
  ? class extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "tomo-de-magia-browser",
      classes: ["tomo-de-magia"],
      position: { width: 920, height: 720 },
      window: { title: "Tomo de Magia", resizable: true },
    };
    static PARTS = { main: { template: `modules/${MODULE_ID}/scripts/features/spell-tome/browser.hbs` } };

    constructor(options = {}) {
      super(options);
      this.filters = initialBrowserFilters();
    }

    async _prepareContext() {
      return browserContext(this.filters);
    }

    _onRender(context, options) {
      super._onRender(context, options);
      const root = this.element;
      root.querySelectorAll("[data-filter]").forEach((input) => {
        for (const eventName of ["input", "change", "click"]) input.addEventListener(eventName, () => {
          this.filters[input.dataset.filter] = input.value;
          if (input.dataset.filter === "tradition" && input.value === "arcane") this.filters.sphere = "";
          this.render();
        });
      });
      root.querySelectorAll(".tomo-spell-row").forEach((row) => row.addEventListener("dragstart", async (event) => {
        const spell = await spellFromBrowserElement(row);
        event.dataTransfer.setData("text/plain", JSON.stringify(toDropData(spell)));
      }));
      root.querySelectorAll("[data-action='add']").forEach((button) => button.addEventListener("click", async () => {
        await addSpellToActor(await spellFromBrowserElement(button));
      }));
      root.querySelectorAll("[data-action='preview']").forEach((button) => button.addEventListener("click", async () => {
        const spell = await spellFromBrowserElement(button);
        new Item.implementation(foundry.utils.deepClone(spell), { temporary: true }).sheet.render(true);
      }));
    }
  }
  : null;

function openSpellBrowser() {
  if (Number(game.release?.generation ?? 13) >= 14 && TomoDeMagiaBrowserV2) {
    return new TomoDeMagiaBrowserV2().render({ force: true });
  }
  return new TomoDeMagiaBrowser().render(true);
}

function wildVariationFor(spell, d20) {
  const meta = metaOf(spell);
  const spellLevel = Number(meta.circulo ?? spell.system?.arcane ?? spell.system?.divine ?? 1);
  const rowLevel = Math.min(Math.max(spellLevel || 1, 1), 9);
  const modifier = WILD_LEVEL_VARIATION[rowLevel][d20 - 1];
  const numericModifier = Number(modifier.replace("+", ""));
  const realLevel = Number.isFinite(numericModifier) ? Math.max(1, spellLevel + numericModifier) : null;

  return {
    spellLevel,
    rowLabel: rowLevel === 9 ? "9+" : String(rowLevel),
    modifier,
    realLevel,
    surge: WILD_SURGE_CELLS.has(`${rowLevel}:${d20}`),
  };
}

async function rollWildLevelVariation(spell, actor) {
  const roll = Number(game.release?.generation ?? 13) >= 14
    ? await new Roll("1d20").evaluate()
    : await new Roll("1d20").roll({ async: true });
  const d20 = roll.total;
  const variation = wildVariationFor(spell, d20);
  const realLevelText = variation.realLevel ? `${variation.realLevel}º circulo` : `especial (${variation.modifier})`;
  const rolls = [roll];
  let surgeRoll = null;
  let surgeResult = "";

  if (variation.surge) {
    surgeRoll = Number(game.release?.generation ?? 13) >= 14
      ? await new Roll("1d100").evaluate()
      : await new Roll("1d100").roll({ async: true });
    rolls.push(surgeRoll);
    surgeResult = WILD_SURGE_RESULTS[surgeRoll.total - 1] ?? "Resultado nao encontrado.";
  }

  const content = `
    <h2>Magia Selvagem: Variacao de Nivel</h2>
    <p><strong>${spell.name}</strong>${actor ? ` (${actor.name})` : ""}</p>
    <table>
      <tbody>
        <tr><th>Nivel da magia</th><td>${variation.spellLevel}º circulo</td></tr>
        <tr><th>Rolagem d20</th><td>${d20}</td></tr>
        <tr><th>Modificador</th><td>${variation.modifier}</td></tr>
        <tr><th>Nivel real</th><td><strong>${realLevelText}</strong></td></tr>
        <tr><th>Surto Selvagem</th><td>${variation.surge ? "Sim" : "Nao"}</td></tr>
        ${
          variation.surge
            ? `<tr><th>Rolagem d100</th><td>${surgeRoll.total}</td></tr><tr><th>Resultado do surto</th><td><strong>${surgeResult}</strong></td></tr>`
            : ""
        }
      </tbody>
    </table>
  `;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls,
    flavor: `Variacao de Nivel - ${spell.name}`,
    content,
  });
}

function addWildSpellCastHandler(app, html) {
  if (!enabled()) return;
  const actor = app.actor;
  if (!actor?.items) return;

  html.find(".spell-cast").on("click.tomo-de-magia", (event) => {
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset?.itemId;
    const spell = actor.items.get(itemId);
    if (!spell || !isWildSpell(spell)) return;

    window.setTimeout(() => {
      rollWildLevelVariation(spell, actor).catch((error) => {
        console.error(`${MODULE_ID} | Falha ao rolar variacao selvagem`, error);
        ui.notifications.error("Tomo de Magia: nao foi possivel rolar a variacao selvagem.");
      });
    }, 250);
  });
}

Hooks.once("init", () => {
  for (const { name } of PACK_CONFIGS) {
    const key = `${name}Version`;
    game.settings.register(MODULE_ID, key, {
      scope: "world",
      config: false,
      type: String,
      default: "",
    });
  }
  game.settings.register(MODULE_ID, "tablesVersion", {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });
  game.settings.register(MODULE_ID, "rulesVersion", {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });
  game.settings.register(MODULE_ID, "worldRulesVersion", {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });
});

Hooks.once("ready", () => {
  game.od2Qdv ??= {};
  game.od2Qdv.spellTome = {
    open: openSpellBrowser,
    loadSpells,
    loadRules,
    populateCompendia: ensureCompendiaPopulated,
  };

  if (game.settings.get(MODULE_ID, "enableSpellTome") && game.modules.get(SOURCE_FLAG_ID)?.active) {
    if (game.user.isGM) {
      ui.notifications.warn("Tomo de Magia: desative o módulo separado tomo-de-magia-od2 para usar a versão incorporada ao QdV sem duplicidades.");
    }
    return;
  }
  if (!enabled()) return;
  ensureCompendiaPopulated().catch((error) => {
    console.error(`${MODULE_ID} | Falha ao popular compendios`, error);
    if (game.user.isGM) {
      ui.notifications.error("Tomo de Magia: nao foi possivel popular os compendios. Veja o console do Foundry.");
    }
  });
});

Hooks.on("renderActorSheet", addWildSpellCastHandler);
