import {
  ATTRIBUTES, ATTRIBUTE_LABELS, allocationFromDice, calculateHitPoints,
  classAllowsRace, experienceForLevel, hitDieForClass, racialAttributes
} from "./model.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const SOCKET = `module.${MODULE_ID}`;
const pendingApprovals = new Map();
const STYLES = {
  classic: ["Estilo Clássico", "3d6 em ordem: FOR, DES, CON, INT, SAB e CAR."],
  adventurer: ["Estilo Aventureiro", "3d6 seis vezes e distribua os resultados como desejar."],
  heroic: ["Estilo Heroico", "4d6, descartando o menor dado, seis vezes; distribua como desejar."],
  double: ["Estilo 3d6 Duplo", "Duas rolagens de 3d6 para cada atributo; use a maior."],
  peasant: ["Estilo Camponês", "1d6+7 seis vezes e distribua como desejar."],
  distribution: ["Estilo da Distribuição", "Distribua sete resultados de d6, partindo de 8 em cada atributo (máximo 18)."],
  racial: ["Estilo Racial", "2d6+6 no atributo forte, 2d6+3 no fraco e 3d6 nos demais."],
};

function enabled() {
  return game.system.id === "olddragon2e" && game.settings.get(MODULE_ID, "enableCharacterGenerator");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function dialogV2() {
  return Number(game.release?.generation ?? 13) >= 14 ? foundry.applications?.api?.DialogV2 : null;
}

function primaryActiveGm() {
  return game.users.filter((user) => user.isGM && user.active).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

function approvalLabel(kind) {
  return ({ start: "iniciar a criação do personagem", attributes: "rerrolar os atributos", hp: "rerrolar os pontos de vida", final: "criar o personagem apresentado" })[kind] ?? kind;
}

function approvalTitle(kind) {
  return ({
    start: "Autorização para criar personagem",
    attributes: "Autorização para rerrolar atributos",
    hp: "Autorização para rerrolar pontos de vida",
    final: "Aprovação final do personagem"
  })[kind] ?? "Solicitação do gerador de personagens";
}

async function requestGmApproval(kind, data = {}) {
  if (game.user.isGM) return { approved: true };
  const gm = primaryActiveGm();
  if (!gm) {
    ui.notifications.warn("Nenhum Mestre está conectado para autorizar esta ação.");
    return { approved: false };
  }
  const requestId = foundry.utils.randomID();
  const response = new Promise((resolve) => pendingApprovals.set(requestId, resolve));
  game.socket.emit(SOCKET, { type: "approvalRequest", requestId, kind, data, userId: game.user.id, userName: game.user.name, gmId: gm.id });
  ui.notifications.info("Solicitação enviada ao Mestre. Aguarde a resposta.");
  return response;
}

async function receiveApprovalRequest(payload) {
  if (!game.user.isGM || game.user.id !== payload.gmId) return;
  const summary = payload.kind === "final" ? finalSummaryHtml(payload.data) : "";
  const character = payload.data?.characterName ? ` para <strong>${escapeHtml(payload.data.characterName)}</strong>` : "";
  const content = `<div class="od2qdv-character-approval"><h2>${approvalTitle(payload.kind)}</h2><p><strong>${escapeHtml(payload.userName)}</strong> solicita autorização para <strong>${approvalLabel(payload.kind)}</strong>${character}.</p>${summary}<div class="od2qdv-approval-actions"><button type="button" data-character-approval="approve"><i class="fas fa-check"></i> Autorizar</button><button type="button" data-character-approval="deny"><i class="fas fa-times"></i> Recusar</button></div></div>`;
  await ChatMessage.create({
    content, whisper: [game.user.id],
    flags: { [MODULE_ID]: { characterApproval: payload, approvalResolved: false } }
  });
}

async function respondToApproval(message, approved, buttonRoot) {
  const payload = message.getFlag(MODULE_ID, "characterApproval");
  if (!payload || message.getFlag(MODULE_ID, "approvalResolved")) return;
  buttonRoot.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  let actorId = null;
  let error = null;
  if (approved && payload.kind === "final") {
    try { actorId = (await createCharacterFromDraft(payload.data)).id; }
    catch (caught) { error = caught.message; approved = false; console.error(`${MODULE_ID} | Falha ao criar personagem aprovado`, caught); }
  }
  await message.setFlag(MODULE_ID, "approvalResolved", true);
  await message.update({ content: `${message.content}<p><strong>${approved ? "Autorizado" : "Recusado"}${error ? `: ${escapeHtml(error)}` : ""}.</strong></p>` });
  game.socket.emit(SOCKET, { type: "approvalResponse", requestId: payload.requestId, userId: payload.userId, approved, actorId, error });
}

function receiveApprovalResponse(payload) {
  if (payload.userId !== game.user.id) return;
  const resolve = pendingApprovals.get(payload.requestId);
  if (!resolve) return;
  pendingApprovals.delete(payload.requestId);
  resolve(payload);
}

function bindApprovalMessage(message, html) {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const actions = root?.querySelector(".od2qdv-approval-actions");
  if (!actions) return;
  actions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-character-approval]");
    if (!button) return;
    respondToApproval(message, button.dataset.characterApproval === "approve", actions);
  });
}

async function prompt({ title, content, label = "Continuar", read, render }) {
  const V2 = dialogV2();
  if (V2) return V2.prompt({
    window: { title }, content,
    ok: { label, callback: (_event, button) => read(button.form) },
    render: render ? (_event, dialog) => render(dialog.element) : undefined
  });
  return (foundry.appv1?.api?.Dialog ?? globalThis.Dialog).prompt({
    title, content: `<form>${content}</form>`, label,
    callback: (html) => read(html[0].querySelector("form")),
    render: render ? (html) => render(html[0]) : undefined,
    rejectClose: false
  });
}

async function confirm({ title, content, yes = "Confirmar" }) {
  const V2 = dialogV2();
  if (V2) return V2.confirm({ window: { title }, content, yes: { label: yes, default: true }, no: { label: "Voltar", default: false } });
  return (foundry.appv1?.api?.Dialog ?? globalThis.Dialog).confirm({ title, content, defaultYes: true });
}

async function roll(formula) {
  const result = new Roll(formula);
  if (Number(game.release?.generation ?? 13) >= 14) await result.evaluate();
  else await result.roll({ async: true });
  return result;
}

async function documentsFromPack(name, type) {
  const pack = game.packs.get(`${game.system.id}.${name}`);
  if (!pack) throw new Error(`Compêndio ${name} não encontrado.`);
  const documents = await pack.getDocuments();
  return documents.filter((document) => document.type === type).sort((a, b) => a.name.localeCompare(b.name));
}

async function identityStep(races, playerMode = false) {
  const users = game.users.filter((user) => !user.isGM).sort((a, b) => a.name.localeCompare(b.name));
  const userOptions = [`<option value="">Somente o Mestre</option>`, ...users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`)].join("");
  const raceOptions = races.map((race) => `<option value="${race.id}">${escapeHtml(race.name)}</option>`).join("");
  return prompt({
    title: "Criar novo personagem",
    content: `<div class="od2qdv-character-step"><div class="form-group"><label>Nome do personagem</label><input name="name" required autofocus></div>${playerMode ? `<input type="hidden" name="owner" value="${game.user.id}"><p>Jogador dono: <strong>${escapeHtml(game.user.name)}</strong></p>` : `<div class="form-group"><label>Jogador dono</label><select name="owner">${userOptions}</select></div>`}<div class="form-group"><label>Raça (SRD)</label><select name="race">${raceOptions}</select></div></div>`,
    read: (form) => ({ name: form.elements.name.value.trim(), ownerId: form.elements.owner.value, raceId: form.elements.race.value })
  });
}

async function styleStep() {
  const options = Object.entries(STYLES).map(([key, [name, description]]) => `<label class="od2qdv-roll-style"><input type="radio" name="style" value="${key}" ${key === "adventurer" ? "checked" : ""}><span><strong>${name}</strong><small>${description}</small></span></label>`).join("");
  return prompt({ title: "Rolando atributos", content: `<p>Escolha o estilo definido pelo Mestre para o grupo.</p><div class="od2qdv-roll-styles">${options}</div>`, label: "Rolar atributos", read: (form) => form.elements.style.value });
}

async function racialChoice(raceName) {
  const fixed = racialAttributes(raceName);
  if (fixed) return fixed;
  const options = ATTRIBUTES.map((key) => `<option value="${key}">${ATTRIBUTE_LABELS[key]}</option>`).join("");
  while (true) {
    const choice = await prompt({
      title: `Estilo Racial — ${raceName}`,
      content: `<p>Escolha atributos diferentes antes das rolagens.</p><div class="form-group"><label>Atributo forte (2d6+6)</label><select name="strong">${options}</select></div><div class="form-group"><label>Atributo fraco (2d6+3)</label><select name="weak">${options}</select></div>`,
      read: (form) => ({ strong: form.elements.strong.value, weak: form.elements.weak.value })
    });
    if (!choice) return null;
    if (choice.strong !== choice.weak) return choice;
    ui.notifications.warn("O atributo forte e o atributo fraco devem ser diferentes.");
  }
}

async function rollAttributes(style, raceName) {
  if (style === "distribution") {
    const dice = [];
    for (let i = 0; i < 7; i += 1) dice.push((await roll("1d6")).total);
    return distributeDice(dice);
  }
  const results = [];
  if (style === "racial") {
    const racial = await racialChoice(raceName);
    if (!racial) return null;
    const values = {};
    values[racial.strong] = (await roll("2d6+6")).total;
    values[racial.weak] = (await roll("2d6+3")).total;
    for (const attribute of ATTRIBUTES.filter((key) => ![racial.strong, racial.weak].includes(key))) values[attribute] = (await roll("3d6")).total;
    return confirmAttributes(values, `${STYLES[style][0]} — ${raceName}`);
  }
  for (let index = 0; index < 6; index += 1) {
    if (style === "heroic") {
      const dice = Array.from((await roll("4d6")).dice[0].results, (entry) => entry.result).sort((a, b) => a - b);
      results.push(dice.slice(1).reduce((sum, value) => sum + value, 0));
    } else if (style === "double") {
      results.push(Math.max((await roll("3d6")).total, (await roll("3d6")).total));
    } else if (style === "peasant") results.push((await roll("1d6+7")).total);
    else results.push((await roll("3d6")).total);
  }
  if (["classic", "double"].includes(style)) return confirmAttributes(Object.fromEntries(ATTRIBUTES.map((key, index) => [key, results[index]])), STYLES[style][0]);
  return distributeResults(results, STYLES[style][0]);
}

async function confirmAttributes(values, title) {
  const rows = ATTRIBUTES.map((key) => `<tr><th>${ATTRIBUTE_LABELS[key]}</th><td>${values[key]}</td></tr>`).join("");
  return await confirm({ title, content: `<p>Confirme os atributos rolados.</p><table>${rows}</table>` }) ? values : null;
}

async function attributeDecision(values) {
  const rows = ATTRIBUTES.map((key) => `<tr><th>${ATTRIBUTE_LABELS[key]}</th><td>${values[key]}</td></tr>`).join("");
  const content = `<p>Confirme estes valores ou solicite uma nova rolagem.</p><table>${rows}</table>`;
  const V2 = dialogV2();
  if (V2) return V2.wait({
    window: { title: "Atributos finais" }, content,
    buttons: [
      { action: "confirm", icon: "fa-solid fa-check", label: "Confirmar atributos", default: true, callback: () => "confirm" },
      { action: "reroll", icon: "fa-solid fa-dice", label: "Rerrolar atributos", callback: () => "reroll" },
      { action: "cancel", icon: "fa-solid fa-times", label: "Cancelar", type: "button", callback: () => "cancel" }
    ]
  });
  const DialogClass = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  return new Promise((resolve) => new DialogClass({
    title: "Atributos finais", content,
    buttons: {
      confirm: { label: "Confirmar atributos", callback: () => resolve("confirm") },
      reroll: { label: "Rerrolar atributos", callback: () => resolve("reroll") },
      cancel: { label: "Cancelar", callback: () => resolve("cancel") }
    }, default: "confirm", close: () => resolve("cancel")
  }).render(true));
}

async function distributeResults(results, title) {
  const options = (selected) => results.map((value, index) => `<option value="${index}" ${index === selected ? "selected" : ""}>${value}</option>`).join("");
  while (true) {
    const assignment = await prompt({
      title: `${title} — Distribuir resultados`,
      content: `<p>Escolher um resultado já alocado troca os valores entre os atributos.</p><div class="od2qdv-roll-allocation-summary">${results.map((value, index) => `<span data-roll-summary="${index}"><strong>${value}</strong><small>${ATTRIBUTE_LABELS[ATTRIBUTES[index]]}</small></span>`).join("")}</div>${ATTRIBUTES.map((key, index) => `<div class="form-group"><label>${ATTRIBUTE_LABELS[key]}</label><select name="${key}" data-allocation-select>${options(index)}</select></div>`).join("")}`,
      label: "Confirmar atributos",
      read: (form) => Object.fromEntries(ATTRIBUTES.map((key) => [key, Number(form.elements[key].value)])),
      render: bindAllocationSwaps
    });
    if (!assignment) return null;
    if (new Set(Object.values(assignment)).size === 6) {
      const values = Object.fromEntries(ATTRIBUTES.map((key) => [key, results[assignment[key]]]));
      if (await confirmAttributes(values, title)) return values;
      continue;
    }
    ui.notifications.warn("Cada resultado deve ser usado exatamente uma vez.");
  }
}

function bindAllocationSwaps(root) {
  const selects = Array.from(root.querySelectorAll("[data-allocation-select]"));
  const refresh = () => {
    selects.forEach((select) => { select.dataset.previousValue = select.value; });
    root.querySelectorAll("[data-roll-summary]").forEach((summary) => {
      const owner = selects.find((select) => select.value === summary.dataset.rollSummary);
      summary.querySelector("small").textContent = owner ? ATTRIBUTE_LABELS[owner.name] : "Não alocado";
    });
  };
  selects.forEach((select) => select.addEventListener("change", () => {
    const previous = select.dataset.previousValue;
    const duplicate = selects.find((candidate) => candidate !== select && candidate.value === select.value);
    if (duplicate) duplicate.value = previous;
    refresh();
  }));
  refresh();
}

async function distributeDice(dice) {
  const options = ATTRIBUTES.map((key) => `<option value="${key}">${ATTRIBUTE_LABELS[key]}</option>`).join("");
  while (true) {
    const assignments = await prompt({
      title: "Estilo da Distribuição",
      content: `<p>Todos começam em 8. Distribua cada dado sem ultrapassar 18.</p>${dice.map((die, index) => `<div class="form-group"><label>Dado ${index + 1}: ${die}</label><select name="die${index}">${options}</select></div>`).join("")}`,
      label: "Confirmar distribuição", read: (form) => dice.map((_, index) => form.elements[`die${index}`].value)
    });
    if (!assignments) return null;
    const values = allocationFromDice(dice, assignments);
    if (Object.values(values).every((value) => value <= 18)) {
      if (await confirmAttributes(values, "Estilo da Distribuição")) return values;
      continue;
    }
    ui.notifications.warn("Nenhum atributo pode ser maior que 18.");
  }
}

async function classAndLevelStep(classes, race) {
  const allowed = classes.filter((characterClass) => classAllowsRace(characterClass, race.name));
  const options = allowed.map((characterClass) => `<option value="${characterClass.id}">${escapeHtml(characterClass.name)}</option>`).join("");
  return prompt({
    title: "Classe e nível",
    content: `<p>As restrições raciais das classes do SRD já foram aplicadas.</p><div class="form-group"><label>Classe</label><select name="classId">${options}</select></div><div class="form-group"><label>Nível</label><input name="level" type="number" min="1" max="15" value="1"></div>`,
    read: (form) => ({ classId: form.elements.classId.value, level: Math.min(15, Math.max(1, Math.trunc(Number(form.elements.level.value) || 1))) })
  });
}

async function hitPointsStep(characterClass, level, constitution, authorizeReroll = async () => true) {
  const die = hitDieForClass(characterClass);
  while (true) {
    const rolls = [];
    for (let current = 2; current <= level; current += 1) rolls.push((await roll(`1d${die}`)).total);
    const suggested = calculateHitPoints(die, level, constitution, rolls);
    const content = `<p>1º nível: máximo do d${die}. Demais níveis: ${rolls.length ? rolls.join(", ") : "nenhuma rolagem"}. O modificador de Constituição foi aplicado por nível.</p><div class="form-group"><label>PV total</label><input name="hp" type="number" min="1" value="${suggested}"></div>`;
    while (true) {
      const decision = await hitPointDecision(content, suggested, level > 1);
      if (!decision || decision.action === "cancel") return null;
      if (decision.action === "confirm") return decision.hp;
      if (await authorizeReroll()) break;
      ui.notifications.warn("O Mestre não autorizou a rerrolagem dos pontos de vida.");
    }
  }
}

async function hitPointDecision(content, suggested, canReroll) {
  const readHp = (form) => Math.max(1, Math.trunc(Number(form.elements.hp.value) || suggested));
  const V2 = dialogV2();
  if (V2) {
    return V2.wait({
      window: { title: "Pontos de Vida" }, content,
      buttons: [
        { action: "confirm", icon: "fa-solid fa-check", label: "Confirmar PV", default: true, callback: (_event, button) => ({ action: "confirm", hp: readHp(button.form) }) },
        ...(canReroll ? [{ action: "reroll", icon: "fa-solid fa-dice", label: "Rerrolar PV", callback: () => ({ action: "reroll" }) }] : []),
        { action: "cancel", icon: "fa-solid fa-times", label: "Cancelar", type: "button", callback: () => ({ action: "cancel" }) }
      ]
    });
  }
  const DialogClass = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  return new Promise((resolve) => new DialogClass({
    title: "Pontos de Vida", content: `<form>${content}</form>`,
    buttons: {
      confirm: { icon: '<i class="fas fa-check"></i>', label: "Confirmar PV", callback: (html) => resolve({ action: "confirm", hp: readHp(html[0].querySelector("form")) }) },
      ...(canReroll ? { reroll: { icon: '<i class="fas fa-dice"></i>', label: "Rerrolar PV", callback: () => resolve({ action: "reroll" }) } } : {}),
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar", callback: () => resolve({ action: "cancel" }) }
    },
    default: "confirm", close: () => resolve(null)
  }).render(true));
}

async function incomeStep() {
  const formula = await prompt({ title: "Renda inicial", content: `<p>Confirme ou altere a fórmula da renda inicial.</p><div class="form-group"><label>Fórmula em PO</label><input name="formula" value="3d6*10"></div>`, label: "Rolar renda", read: (form) => form.elements.formula.value.trim() });
  if (!formula) return null;
  let result;
  try { result = await roll(formula); }
  catch { ui.notifications.error("Fórmula de renda inválida."); return incomeStep(); }
  return prompt({ title: "Confirmar renda inicial", content: `<p>Resultado de <strong>${escapeHtml(formula)}</strong>: ${result.total} PO.</p><div class="form-group"><label>PO inicial</label><input name="income" type="number" min="0" value="${Math.max(0, Math.trunc(result.total))}"></div>`, label: "Adicionar PO", read: (form) => Math.max(0, Math.trunc(Number(form.elements.income.value) || 0)) });
}

function embeddedSource(document) {
  const data = document.toObject();
  delete data._id;
  return data;
}

async function chooseAttributes(style, raceName, characterName) {
  while (true) {
    const values = await rollAttributes(style, raceName);
    if (!values) return null;
    while (true) {
      const decision = await attributeDecision(values);
      if (!decision || decision === "cancel") return null;
      if (decision === "confirm") return values;
      const response = await requestGmApproval("attributes", { characterName });
      if (response.approved) break;
      ui.notifications.warn("O Mestre não autorizou a rerrolagem dos atributos.");
    }
  }
}

function finalSummaryHtml(draft) {
  const rows = ATTRIBUTES.map((key) => `<tr><th>${ATTRIBUTE_LABELS[key]}</th><td>${draft.attributes[key]}</td></tr>`).join("");
  return `<div class="od2qdv-character-summary"><h3>${escapeHtml(draft.name)}</h3><p><strong>Raça:</strong> ${escapeHtml(draft.raceName)} · <strong>Classe:</strong> ${escapeHtml(draft.className)} · <strong>Nível:</strong> ${draft.level}</p><p><strong>XP:</strong> ${draft.xp} · <strong>PV:</strong> ${draft.hp} · <strong>Renda:</strong> ${draft.income} PO</p><table>${rows}</table></div>`;
}

async function createCharacterFromDraft(draft) {
  const [races, classes] = await Promise.all([documentsFromPack("races", "race"), documentsFromPack("classes", "class")]);
  const race = races.find((entry) => entry.id === draft.raceId);
  const characterClass = classes.find((entry) => entry.id === draft.classId);
  if (!race || !characterClass) throw new Error("Raça ou classe do SRD não encontrada.");
  const ownership = draft.ownerId ? { default: 0, [draft.ownerId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } : { default: 0 };
  const actor = await Actor.create({ name: draft.name, type: "character", ownership });
  await actor.createEmbeddedDocuments("Item", [embeddedSource(race)]);
  await actor.system.syncRaceAbilities?.();
  await actor.createEmbeddedDocuments("Item", [embeddedSource(characterClass)]);
  await actor.system.syncClassAbilities?.();
  await actor.update({
    ...Object.fromEntries(ATTRIBUTES.map((key) => [`system.${key}`, draft.attributes[key]])),
    "system.level": draft.level, "system.current_xp": draft.xp,
    "system.hp.value": draft.hp, "system.hp.max": draft.hp, "system.economy.gp": draft.income
  });
  await ChatMessage.create({ content: `<div class="od2qdv-character-success"><h2>Personagem criado com sucesso!</h2><p><strong>${escapeHtml(actor.name)}</strong> está no nível ${draft.level}, com ${draft.hp} PV e ${draft.income} PO.</p><p>Equipe o personagem e selecione as magias permitidas pela classe.</p></div>` });
  return actor;
}

async function generateCharacter() {
  const playerMode = !game.user.isGM;
  if (playerMode) {
    const start = await requestGmApproval("start");
    if (!start.approved) return ui.notifications.warn("O Mestre não autorizou o início da criação.");
  }
  const [races, classes] = await Promise.all([documentsFromPack("races", "race"), documentsFromPack("classes", "class")]);
  const identity = await identityStep(races, playerMode);
  if (!identity?.name) return;
  const race = races.find((entry) => entry.id === identity.raceId);
  if (!race) return ui.notifications.error("Raça não encontrada.");
  try {
    const style = await styleStep();
    if (!style) return;
    const attributes = await chooseAttributes(style, race.name, identity.name);
    if (!attributes) return;
    const selection = await classAndLevelStep(classes, race);
    if (!selection) return;
    const characterClass = classes.find((entry) => entry.id === selection.classId);
    if (!characterClass) throw new Error("Classe não encontrada.");
    const xp = experienceForLevel(characterClass, selection.level);
    const hp = await hitPointsStep(characterClass, selection.level, attributes.constituicao, async () => (await requestGmApproval("hp", { characterName: identity.name })).approved);
    if (hp == null) return;
    const income = await incomeStep();
    if (income == null) return;
    const draft = { name: identity.name, ownerId: identity.ownerId, raceId: race.id, raceName: race.name, classId: characterClass.id, className: characterClass.name, level: selection.level, xp, hp, income, attributes };
    if (playerMode) {
      const response = await requestGmApproval("final", draft);
      if (!response.approved) return ui.notifications.warn(response.error ? `A criação falhou: ${response.error}` : "O Mestre recusou a criação final do personagem.");
      ui.notifications.info("Personagem criado com sucesso pelo Mestre.");
      return;
    }
    const actor = await createCharacterFromDraft(draft);
    actor.sheet.render(true);
  } catch (error) {
    console.error(`${MODULE_ID} | Falha ao gerar personagem`, error);
    ui.notifications.error(`Não foi possível concluir o personagem: ${error.message}`);
  }
}

function addDirectoryButton(app, html) {
  if (!enabled()) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  root.querySelector(".od2qdv-character-generator")?.remove();
  const directoryHeader = root.querySelector(".directory-header");
  if (!directoryHeader?.parentNode) return;
  const section = document.createElement("header");
  section.classList.add("od2qdv-character-generator", "directory-header");
  section.innerHTML = '<div class="header-actions action-buttons flexrow"><button type="button" class="od2qdv-create-character"><i class="fas fa-user-plus"></i> Criar novo personagem</button></div>';
  directoryHeader.parentNode.insertBefore(section, directoryHeader);
  section.querySelector(".od2qdv-create-character").addEventListener("click", () => generateCharacter());
}

Hooks.on("renderActorDirectory", addDirectoryButton);
Hooks.on("renderActorDirectoryV2", addDirectoryButton);
Hooks.on(foundry.applications?.api?.ApplicationV2 ? "renderChatMessageHTML" : "renderChatMessage", bindApprovalMessage);

Hooks.once("ready", () => {
  game.socket.on(SOCKET, (payload) => {
    if (payload.type === "approvalRequest") receiveApprovalRequest(payload);
    if (payload.type === "approvalResponse") receiveApprovalResponse(payload);
  });
  game.od2Qdv ??= {};
  game.od2Qdv.characterGenerator = { open: generateCharacter };
});
