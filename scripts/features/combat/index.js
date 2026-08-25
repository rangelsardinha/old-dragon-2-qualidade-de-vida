import { applyModifiers, shiftDamageDice, shiftDifficulty } from '../effect-manager/model.js';

const MODULE_ID = 'old-dragon-2-qualidade-de-vida';

const ATTACK_SELECTOR = '.olddragon2e.sheet .attack-roll';

function isEnabled() {
  return game.system.id === 'olddragon2e'
    && game.settings.get(MODULE_ID, 'enableCombatAutomation');
}

const FALLBACK_I18N = {
  'OD2CA.Settings.combatAutoDamage.name': 'Aplicar dano automatico',
  'OD2CA.Settings.combatAutoDamage.hint': 'Quando um ataque acertar, rola o dano da arma e desconta automaticamente do alvo.',
  'OD2CA.Settings.combatRequireOneTarget.name': 'Exigir exatamente um alvo',
  'OD2CA.Settings.combatRequireOneTarget.hint': 'O ataque automatizado so continua quando exatamente um token estiver marcado como alvo.',
  'OD2CA.Settings.combatAllowPlayersApplyDamage.name': 'Jogadores podem aplicar dano',
  'OD2CA.Settings.combatAllowPlayersApplyDamage.hint': 'Permite que jogadores atualizem PV de alvos que conseguem editar. Sem permissao sobre o alvo, o mestre ainda precisara aplicar.',
  'OD2CA.Notifications.selectTarget': 'Selecione exatamente um alvo antes de atacar.',
  'OD2CA.Notifications.noTargetAc': 'Nao consegui encontrar a CA do alvo.',
  'OD2CA.Notifications.noTargetHp': 'Nao consegui encontrar os PV do alvo.',
  'OD2CA.Notifications.noDamageFormula': 'Ataque acertou, mas nao ha formula de dano cadastrada.',
  'OD2CA.Notifications.damagePermission': 'Sem permissao para alterar os PV do alvo. O dano foi rolado e informado no chat.',
  'OD2CA.Notifications.noActiveGm': 'Nenhum mestre ativo para receber o pedido de dano.',
  'OD2CA.Notifications.gmRequestSent': 'Pedido de aplicacao de dano enviado ao mestre.',
  'OD2CA.Chat.hit': 'Acerto',
  'OD2CA.Chat.miss': 'Erro',
  'OD2CA.Chat.attack': 'Ataque',
  'OD2CA.Chat.damage': 'Dano',
  'OD2CA.Chat.critical': 'Acerto Critico',
  'OD2CA.Chat.fumble': 'Erro Critico',
  'OD2CA.Chat.criticalRoll': 'Tabela',
  'OD2CA.Chat.rule': 'Regra',
  'OD2CA.Chat.effect': 'Efeito',
  'OD2CA.Chat.bleeding': 'Sangramento',
  'OD2CA.Chat.damageApplied': 'Dano aplicado',
  'OD2CA.Chat.damageType': 'Tipo',
  'OD2CA.Chat.weaponDamageType': 'Tipo de dano',
  'OD2CA.Chat.deathInRounds': 'Morte em {rounds} rodadas',
  'OD2CA.Chat.immediateDeath': 'Morte imediata',
  'OD2CA.Chat.manualDamage': 'Dano manual',
  'OD2CA.Chat.combatFinished': 'Combate finalizado',
  'OD2CA.Chat.defeatedCreatures': 'Criaturas derrotadas',
  'OD2CA.Chat.noDefeatedCreatures': 'Nenhuma criatura derrotada com XP foi encontrada.',
  'OD2CA.Chat.totalXp': 'XP total',
  'OD2CA.Chat.distributeXp': 'Distribuir XP',
  'OD2CA.Chat.xpDistributed': 'Experiencia distribuida',
  'OD2CA.Chat.xpPerCharacter': 'XP ganho por personagem',
  'OD2CA.Chat.previousXp': 'XP anterior',
  'OD2CA.Chat.currentXp': 'XP atual',
  'OD2CA.Dialog.xpDistribution.title': 'Distribuir XP do combate',
  'OD2CA.Dialog.xpDistribution.content': 'Confira e ajuste o XP recebido por cada personagem.',
  'OD2CA.Dialog.xpDistribution.character': 'Personagem',
  'OD2CA.Dialog.xpDistribution.amount': 'XP recebido',
  'OD2CA.Dialog.xpDistribution.allocated': 'XP alocado',
  'OD2CA.Dialog.xpDistribution.remaining': 'Diferenca',
  'OD2CA.Dialog.xpDistribution.confirm': 'Distribuir XP',
  'OD2CA.Notifications.noXpRecipients': 'Nenhum personagem participante foi encontrado para receber XP.',
  'OD2CA.Notifications.xpAlreadyDistributed': 'O XP deste combate ja foi distribuido.',
  'OD2CA.Dialog.manualDamage.title': 'Informar dano',
  'OD2CA.Dialog.manualDamage.content': 'O ataque acertou, mas este ataque nao tem dano cadastrado. Informe o dano para aplicar ao alvo.',
  'OD2CA.Dialog.manualDamage.label': 'Dano causado',
  'OD2CA.Dialog.criticalDamage.title': 'Confirmar dano critico',
  'OD2CA.Dialog.criticalDamage.content': 'Confirme o dano critico antes de descontar do alvo.',
  'OD2CA.Dialog.criticalDamage.manualContent': 'Nao foi possivel calcular o dano critico automaticamente. Informe o dano final para descontar do alvo.',
  'OD2CA.Dialog.criticalDamage.value': 'Dano final',
  'OD2CA.Dialog.criticalDamage.confirm': 'Descontar dano',
  'OD2CA.Dialog.damageAdjustment.title': 'Aplicar dano',
  'OD2CA.Dialog.damageAdjustment.content': 'Como o alvo recebe este dano?',
  'OD2CA.Dialog.damageAdjustment.base': 'Dano base',
  'OD2CA.Dialog.damageAdjustment.normal': 'Normal',
  'OD2CA.Dialog.damageAdjustment.weakness': 'Fraqueza',
  'OD2CA.Dialog.damageAdjustment.resistance': 'Resistencia',
  'OD2CA.Dialog.damageAdjustment.final': 'Dano aplicado',
  'OD2CA.Dialog.rollMode.label': 'Modo da rolagem',
  'OD2CA.Dialog.rollMode.public': 'Publica',
  'OD2CA.Dialog.rollMode.private': 'Mestre',
  'OD2CA.Dialog.rollMode.blind': 'Cega',
  'OD2CA.Dialog.rollMode.self': 'So para mim',
  'OD2CA.Dialog.death.title': 'Alvo a zero PV',
  'OD2CA.Dialog.death.content': '{name} chegou a 0 PV. Ele morreu?',
  'OD2CA.Dialog.gmDamage.title': 'Aplicar dano do jogador',
  'OD2CA.Dialog.gmDamage.content': 'Um jogador acertou um ataque, mas nao tem permissao para alterar os PV do alvo. Deseja aplicar este dano?',
  'OD2CA.Dialog.gmDamage.apply': 'Aplicar dano',
  'OD2CA.Dialog.criticalRule.title': '20 natural',
  'OD2CA.Dialog.criticalRule.content': 'O ataque foi um 20 natural. Qual regra de acerto critico deseja usar?',
  'OD2CA.Dialog.criticalRule.classic': 'LB1 classico',
  'OD2CA.Dialog.criticalRule.expanded': 'LB2 expandido',
  'OD2CA.Dialog.fumbleRule.title': '1 natural',
  'OD2CA.Dialog.fumbleRule.content': 'O ataque foi um 1 natural. Qual regra de erro critico deseja usar?',
  'OD2CA.Dialog.fumbleRule.classic': 'LB1 classico',
  'OD2CA.Dialog.fumbleRule.expanded': 'LB2 expandido',
  'OD2CA.Dialog.roll': 'Rolar',
  'OD2CA.Dialog.apply': 'Aplicar',
  'OD2CA.Dialog.cancel': 'Cancelar',
};

function t(key) {
  const translated = game.i18n.localize(key);
  return translated === key ? FALLBACK_I18N[key] ?? key : translated;
}

function tf(key, data = {}) {
  let translated = game.i18n.format(key, data);
  if (translated !== key) return translated;

  translated = FALLBACK_I18N[key] ?? key;
  for (const [field, value] of Object.entries(data)) {
    translated = translated.replaceAll(`{${field}}`, value);
  }
  return translated;
}

function dialogV2() {
  return Number(game.release?.generation ?? 13) >= 14
    ? foundry.applications?.api?.DialogV2
    : null;
}

async function confirmCompat({ title, content, defaultYes = false }) {
  const DialogV2 = dialogV2();
  if (DialogV2) {
    return DialogV2.confirm({
      window: { title },
      content,
      yes: { default: defaultYes, callback: () => true },
      no: { default: !defaultYes, callback: () => false },
    });
  }
  return Dialog.confirm({ title, content, yes: () => true, no: () => false, defaultYes });
}

async function promptNumberCompat({ title, content, label, field = 'damage' }) {
  const fields = content.replace(/^\s*<form[^>]*>|<\/form>\s*$/g, '');
  const DialogV2 = dialogV2();
  if (DialogV2) {
    return DialogV2.prompt({
      window: { title },
      content: fields,
      ok: { label, callback: (_event, button) => Number(button.form.elements[field]?.value) || 0 },
    });
  }
  return Dialog.prompt({
    title,
    content: `<form>${fields}</form>`,
    label,
    callback: (html) => Number(new FormData(html[0].querySelector('form')).get(field)) || 0,
    rejectClose: false,
  });
}

Hooks.on('renderActorSheet', (app, html) => {
  if (!isEnabled()) return;
  if (!app.actor?.isOwner) return;

  const root = html instanceof HTMLElement ? html : html[0];
  if (!root || root.dataset.od2caBound === 'true') return;

  root.dataset.od2caBound = 'true';
  root.addEventListener('click', (event) => onSheetClick(event, app.actor), true);
});

Hooks.once('init', () => {
  const hook = foundry.applications?.api?.ApplicationV2
    ? 'renderChatMessageHTML'
    : 'renderChatMessage';
  Hooks.on(hook, onRenderChatMessage);
});

function onRenderChatMessage(message, html) {
  if (!isEnabled()) return;
  const root = html instanceof HTMLElement ? html : html[0];
  const damageButton = root?.querySelector?.('[data-od2ca-action="apply-gm-damage"]');
  const xpButton = root?.querySelector?.('[data-od2ca-action="distribute-xp"]');

  if (damageButton && damageButton.dataset.od2caBound !== 'true') {
    damageButton.dataset.od2caBound = 'true';
    if (!game.user.isGM) damageButton.disabled = true;
    else damageButton.addEventListener('click', () => onGmDamageChatClick(message, damageButton));
  }

  if (xpButton && xpButton.dataset.od2caBound !== 'true') {
    xpButton.dataset.od2caBound = 'true';
    if (!game.user.isGM || message.getFlag(MODULE_ID, 'xpDistributed')) xpButton.disabled = true;
    else xpButton.addEventListener('click', () => onDistributeXpChatClick(message, xpButton));
  }
}

Hooks.on('deleteCombat', (combat) => {
  if (!isEnabled() || !isPrimaryActiveGm()) return;

  handleCombatFinished(combat).catch((error) => {
    console.error(`${MODULE_ID} | Falha ao finalizar distribuicao de XP`, error);
    ui.notifications.error(`OD2 Automacao: ${error.message}`);
  });
});

function isPrimaryActiveGm() {
  const activeGms = game.users
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id));
  return activeGms[0]?.id === game.user.id;
}

async function handleCombatFinished(combat) {
  const combatants = Array.from(combat?.combatants ?? []);
  const creatures = combatants
    .filter((combatant) => combatant.actor?.type === 'monster')
    .filter((combatant) => combatant.defeated)
    .map((combatant) => ({
      name: combatant.name ?? combatant.actor.name,
      xp: getCreatureXp(combatant.actor),
    }));

  const recipients = getCombatXpRecipients(combatants);
  const totalXp = creatures.reduce((total, creature) => total + creature.xp, 0);
  const creatureRows = creatures.length
    ? creatures.map((creature) => `<li><strong>${escapeHtml(creature.name)}</strong>: ${formatXp(creature.xp)} XP</li>`).join('')
    : `<li>${t('OD2CA.Chat.noDefeatedCreatures')}</li>`;
  const canDistribute = recipients.length > 0 && totalXp > 0;
  const button = canDistribute
    ? `<button type="button" data-od2ca-action="distribute-xp"><i class="fas fa-award"></i> ${t('OD2CA.Chat.distributeXp')}</button>`
    : '';

  const content = `
    <div class="od2ca-card od2ca-xp-summary">
      <div class="od2ca-title">${t('OD2CA.Chat.combatFinished')}</div>
      <strong>${t('OD2CA.Chat.defeatedCreatures')}</strong>
      <ul>${creatureRows}</ul>
      <div class="od2ca-xp-total"><strong>${t('OD2CA.Chat.totalXp')}:</strong> ${formatXp(totalXp)} XP</div>
      ${button}
    </div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content,
    whisper: ChatMessage.getWhisperRecipients('GM').map((user) => user.id),
    flags: {
      [MODULE_ID]: {
        xpAward: {
          combatName: combat?.name ?? '',
          creatures,
          totalXp,
          recipients: recipients.map((actor) => ({ actorId: actor.id, name: actor.name })),
        },
        xpDistributed: false,
      },
    },
  });

  if (!recipients.length && totalXp > 0) ui.notifications.warn(t('OD2CA.Notifications.noXpRecipients'));
}

function getCreatureXp(actor) {
  const source = foundry.utils.getProperty(actor, 'system.xp');
  const xp = typeof source === 'number' ? source : Number(String(source ?? '').replace(/[^\d-]/g, ''));
  return Number.isFinite(xp) ? Math.max(0, Math.trunc(xp)) : 0;
}

function getCombatXpRecipients(combatants) {
  const actors = new Map();
  for (const combatant of combatants) {
    const actor = combatant.actor;
    if (actor?.type === 'character' && !actors.has(actor.id)) actors.set(actor.id, actor);
  }
  const characters = Array.from(actors.values());
  const playerCharacters = characters.filter((actor) => game.users.some((user) => {
    if (user.isGM) return false;
    return user.character?.id === actor.id || actor.testUserPermission(user, 'OWNER');
  }));
  return (playerCharacters.length ? playerCharacters : characters)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function onDistributeXpChatClick(message, button) {
  if (!game.user.isGM) return;
  if (message.getFlag(MODULE_ID, 'xpDistributed')) {
    button.disabled = true;
    ui.notifications.warn(t('OD2CA.Notifications.xpAlreadyDistributed'));
    return;
  }

  const award = message.getFlag(MODULE_ID, 'xpAward');
  const recipients = (award?.recipients ?? [])
    .map((recipient) => game.actors.get(recipient.actorId))
    .filter((actor) => actor?.type === 'character');

  if (!recipients.length) {
    ui.notifications.warn(t('OD2CA.Notifications.noXpRecipients'));
    return;
  }

  button.disabled = true;
  try {
    const distribution = await requestXpDistribution(recipients, Number(award.totalXp) || 0);
    if (!distribution) return;

    const results = [];
    for (const entry of distribution) {
      const actor = game.actors.get(entry.actorId);
      if (!actor || actor.type !== 'character') continue;

      const previousXp = Math.max(0, Math.trunc(Number(actor.system.current_xp) || 0));
      const amount = Math.max(0, Math.trunc(Number(entry.amount) || 0));
      const currentXp = previousXp + amount;
      await actor.update({ 'system.current_xp': currentXp });
      results.push({ actorId: actor.id, name: actor.name, amount, previousXp, currentXp });
    }

    await message.setFlag(MODULE_ID, 'xpDistributed', true);
    await message.setFlag(MODULE_ID, 'xpResults', results);
    await sendXpDistributionMessage(award.creatures ?? [], results);
  } catch (error) {
    console.error(`${MODULE_ID} | Falha ao distribuir XP`, error);
    ui.notifications.error(`OD2 Automacao: ${error.message}`);
  } finally {
    button.disabled = Boolean(message.getFlag(MODULE_ID, 'xpDistributed'));
  }
}

async function requestXpDistribution(recipients, totalXp) {
  const equalShare = recipients.length ? Math.floor(totalXp / recipients.length) : 0;
  const rows = recipients.map((actor) => `
    <tr>
      <td>${escapeHtml(actor.name)}</td>
      <td><input type="number" name="xp.${escapeAttribute(actor.id)}" min="0" step="1" value="${equalShare}"></td>
    </tr>`).join('');
  const fields = `
    <div class="od2ca-xp-form">
      <div class="od2ca-card">
        <p>${t('OD2CA.Dialog.xpDistribution.content')}</p>
        <div><strong>${t('OD2CA.Chat.totalXp')}:</strong> ${formatXp(totalXp)} XP</div>
        <table>
          <thead><tr><th>${t('OD2CA.Dialog.xpDistribution.character')}</th><th>${t('OD2CA.Dialog.xpDistribution.amount')}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="od2ca-xp-totals">
          <span><strong>${t('OD2CA.Dialog.xpDistribution.allocated')}:</strong> <span data-od2ca-xp-allocated>0</span> XP</span>
          <span><strong>${t('OD2CA.Dialog.xpDistribution.remaining')}:</strong> <span data-od2ca-xp-remaining>0</span> XP</span>
        </div>
      </div>
    </div>`;

  const readValues = (form) => {
    const formData = new FormData(form);
    return recipients.map((actor) => ({
      actorId: actor.id,
      amount: Math.max(0, Math.trunc(Number(formData.get(`xp.${actor.id}`)) || 0)),
    }));
  };
  const DialogV2 = dialogV2();
  if (DialogV2) {
    return DialogV2.wait({
      window: { title: t('OD2CA.Dialog.xpDistribution.title') },
      content: fields,
      buttons: [
        {
          action: 'distribute', icon: 'fa-solid fa-award',
          label: t('OD2CA.Dialog.xpDistribution.confirm'), default: true,
          callback: (_event, button) => readValues(button.form),
        },
        { action: 'cancel', icon: 'fa-solid fa-times', label: t('OD2CA.Dialog.cancel'), callback: () => null },
      ],
      render: (_event, dialog) => bindXpDistributionTotals(dialog.element, totalXp),
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const dialog = new Dialog({
      title: t('OD2CA.Dialog.xpDistribution.title'),
      content: `<form>${fields}</form>`,
      buttons: {
        distribute: {
          icon: '<i class="fas fa-award"></i>',
          label: t('OD2CA.Dialog.xpDistribution.confirm'),
          callback: (html) => {
            const root = html instanceof HTMLElement ? html : html[0];
            finish(readValues(root.querySelector('form')));
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: t('OD2CA.Dialog.cancel'),
          callback: () => finish(null),
        },
      },
      default: 'distribute',
      render: (html) => bindXpDistributionTotals(html, totalXp),
      close: () => finish(null),
    });
    dialog.render(true);
  });
}

function bindXpDistributionTotals(html, totalXp) {
  const root = html instanceof HTMLElement ? html : html[0];
  const inputs = Array.from(root.querySelectorAll('.od2ca-xp-form input[type="number"]'));
  const allocatedElement = root.querySelector('[data-od2ca-xp-allocated]');
  const remainingElement = root.querySelector('[data-od2ca-xp-remaining]');
  const update = () => {
    const allocated = inputs.reduce((sum, input) => sum + Math.max(0, Math.trunc(Number(input.value) || 0)), 0);
    allocatedElement.textContent = formatXp(allocated);
    remainingElement.textContent = formatXp(totalXp - allocated);
    remainingElement.classList.toggle('od2ca-xp-over', allocated > totalXp);
  };
  inputs.forEach((input) => input.addEventListener('input', update));
  update();
}

async function sendXpDistributionMessage(creatures, results) {
  const creatureRows = creatures.length
    ? creatures.map((creature) => `<li><strong>${escapeHtml(creature.name)}</strong>: ${formatXp(creature.xp)} XP</li>`).join('')
    : `<li>${t('OD2CA.Chat.noDefeatedCreatures')}</li>`;
  const characterRows = results
    .map((result) => `
      <tr>
        <td><strong>${escapeHtml(result.name)}</strong></td>
        <td>+${formatXp(result.amount)} XP</td>
        <td>${formatXp(result.previousXp)} &rarr; ${formatXp(result.currentXp)}</td>
      </tr>`).join('');
  const content = `
    <div class="od2ca-card od2ca-xp-result">
      <div class="od2ca-title">${t('OD2CA.Chat.xpDistributed')}</div>
      <strong>${t('OD2CA.Chat.defeatedCreatures')}</strong>
      <ul>${creatureRows}</ul>
      <strong>${t('OD2CA.Chat.xpPerCharacter')}</strong>
      <table>
        <thead><tr><th>${t('OD2CA.Dialog.xpDistribution.character')}</th><th>${t('OD2CA.Dialog.xpDistribution.amount')}</th><th>${t('OD2CA.Chat.currentXp')}</th></tr></thead>
        <tbody>${characterRows}</tbody>
      </table>
    </div>`;

  await ChatMessage.create({ speaker: ChatMessage.getSpeaker(), content });
}

function formatXp(value) {
  return Math.trunc(Number(value) || 0).toLocaleString(game.i18n.lang);
}

async function onSheetClick(event, actor) {
  if (!isEnabled()) return;
  const attackButton = event.target.closest(ATTACK_SELECTOR);
  if (!attackButton) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  try {
    const attackPerformed = await handleAttack(actor, attackButton);
    if (!attackPerformed) return;
    const item = getAttackItem(actor, attackButton);
    const target = Array.from(game.user.targets ?? [])[0];
    const attackMode = item ? getDefaultAttackMode(item) : '';
    const extraAttacks = Math.min(5, Math.max(0, Math.trunc(game.od2Qdv?.effects?.modifierDelta?.(actor, 'attacks.extra', {
      item, weapon: item, attackMode, attackBasis: attackButton.dataset.ba, targetActor: target?.actor
    }) ?? 0)));
    for (let index = 0; index < extraAttacks; index += 1) {
      ui.notifications.info(`Ataque extra ${index + 1} de ${extraAttacks}.`);
      await handleAttack(actor, attackButton);
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Falha ao resolver ataque`, error);
    ui.notifications.error(`OD2 Automacao: ${error.message}`);
  }
}

async function handleAttack(actor, button) {
  const target = getSingleTarget();
  if (!target) return;

  const item = getAttackItem(actor, button);
  if (!item) return;

  const ammunition = await chooseAmmunition(actor, item, button);
  if (ammunition.required && !ammunition.item) return;

  const targetAc = getArmorClass(target.actor);
  if (!Number.isFinite(targetAc)) {
    ui.notifications.warn(t('OD2CA.Notifications.noTargetAc'));
    return;
  }

  const attackData = await requestAttackOptions(actor, item, button);
  if (!attackData) return;
  attackData.ammunition = ammunition.item;
  attackData.targetActor = target.actor;
  attackData.targetName = target.name ?? target.document?.name ?? target.actor?.name;

  if (ammunition.item) {
    const quantity = Math.max(0, Math.trunc(Number(ammunition.item.system?.quantity) || 0));
    if (quantity < 1) return ui.notifications.warn(`${ammunition.item.name} não possui unidades disponíveis.`);
    await ammunition.item.update({ 'system.quantity': quantity - 1 });
  }

  const attackRoll = await rollAttack(actor, item, attackData);
  if (item.system?.type === 'throwing' && !normalizedItemName(item).includes('funda')) {
    await item.update({ 'system.is_equipped': false });
  }
  const naturalD20 = getNaturalD20(attackRoll);
  const triggerContext = { item, weapon: item, ammunition: ammunition.item, attackMode: attackData.attackMode, attackBasis: attackData.ba, targetActor: target.actor, roll: attackRoll };
  await game.od2Qdv?.effects?.trigger?.(actor, 'attack', triggerContext);
  if (naturalD20 === 20) await game.od2Qdv?.effects?.trigger?.(actor, 'natural20', triggerContext);
  const fumble = naturalD20 === 1 ? await requestFumbleRule() : null;
  const critical = naturalD20 === 20 ? await requestCriticalRule() : null;
  const hit = !fumble && (Boolean(critical) || attackRoll.total >= targetAc);

  await sendAttackResultMessage({
    actor,
    item,
    target,
    attackRoll,
    attackData,
    hit,
    naturalD20,
    critical,
    fumble,
  });

  if (fumble) return true;

  if (!hit) return true;

  const combatAutoDamage = game.settings.get(MODULE_ID, 'combatAutoDamage');
  if (!combatAutoDamage && !critical) return true;

  const damageItem = ammunition.item ?? item;
  const formula = getDamageFormula(actor, damageItem, attackData.attackMode, {
    item, weapon: item, ammunition: ammunition.item, attackBasis: attackData.ba, targetActor: target.actor
  });
  if (formula) {
    const damageResult = await rollDamage(actor, formula, critical);
    await game.od2Qdv?.effects?.trigger?.(actor, 'damage', { item, weapon: item, ammunition: ammunition.item, attackMode: attackData.attackMode, attackBasis: attackData.ba, targetActor: target.actor, damageResult });
    await sendDamageMessage(actor, damageItem, target, damageResult.total, damageResult.roll, critical, damageResult, attackData.rollMode);
    const damageContext = buildDamageContext(actor, damageItem, target, damageResult, critical, attackData);

    if (!combatAutoDamage) return true;

    if (critical) {
      const confirmed = await confirmCriticalDamage(target, critical, damageResult);
      if (!confirmed) return true;
    }

    if (critical?.instantDeath) {
      await applyInstantDeath(target);
      return true;
    }

    await applyDamage(target, damageResult.total, attackData.rollMode, damageContext);
    return true;
  }

  if (critical?.instantDeath) {
    const instantDeathResult = { total: 0, roll: null, formula: '-', mode: 'none' };
    await sendDamageMessage(actor, item, target, 0, null, critical, instantDeathResult, attackData.rollMode);

    if (!combatAutoDamage) return true;

    const confirmed = await confirmCriticalDamage(target, critical, instantDeathResult);
    if (!confirmed) return true;

    await applyInstantDeath(target);
    return true;
  }

  ui.notifications.info(t('OD2CA.Notifications.noDamageFormula'));
  const manualDamage = critical ? await requestCriticalManualDamage(critical) : await requestManualDamage();
  if (manualDamage === null) return true;

  const finalManualDamage = critical?.damageMode === 'double' ? manualDamage * 2 : manualDamage;
  const manualDamageResult = { total: finalManualDamage, roll: null, formula: String(manualDamage), mode: critical?.damageMode ?? 'manual' };

  await sendDamageMessage(actor, item, target, finalManualDamage, null, critical, manualDamageResult, attackData.rollMode);
  const damageContext = buildDamageContext(actor, item, target, manualDamageResult, critical, attackData);

  if (!combatAutoDamage) return true;

  if (critical) {
    const confirmed = await confirmCriticalDamage(target, critical, manualDamageResult);
    if (!confirmed) return true;
  }

  if (critical?.instantDeath) {
    await applyInstantDeath(target);
    return true;
  }
  await applyDamage(target, finalManualDamage, attackData.rollMode, damageContext);
  return true;
}

function normalizedItemName(item) {
  return String(item?.name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function ammunitionFilterForWeapon(weapon, attackButton) {
  if (weapon?.type !== 'weapon') return null;
  if (weapon.system?.type === 'throwing') return null;
  const name = normalizedItemName(weapon);
  if (/\bbesta\s+de\s+mao\b/.test(name)) return (ammo) => normalizedItemName(ammo).includes('virote pequeno');
  if (name.includes('besta')) return (ammo) => normalizedItemName(ammo).includes('virote') && !normalizedItemName(ammo).includes('pequeno');
  if (name.includes('arco')) return (ammo) => normalizedItemName(ammo).includes('flecha');
  if (weapon.system?.type === 'ranged' || attackButton?.dataset?.ba === 'bad') return () => true;
  return null;
}

async function chooseAmmunition(actor, weapon, attackButton) {
  const matchesWeapon = ammunitionFilterForWeapon(weapon, attackButton);
  if (!matchesWeapon) return { required: false, item: null };
  const choices = actor.items.filter((item) =>
    item.type === 'weapon'
    && item.system?.type === 'ammunition'
    && item.system?.is_equipped
    && Number(item.system?.quantity) > 0
    && matchesWeapon(item)
  ).sort((left, right) => left.name.localeCompare(right.name));
  if (!choices.length) {
    ui.notifications.warn(`Nenhuma munição compatível equipada está disponível para ${weapon.name}.`);
    return { required: true, item: null };
  }
  const options = choices.map((item) => `<option value="${escapeAttribute(item.id)}">${escapeHtml(item.name)} — ${Math.trunc(Number(item.system.quantity))} unidade(s) — dano ${escapeHtml(item.system?.damage ?? '-')}</option>`).join('');
  const content = `<div class="form-group"><label>Munição usada</label><select name="ammunition">${options}</select></div>`;
  let itemId;
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (Number(game.release?.generation ?? 13) >= 14 && DialogV2) {
    itemId = await DialogV2.prompt({
      window: { title: `Disparar ${weapon.name}` }, content,
      ok: { label: 'Usar munição', callback: (_event, button) => button.form.elements.ammunition.value }
    });
  } else {
    itemId = await Dialog.prompt({
      title: `Disparar ${weapon.name}`, content, label: 'Usar munição',
      callback: (html) => html.find('[name="ammunition"]').val(), rejectClose: false
    });
  }
  return { required: true, item: actor.items.get(itemId) ?? null };
}

function getSingleTarget() {
  const targets = Array.from(game.user.targets ?? []);

  if (!game.settings.get(MODULE_ID, 'combatRequireOneTarget')) return targets[0] ?? null;

  if (targets.length !== 1) {
    ui.notifications.warn(t('OD2CA.Notifications.selectTarget'));
    return null;
  }

  return targets[0];
}

function getAttackItem(actor, button) {
  const row = button.closest('.attack[data-item-id]');
  const itemId = row?.dataset?.itemId;
  const item = itemId ? actor.items.get(itemId) : null;

  if (!item) {
    ui.notifications.warn('Nao consegui identificar o item de ataque.');
    return null;
  }

  return item;
}

async function requestAttackOptions(actor, item, button) {
  const baseFormula = getAttackFormula(actor, item, button, 0, '');
  const fields = `
    <div class="od2ca-attack-options">
      <div class="form-group">
        <label>Formula</label>
        <input type="text" value="${escapeAttribute(baseFormula)}" disabled>
      </div>
      <div class="form-group">
        <label>Ajuste</label>
        <select name="adjustment">
          <option value="">Normal</option>
          <option value="very-easy">Muito facil (+5)</option>
          <option value="easy">Facil (+2)</option>
          <option value="hard">Dificil (-2)</option>
          <option value="very-hard">Muito dificil (-5)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Bonus</label>
        <input name="bonus" type="number" step="1" value="0">
      </div>
      <div class="form-group">
        <label>Modo do dano</label>
        <select name="attackMode">
          <option value="${escapeAttribute(getDefaultAttackMode(item))}">Padrao</option>
          <option value="melee">Corpo a corpo</option>
          <option value="throwing">Arremesso</option>
          <option value="ranged">Distancia</option>
        </select>
      </div>
      <div class="form-group">
        <label>${t('OD2CA.Dialog.rollMode.label')}</label>
        <select name="rollMode">
          <option value="public">${t('OD2CA.Dialog.rollMode.public')}</option>
          <option value="private">${t('OD2CA.Dialog.rollMode.private')}</option>
          <option value="blind">${t('OD2CA.Dialog.rollMode.blind')}</option>
          <option value="self">${t('OD2CA.Dialog.rollMode.self')}</option>
        </select>
      </div>
    </div>`;

  const readOptions = (form) => {
    const data = new FormData(form);
    return {
      ba: button.dataset.ba,
      baBonus: button.dataset.baBonus === '',
      bonus: Number(data.get('bonus')) || 0,
      adjustment: String(data.get('adjustment') ?? ''),
      attackMode: String(data.get('attackMode') ?? getDefaultAttackMode(item)),
      rollMode: String(data.get('rollMode') ?? 'public'),
    };
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (Number(game.release?.generation ?? 13) >= 14 && DialogV2) {
    return DialogV2.prompt({
      window: { title: `Rolar ataque: ${item.name}` },
      content: fields,
      ok: {
        label: t('OD2CA.Dialog.roll'),
        callback: (_event, dialogButton) => readOptions(dialogButton.form),
      },
    });
  }

  return Dialog.prompt({
    title: `Rolar ataque: ${item.name}`,
    content: `<form>${fields}</form>`,
    label: t('OD2CA.Dialog.roll'),
    callback: (html) => {
      const form = html[0].querySelector('form');
      return readOptions(form);
    },
    rejectClose: false,
  });
}

function getAttackFormula(actor, item, source, bonus, adjustment) {
  const selectedTarget = Array.from(game.user?.targets ?? [])[0] ?? null;
  const targetActor = source?.targetActor ?? selectedTarget?.actor ?? selectedTarget?.document?.actor ?? null;
  const targetName = source?.targetName ?? selectedTarget?.name ?? selectedTarget?.document?.name ?? targetActor?.name ?? '';
  const effectContext = { item, weapon: item, ammunition: source?.ammunition ?? null, attackMode: source?.attackMode, attackBasis: source?.ba, targetActor, targetName };
  const api = game.od2Qdv?.effects;
  const offensiveName = 'Anão: Inimigos';
  const defensiveName = 'Anão Aventureiro: Bastião Racial(6)';
  const offensiveBonus = (api?.modifierDeltaExcluding?.(actor, 'attack', [offensiveName], effectContext)
    ?? api?.modifierDelta?.(actor, 'attack', effectContext) ?? 0)
    + (isDwarfEnemy(targetActor, targetName) ? namedEffectModifier(actor, offensiveName, 'attack') : 0);
  const defensiveContext = { targetActor: actor, targetName: actor?.name, item, weapon: item, attackMode: source?.attackMode, attackBasis: source?.ba };
  const defensiveBonus = targetActor
    ? (api?.modifierDeltaExcluding?.(targetActor, 'incoming.attack', [defensiveName], defensiveContext)
      ?? api?.modifierDelta?.(targetActor, 'incoming.attack', defensiveContext) ?? 0)
      + (isDwarfEnemy(actor, actor.name) ? namedEffectModifier(targetActor, defensiveName, 'incoming.attack') : 0)
    : 0;
  const effectBonus = offensiveBonus + defensiveBonus;
  if (namedEffectPresent(actor, offensiveName) || namedEffectPresent(targetActor, defensiveName)) {
    console.info(`${MODULE_ID} | Modificadores raciais`, { attacker: actor?.name, target: targetName, offensiveBonus, defensiveBonus, effectBonus });
  }
  const difficultySteps = game.od2Qdv?.effects?.modifierDelta?.(actor, 'test.difficulty', effectContext) ?? 0;
  const adjustedDifficulty = shiftDifficulty(adjustment, difficultySteps);
  if (actor.type === 'monster') {
    return joinFormulaTerms(['1d20', adjustmentValue(adjustedDifficulty), item.system.ba, bonus, effectBonus]);
  }

  const dataset = source?.dataset ?? source ?? {};
  const ba = dataset.ba;
  const baseAttack = ba === 'bad' ? actor.system.bad : actor.system.bac;
  const itemBonus = dataset.baBonus === '' || dataset.baBonus === true ? item.system.bonus_ba : 0;
  return joinFormulaTerms(['1d20', adjustmentValue(adjustedDifficulty), baseAttack, itemBonus, bonus, effectBonus]);
}

function normalizedCreatureName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

function isDwarfEnemy(actor, displayedName = '') {
  const raceNames = [...(actor?.items ?? [])].filter((entry) => entry.type === 'race').map((entry) => entry.name);
  const names = [displayedName, actor?.name, actor?.system?.concept, actor?.system?.species, ...raceNames].map(normalizedCreatureName);
  return names.some((name) => ['orc', 'ogro', 'hobgoblin'].some((enemy) => name === enemy || name.includes(enemy)));
}

function namedEffectModifier(actor, effectName, key) {
  const effects = game.od2Qdv?.effects?.get?.(actor) ?? actor?.getFlag?.(MODULE_ID, 'effects') ?? [];
  const wanted = normalizedCreatureName(effectName);
  const effect = effects.find((entry) => entry.enabled !== false && normalizedCreatureName(entry.name) === wanted);
  const modifier = effect?.modifiers?.find((entry) => entry.key === key);
  if (!modifier) return 0;
  const hasResolvedValue = modifier.resolvedValue !== null && modifier.resolvedValue !== undefined && String(modifier.resolvedValue).trim() !== '';
  const value = Number(hasResolvedValue ? modifier.resolvedValue : modifier.value) || 0;
  if (modifier.mode === 'reduce') return -value;
  if (modifier.mode === 'divide' || modifier.mode === 'multiply' || modifier.mode === 'override') return applyModifiers(0, [effect], key);
  return value;
}

function namedEffectPresent(actor, effectName) {
  const effects = game.od2Qdv?.effects?.get?.(actor) ?? actor?.getFlag?.(MODULE_ID, 'effects') ?? [];
  const wanted = normalizedCreatureName(effectName);
  return effects.some((entry) => entry.enabled !== false && normalizedCreatureName(entry.name) === wanted);
}

async function rollAttack(actor, item, attackData) {
  const formula = getAttackFormula(actor, item, attackData, attackData.bonus, attackData.adjustment);
  const roll = new Roll(formula, actor.getRollData?.() ?? {});
  await roll.roll();
  return roll;
}

function buildDamageContext(actor, item, target, damageResult, critical, attackData) {
  return {
    attackerName: actor?.name ?? '',
    itemName: item?.name ?? '',
    targetName: target?.name ?? '',
    targetTokenUuid: target?.document?.uuid ?? '',
    targetSceneId: target?.document?.parent?.id ?? canvas?.scene?.id ?? '',
    targetTokenId: target?.document?.id ?? target?.id ?? '',
    targetActorUuid: target?.actor?.uuid ?? '',
    targetActorId: target?.actor?.id ?? '',
    damage: Number(damageResult?.total) || 0,
    formula: damageResult?.formula ?? '',
    rollMode: attackData?.rollMode ?? 'public',
    criticalRule: critical?.rule ?? '',
    criticalDescription: critical?.description ?? '',
    criticalEffect: critical?.effect ?? '',
  };
}

function getDamageFormula(actor, item, attackMode, context = {}) {
  const damage = String(item.system.damage ?? '').trim();
  if (!damage) return '';

  const effectBonus = game.od2Qdv?.effects?.modifierDelta?.(actor, 'damage', { ...context, attackMode }) ?? 0;
  const strengthEffect = game.od2Qdv?.effects?.modifierDelta?.(actor, 'damage.strength', { ...context, attackMode }) ?? 0;
  const dieSteps = game.od2Qdv?.effects?.modifierDelta?.(actor, 'damage.dieStep', { ...context, attackMode }) ?? 0;
  if (actor.type === 'monster') {
    return shiftDamageDice(joinFormulaTerms([damage, item.system.damage_bonus, effectBonus]), dieSteps);
  }

  const terms = [damage];
  if (attackMode === 'melee' || attackMode === 'throwing') terms.push(actor.system.mod_forca);
  if (strengthEffect && (attackMode === 'ranged' || attackMode === '')) terms.push(actor.system.mod_forca);
  terms.push(item.system.bonus_damage);

  const raceBonus = Number(actor.system.raceBonusDamage?.(item) ?? 0);
  if (raceBonus) terms.push(raceBonus);
  if (effectBonus) terms.push(effectBonus);

  return shiftDamageDice(joinFormulaTerms(terms), dieSteps);
}

async function rollDamage(actor, formula, critical) {
  if (!critical) {
    const roll = new Roll(formula, actor.getRollData?.() ?? {});
    await roll.roll();
    return { total: roll.total, roll, formula, mode: 'normal' };
  }

  switch (critical.damageMode) {
    case 'increased': {
      const increasedFormula = increaseDamageDice(formula);
      const roll = new Roll(increasedFormula, actor.getRollData?.() ?? {});
      await roll.roll();
      return { total: roll.total, roll, formula: increasedFormula, mode: critical.damageMode };
    }
    case 'max':
      return { total: maxDamage(formula), roll: null, formula, mode: critical.damageMode };
    case 'double': {
      const roll = new Roll(formula, actor.getRollData?.() ?? {});
      await roll.roll();
      return { total: roll.total * 2, roll, formula, mode: critical.damageMode };
    }
    case 'maxDouble':
      return { total: maxDamage(formula) * 2, roll: null, formula, mode: critical.damageMode };
    case 'maxTriple':
      return { total: maxDamage(formula) * 3, roll: null, formula, mode: critical.damageMode };
    case 'none':
      return { total: 0, roll: null, formula, mode: critical.damageMode };
    default: {
      const roll = new Roll(formula, actor.getRollData?.() ?? {});
      await roll.roll();
      return { total: roll.total, roll, formula, mode: 'normal' };
    }
  }
}

function getNaturalD20(roll) {
  const die = roll?.dice?.find((candidate) => candidate.faces === 20);
  return die?.results?.find((result) => result.active !== false)?.result ?? null;
}

async function requestCriticalRule() {
  const DialogV2 = dialogV2();
  if (DialogV2) {
    return DialogV2.wait({
      window: { title: t('OD2CA.Dialog.criticalRule.title') },
      content: `<p>${t('OD2CA.Dialog.criticalRule.content')}</p>`,
      buttons: [
        { action: 'classic', icon: 'fa-solid fa-dice-d20', label: t('OD2CA.Dialog.criticalRule.classic'), default: true, callback: () => classicCriticalResult() },
        { action: 'expanded', icon: 'fa-solid fa-table-list', label: t('OD2CA.Dialog.criticalRule.expanded'), callback: () => rollCriticalResult() },
      ],
      close: () => classicCriticalResult(),
    });
  }
  return new Promise((resolve) => {
    let selected = false;

    new Dialog({
      title: t('OD2CA.Dialog.criticalRule.title'),
      content: `<p>${t('OD2CA.Dialog.criticalRule.content')}</p>`,
      buttons: {
        classic: {
          icon: "<i class='fa-solid fa-dice-d20'></i>",
          label: t('OD2CA.Dialog.criticalRule.classic'),
          callback: () => {
            selected = true;
            resolve(classicCriticalResult());
          },
        },
        expanded: {
          icon: "<i class='fa-solid fa-table-list'></i>",
          label: t('OD2CA.Dialog.criticalRule.expanded'),
          callback: async () => {
            selected = true;
            resolve(await rollCriticalResult());
          },
        },
      },
      default: 'classic',
      close: () => {
        if (!selected) resolve(classicCriticalResult());
      },
    }).render(true);
  });
}

function classicCriticalResult() {
  return {
    rule: 'LB1 classico',
    description: '20 natural',
    damageLabel: 'Dano Duplo',
    damageMode: 'double',
    effect: 'Regra classica: dobre o resultado do dano.',
  };
}

async function requestFumbleRule() {
  const DialogV2 = dialogV2();
  if (DialogV2) {
    return DialogV2.wait({
      window: { title: t('OD2CA.Dialog.fumbleRule.title') },
      content: `<p>${t('OD2CA.Dialog.fumbleRule.content')}</p>`,
      buttons: [
        { action: 'classic', icon: 'fa-solid fa-dice-d20', label: t('OD2CA.Dialog.fumbleRule.classic'), default: true, callback: () => classicFumbleResult() },
        { action: 'expanded', icon: 'fa-solid fa-table-list', label: t('OD2CA.Dialog.fumbleRule.expanded'), callback: () => rollFumbleResult() },
      ],
      close: () => classicFumbleResult(),
    });
  }
  return new Promise((resolve) => {
    let selected = false;

    new Dialog({
      title: t('OD2CA.Dialog.fumbleRule.title'),
      content: `<p>${t('OD2CA.Dialog.fumbleRule.content')}</p>`,
      buttons: {
        classic: {
          icon: "<i class='fa-solid fa-dice-d20'></i>",
          label: t('OD2CA.Dialog.fumbleRule.classic'),
          callback: () => {
            selected = true;
            resolve(classicFumbleResult());
          },
        },
        expanded: {
          icon: "<i class='fa-solid fa-table-list'></i>",
          label: t('OD2CA.Dialog.fumbleRule.expanded'),
          callback: async () => {
            selected = true;
            resolve(await rollFumbleResult());
          },
        },
      },
      default: 'classic',
      close: () => {
        if (!selected) resolve(classicFumbleResult());
      },
    }).render(true);
  });
}

function classicFumbleResult() {
  return {
    rule: 'LB1 classico',
    total: null,
    effect: 'Regra classica: o efeito fica a criterio do mestre.',
  };
}

async function rollFumbleResult() {
  const roll = new Roll('1d20');
  await roll.roll();

  const total = roll.total;
  const entry = FUMBLE_TABLE.find((row) => total >= row.min && total <= row.max) ?? FUMBLE_TABLE[0];
  return { ...entry, roll, total, rule: 'LB2 expandido' };
}

async function rollCriticalResult() {
  const roll = new Roll('2d6');
  await roll.roll();

  const total = roll.total;
  const entry = CRITICAL_TABLE[total] ?? CRITICAL_TABLE[7];
  const critical = { ...entry, roll, total, rule: 'LB2 expandido' };

  if (critical.bleeding) {
    const bleedingRoll = new Roll('1d6');
    await bleedingRoll.roll();
    critical.bleedingRoll = bleedingRoll;
    critical.bleedingAmount = bleedingRoll.total;
  }

  if (critical.deathInRounds) {
    const deathRoll = new Roll('1d4');
    await deathRoll.roll();
    critical.deathRoll = deathRoll;
    critical.deathRounds = deathRoll.total;
  }

  return critical;
}

const CRITICAL_TABLE = {
  2: {
    description: 'Golpe Profundo na Garganta',
    damageLabel: 'Dano Maximo Triplo',
    damageMode: 'maxTriple',
    effect: 'Morte em 1d4 rodadas.',
    deathInRounds: true,
  },
  3: {
    description: 'Golpe Devastador',
    damageLabel: 'Dano Maximo Duplo',
    damageMode: 'maxDouble',
    effect: 'Cicatriz Permanente na cabeca ou face.',
  },
  4: {
    description: 'Golpe Severo na Perna Esquerda',
    damageLabel: 'Dano Duplo',
    damageMode: 'double',
    effect: 'Cicatriz Permanente no braco ou mao.',
  },
  5: {
    description: 'Golpe Severo no Ombro Esquerdo',
    damageLabel: 'Dano Maximo',
    damageMode: 'max',
    effect: 'Sangramento causa 1d6 de dano extra e regressivo nas proximas rodadas.',
    bleeding: true,
  },
  6: {
    description: 'Golpe no Braco Esquerdo',
    damageLabel: 'Dano Aumentado',
    damageMode: 'increased',
    effect: 'Sangramento causa 1d6 de dano extra e regressivo nas proximas rodadas.',
    bleeding: true,
  },
  7: {
    description: 'Golpe dolorido',
    damageLabel: 'Dano Aumentado',
    damageMode: 'increased',
    effect: 'Nenhum efeito extra.',
  },
  8: {
    description: 'Golpe no Braco Direito',
    damageLabel: 'Dano Aumentado',
    damageMode: 'increased',
    effect: 'Sangramento causa 1d6 de dano extra e regressivo nas proximas rodadas.',
    bleeding: true,
  },
  9: {
    description: 'Golpe Severo no Ombro Direito',
    damageLabel: 'Dano Maximo',
    damageMode: 'max',
    effect: 'Sangramento causa 1d6 de dano extra e regressivo nas proximas rodadas.',
    bleeding: true,
  },
  10: {
    description: 'Golpe Severo na Perna Direita',
    damageLabel: 'Dano Duplo',
    damageMode: 'double',
    effect: 'Cicatriz Permanente na perna ou pe.',
  },
  11: {
    description: 'Golpe Devastador',
    damageLabel: 'Dano Maximo Duplo',
    damageMode: 'maxDouble',
    effect: 'Cicatriz Permanente no abdomen ou torax.',
  },
  12: {
    description: 'Morte Imediata',
    damageLabel: '-',
    damageMode: 'none',
    effect: 'Morte Imediata.',
    instantDeath: true,
  },
};

const FUMBLE_TABLE = [
  {
    min: 1,
    max: 1,
    effect: 'Voce erra miseravelmente e seu oponente ri de sua desgraca.',
  },
  {
    min: 2,
    max: 3,
    effect: 'Voce deixa a arma cair e precisa de uma acao de movimento para pega-la. Se for conjurador, fica tonto e perde sua proxima acao de movimento.',
  },
  {
    min: 4,
    max: 5,
    effect: 'Voce atira a arma longe e precisa de duas acoes para recupera-la. Se for conjurador, fica atordoado durante toda a proxima rodada.',
  },
  {
    min: 6,
    max: 7,
    effect: 'Voce aumenta a moral dos inimigos em +1.',
  },
  {
    min: 8,
    max: 9,
    effect: 'Voce se fere com a arma e ganha -1 no BAC/BAD ate o fim do combate. Se for conjurador, suas magias terao metade do poder no proximo turno.',
  },
  {
    min: 10,
    max: 11,
    effect: 'Voce torce o pulso e todos os seus ataques neste combate serao dificeis (-2). Se for conjurador, fica tonto e perde um espaco de magia extra.',
  },
  {
    min: 12,
    max: 13,
    effect: 'Voce rompe um musculo e esta com -2 no BAC/BAD ate ser regenerado. Se for conjurador, queima suas pernas e esta com metade do movimento.',
  },
  {
    min: 14,
    max: 15,
    effect: 'Voce se da o dano +1 do seu ataque. Se for um encantamento, o efeito cai sobre voce.',
  },
  {
    min: 16,
    max: 17,
    effect: 'Voce encoraja seu inimigo e ele ganha um ataque de oportunidade imediato contra voce.',
  },
  {
    min: 18,
    max: 19,
    effect: 'Voce acerta o seu amigo mais proximo. Role o dano +1.',
  },
  {
    min: 20,
    max: 20,
    effect: 'Voce cai, bate a cabeca e esta inconsciente com 0 hits (estabilizado).',
  },
];

function increaseDamageDice(formula) {
  return String(formula).replace(/(\d*)d(3|4|6|8|12)\b/gi, (match, count, faces) => {
    const diceCount = Number(count || 1);
    const dieFaces = Number(faces);

    if (dieFaces === 3) return `${diceCount}d4`;
    if (dieFaces === 4) return `${diceCount}d6`;
    if (dieFaces === 6) return `${diceCount}d8`;
    if (dieFaces === 8) return `${diceCount}d12`;
    if (dieFaces === 12) return `${diceCount * 2}d6`;

    return match;
  });
}

function maxDamage(formula) {
  const maxedFormula = String(formula).replace(/(\d*)d(\d+)/gi, (match, count, faces) => {
    const diceCount = Number(count || 1);
    return String(diceCount * Number(faces));
  });

  if (!/^[\d+\-*/().\s]+$/.test(maxedFormula)) return 0;

  return Number(Function(`"use strict"; return (${maxedFormula});`)()) || 0;
}

function getDefaultAttackMode(item) {
  switch (item.type) {
    case 'monster_attack':
      return 'melee';
    default:
      if (item.system.type === 'throwing') return 'throwing';
      if (item.system.type === 'ranged' || item.system.type === 'ammunition') return 'ranged';
      return 'melee';
  }
}

function adjustmentValue(adjustment) {
  switch (adjustment) {
    case 'very-easy':
      return 5;
    case 'easy':
      return 2;
    case 'hard':
      return -2;
    case 'very-hard':
      return -5;
    default:
      return 0;
  }
}

function joinFormulaTerms(terms) {
  const [first, ...rest] = terms
    .map((term) => (term === null || term === undefined ? '' : String(term).trim()))
    .filter((term) => term !== '' && term !== '0');

  if (!first) return '0';

  return rest.reduce((formula, term) => {
    if (term.startsWith('-')) return `${formula}${term}`;
    return `${formula}+${term}`;
  }, first);
}

function getArmorClass(actor) {
  if (!actor) return NaN;

  const candidatePaths = ['system.ac_total', 'system.ca', 'system.ac.value', 'system.attributes.ac.value'];
  for (const path of candidatePaths) {
    const value = foundry.utils.getProperty(actor, path);
    const parsed = parseNumber(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return NaN;
}

function getHp(actor) {
  const value = parseNumber(foundry.utils.getProperty(actor, 'system.hp.value'));
  return Number.isFinite(value) ? value : NaN;
}

async function applyDamage(target, damage, rollMode = 'public', context = {}) {
  const actor = target?.actor;
  const hp = getHp(actor);
  if (!Number.isFinite(hp)) {
    ui.notifications.warn(t('OD2CA.Notifications.noTargetHp'));
    return;
  }

  if (!canApplyDamage(actor)) {
    await requestGmDamageApplication(target, damage, rollMode, context);
    return;
  }

  const adjustment = await requestDamageAdjustment(target, damage);
  if (!adjustment) return;

  const nextHp = Math.max(0, hp - adjustment.damage);
  await actor.update({ 'system.hp.value': nextHp });
  await sendDamageAppliedMessage(target, adjustment, hp, nextHp, rollMode);

  if (hp > 0 && nextHp === 0) {
    await confirmAndMarkDead(target);
  }
}

async function requestDamageAdjustment(target, damage) {
  const baseDamage = Math.max(0, Math.floor(Number(damage) || 0));
  const options = {
    normal: {
      key: 'normal',
      label: t('OD2CA.Dialog.damageAdjustment.normal'),
      damage: baseDamage,
    },
    weakness: {
      key: 'weakness',
      label: t('OD2CA.Dialog.damageAdjustment.weakness'),
      damage: Math.floor(baseDamage * 2),
    },
    resistance: {
      key: 'resistance',
      label: t('OD2CA.Dialog.damageAdjustment.resistance'),
      damage: Math.floor(baseDamage / 2),
    },
  };

  const content = `
    <div class="od2ca-card">
      <p>${t('OD2CA.Dialog.damageAdjustment.content')}</p>
      <dl>
        <dt>Alvo</dt><dd>${escapeHtml(target.name)}</dd>
        <dt>${t('OD2CA.Dialog.damageAdjustment.base')}</dt><dd>${baseDamage}</dd>
        <dt>${options.normal.label}</dt><dd>${options.normal.damage}</dd>
        <dt>${options.weakness.label}</dt><dd>${options.weakness.damage}</dd>
        <dt>${options.resistance.label}</dt><dd>${options.resistance.damage}</dd>
      </dl>
    </div>`;

  const DialogV2 = dialogV2();
  if (DialogV2) {
    return DialogV2.wait({
      window: { title: t('OD2CA.Dialog.damageAdjustment.title') },
      content,
      buttons: [
        { action: 'normal', label: options.normal.label, default: true, callback: () => options.normal },
        { action: 'weakness', label: options.weakness.label, callback: () => options.weakness },
        { action: 'resistance', label: options.resistance.label, callback: () => options.resistance },
      ],
      close: () => null,
    });
  }

  return new Promise((resolve) => {
    let selected = false;

    new Dialog({
      title: t('OD2CA.Dialog.damageAdjustment.title'),
      content,
      buttons: {
        normal: {
          label: options.normal.label,
          callback: () => {
            selected = true;
            resolve(options.normal);
          },
        },
        weakness: {
          label: options.weakness.label,
          callback: () => {
            selected = true;
            resolve(options.weakness);
          },
        },
        resistance: {
          label: options.resistance.label,
          callback: () => {
            selected = true;
            resolve(options.resistance);
          },
        },
      },
      default: 'normal',
      close: () => {
        if (!selected) resolve(null);
      },
    }).render(true);
  });
}

async function sendDamageAppliedMessage(target, adjustment, previousHp, nextHp, rollMode = 'public') {
  const hpRow = isGmControlledTarget(target)
    ? ''
    : `<dt>PV</dt><dd>${previousHp} -> ${nextHp}</dd>`;

  const content = `
    <div class="od2ca-card">
      <div class="od2ca-title">${t('OD2CA.Chat.damageApplied')}</div>
      <dl>
        <dt>Alvo</dt><dd>${escapeHtml(target.name)}</dd>
        <dt>${t('OD2CA.Dialog.damageAdjustment.final')}</dt><dd>${adjustment.damage}</dd>
        ${hpRow}
      </dl>
    </div>`;

  await createChatMessage({ content }, rollMode);
}

async function requestGmDamageApplication(target, damage, rollMode, context = {}) {
  const gms = getActiveGms();
  if (!gms.length) {
    ui.notifications.warn(t('OD2CA.Notifications.noActiveGm'));
    return;
  }

  const payload = {
    ...context,
    targetName: context.targetName || target?.name || '',
    targetTokenUuid: context.targetTokenUuid || target?.document?.uuid || '',
    targetSceneId: context.targetSceneId || target?.document?.parent?.id || canvas?.scene?.id || '',
    targetTokenId: context.targetTokenId || target?.document?.id || target?.id || '',
    targetActorUuid: context.targetActorUuid || target?.actor?.uuid || '',
    targetActorId: context.targetActorId || target?.actor?.id || '',
    damage: Math.max(0, Math.floor(Number(damage) || 0)),
    rollMode: rollMode || context.rollMode || 'public',
    requestId: foundry.utils.randomID(),
  };

  await whisperGmDamageRequest(payload, gms);
  ui.notifications.info(t('OD2CA.Notifications.gmRequestSent'));
}

function getActiveGms() {
  return game.users
    .filter((user) => user.active && user.isGM)
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function resolveDamageTarget(payload) {
  const tokenDocument = payload.targetTokenUuid ? await fromUuid(payload.targetTokenUuid) : null;
  if (tokenDocument?.actor) {
    return {
      actor: tokenDocument.actor,
      document: tokenDocument,
      name: tokenDocument.name,
    };
  }

  const scene = payload.targetSceneId ? game.scenes.get(payload.targetSceneId) : canvas?.scene;
  const sceneToken = scene && payload.targetTokenId ? scene.tokens.get(payload.targetTokenId) : null;
  if (sceneToken?.actor) {
    return {
      actor: sceneToken.actor,
      document: sceneToken,
      name: sceneToken.name,
    };
  }

  const canvasToken = payload.targetTokenId ? canvas?.tokens?.get(payload.targetTokenId) : null;
  if (canvasToken?.actor) {
    return {
      actor: canvasToken.actor,
      document: canvasToken.document,
      name: canvasToken.name,
    };
  }

  const actor = payload.targetActorUuid ? await fromUuid(payload.targetActorUuid) : null;
  if (actor) return { actor, name: actor.name };

  const actorById = payload.targetActorId ? game.actors.get(payload.targetActorId) : null;
  if (actorById) return { actor: actorById, name: actorById.name };

  return null;
}

async function confirmGmDamageRequest(payload) {
  const criticalRows = payload.criticalRule
    ? `
      <dt>${t('OD2CA.Chat.rule')}</dt><dd>${escapeHtml(payload.criticalRule)}</dd>
      <dt>Descricao</dt><dd>${escapeHtml(payload.criticalDescription)}</dd>
      <dt>${t('OD2CA.Chat.effect')}</dt><dd>${escapeHtml(payload.criticalEffect)}</dd>
    `
    : '';

  const content = `
    <div class="od2ca-card">
      <p>${t('OD2CA.Dialog.gmDamage.content')}</p>
      <dl>
        <dt>Atacante</dt><dd>${escapeHtml(payload.attackerName)}</dd>
        <dt>Alvo</dt><dd>${escapeHtml(payload.targetName)}</dd>
        <dt>Arma</dt><dd>${escapeHtml(payload.itemName)}</dd>
        <dt>${t('OD2CA.Dialog.damageAdjustment.base')}</dt><dd>${Number(payload.damage) || 0}</dd>
        ${payload.formula ? `<dt>Formula</dt><dd>${escapeHtml(payload.formula)}</dd>` : ''}
        ${criticalRows}
      </dl>
    </div>`;

  return confirmCompat({
    title: t('OD2CA.Dialog.gmDamage.title'),
    content,
    yes: () => true,
    no: () => false,
    defaultYes: true,
  });
}

async function whisperGmDamageRequest(payload, gms) {
  const criticalRows = payload.criticalRule
    ? `
      <dt>${t('OD2CA.Chat.rule')}</dt><dd>${escapeHtml(payload.criticalRule)}</dd>
      <dt>Descricao</dt><dd>${escapeHtml(payload.criticalDescription)}</dd>
      <dt>${t('OD2CA.Chat.effect')}</dt><dd>${escapeHtml(payload.criticalEffect)}</dd>
    `
    : '';

  const content = `
    <div class="od2ca-card">
      <div class="od2ca-title">${t('OD2CA.Dialog.gmDamage.title')}</div>
      <p>${t('OD2CA.Dialog.gmDamage.content')}</p>
      <dl>
        <dt>Atacante</dt><dd>${escapeHtml(payload.attackerName)}</dd>
        <dt>Alvo</dt><dd>${escapeHtml(payload.targetName)}</dd>
        <dt>Arma</dt><dd>${escapeHtml(payload.itemName)}</dd>
        <dt>${t('OD2CA.Dialog.damageAdjustment.base')}</dt><dd>${Number(payload.damage) || 0}</dd>
        ${payload.formula ? `<dt>Formula</dt><dd>${escapeHtml(payload.formula)}</dd>` : ''}
        ${criticalRows}
      </dl>
      <button type="button" data-od2ca-action="apply-gm-damage">
        ${t('OD2CA.Dialog.gmDamage.apply')}
      </button>
    </div>`;

  await ChatMessage.create({
    content,
    whisper: gms.map((gm) => gm.id),
    flags: {
      [MODULE_ID]: {
        gmDamagePayload: payload,
        gmDamageApplied: false,
      },
    },
  });
}

async function onGmDamageChatClick(message, button) {
  if (!game.user.isGM) return;

  const alreadyApplied = message.getFlag(MODULE_ID, 'gmDamageApplied');
  if (alreadyApplied) {
    button.disabled = true;
    return;
  }

  const payload = message.getFlag(MODULE_ID, 'gmDamagePayload');
  if (!payload) return;

  const confirmed = await confirmGmDamageRequest(payload);
  if (!confirmed) return;

  const target = await resolveDamageTarget(payload);
  if (!target?.actor) {
    ui.notifications.warn(t('OD2CA.Notifications.noTargetHp'));
    return;
  }

  button.disabled = true;
  await applyDamage(target, payload.damage, payload.rollMode, payload);
  await message.setFlag(MODULE_ID, 'gmDamageApplied', true);
}

function isGmControlledTarget(target) {
  const actor = target?.actor;
  if (!actor) return true;

  return !game.users.some((user) => {
    if (user.isGM) return false;
    return actor.testUserPermission(user, 'OWNER');
  });
}

async function applyInstantDeath(target) {
  const actor = target?.actor;
  if (!canApplyDamage(actor)) {
    ui.notifications.warn(t('OD2CA.Notifications.damagePermission'));
    return;
  }

  await actor.update({ 'system.hp.value': 0 });
  await markTargetDead(target);
}

function canApplyDamage(actor) {
  if (game.user.isGM) return true;
  if (!game.settings.get(MODULE_ID, 'combatAllowPlayersApplyDamage')) return false;
  return actor.testUserPermission(game.user, 'OWNER');
}

async function confirmAndMarkDead(target) {
  const confirmed = await confirmCompat({
    title: t('OD2CA.Dialog.death.title'),
    content: `<p>${tf('OD2CA.Dialog.death.content', { name: escapeHtml(target.name) })}</p>`,
    yes: () => true,
    no: () => false,
    defaultYes: false,
  });

  if (!confirmed) return;

  await markTargetDead(target);
}

async function markTargetDead(target) {
  const statusId = getDeadStatusId();
  const token = target?.document ?? target;
  const actor = target?.actor;

  if (actor?.toggleStatusEffect) {
    await actor.toggleStatusEffect(statusId, { active: true, overlay: true });
  } else if (token?.toggleActiveEffect) {
    const effect = getStatusEffect(statusId);
    await token.toggleActiveEffect(effect, { active: true, overlay: true });
  } else if (target?.toggleEffect) {
    const effect = getStatusEffect(statusId);
    await target.toggleEffect(effect.img ?? effect.icon, { active: true, overlay: true });
  }

  const combatant = game.combat?.combatants?.find((candidate) => candidate.tokenId === token?.id);
  if (combatant && !combatant.defeated) await combatant.update({ defeated: true });
}

function getDeadStatusId() {
  const ids = new Set((CONFIG.statusEffects ?? []).map((effect) => effect.id));
  if (ids.has('dead')) return 'dead';
  if (ids.has('defeated')) return 'defeated';
  return 'dead';
}

function getStatusEffect(statusId) {
  return CONFIG.statusEffects?.find((effect) => effect.id === statusId) ?? {
    id: statusId,
    name: 'Dead',
    img: 'icons/svg/skull.svg',
  };
}

async function sendAttackResultMessage({ actor, item, target, attackRoll, attackData, hit, naturalD20, critical, fumble }) {
  const outcomeKey = hit ? 'OD2CA.Chat.hit' : 'OD2CA.Chat.miss';
  const outcomeClass = hit ? 'od2ca-hit' : 'od2ca-miss';
  const damageType = hit ? getWeaponDamageType(item) : '';
  const damageTypeRow = damageType
    ? `<dt>${t('OD2CA.Chat.weaponDamageType')}</dt><dd>${escapeHtml(damageType)}</dd>`
    : '';
  const content = `
    <div class="od2ca-card">
      <div class="od2ca-title">${t('OD2CA.Chat.attack')} com <strong>${escapeHtml(item.name)}</strong></div>
      <div class="${outcomeClass}">${t(outcomeKey)}</div>
      <dl>
        <dt>Atacante</dt><dd>${escapeHtml(actor.name)}</dd>
        <dt>Alvo</dt><dd>${escapeHtml(target.name)}</dd>
        <dt>D20</dt><dd>${naturalD20 ?? '-'}</dd>
        <dt>Total</dt><dd>${attackRoll.total}</dd>
        ${damageTypeRow}
        <dt>Formula</dt><dd>${escapeHtml(getAttackFormula(actor, item, attackData, attackData.bonus, attackData.adjustment))}</dd>
      </dl>
      ${critical ? criticalHtml(critical) : ''}
      ${fumble ? fumbleHtml(fumble) : ''}
    </div>`;

  await attackRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${t('OD2CA.Chat.attack')}: ${hit ? t('OD2CA.Chat.hit') : t('OD2CA.Chat.miss')}`,
    content,
  }, toMessageOptions(attackData.rollMode));
}

function getWeaponDamageType(item) {
  const damageType = String(item?.system?.damage_type ?? '').trim();

  const labels = {
    bludgeoning: 'Contusao',
    piercing: 'Perfuracao',
    slashing: 'Corte',
  };

  if (damageType && damageType !== 'none') {
    const key = `olddragon2e.damage_types.${damageType}`;
    const localized = game.i18n.localize(key);
    return localized === key ? labels[damageType] ?? damageType : localized;
  }

  const damageDescription = String(item?.system?.damage_description ?? '').trim();
  return damageDescription || '';
}

function fumbleHtml(fumble) {
  const rows = [
    [t('OD2CA.Chat.rule'), fumble.rule],
    ['1d20', fumble.total],
    [t('OD2CA.Chat.effect'), fumble.effect],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  const rowHtml = rows
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join('');

  return `
    <div class="od2ca-critical">
      <div class="od2ca-title">${t('OD2CA.Chat.fumble')}</div>
      <dl>${rowHtml}</dl>
    </div>`;
}

async function sendDamageMessage(actor, item, target, damage, roll = null, critical = null, damageResult = null, rollMode = 'public') {
  const content = `
    <div class="od2ca-card">
      <div class="od2ca-title">${t('OD2CA.Chat.damage')} com <strong>${escapeHtml(item.name)}</strong></div>
      <dl>
        <dt>Alvo</dt><dd>${escapeHtml(target.name)}</dd>
        <dt>Dano</dt><dd>${Number(damage) || 0}</dd>
        ${damageResult?.formula ? `<dt>Formula</dt><dd>${escapeHtml(damageResult.formula)}</dd>` : ''}
      </dl>
      ${critical ? criticalHtml(critical, damageResult) : ''}
    </div>`;

  if (roll) {
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: t('OD2CA.Chat.damage'),
      content,
    }, toMessageOptions(rollMode));
    return;
  }

  await createChatMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
  }, rollMode);
}

function rollMode(mode) {
  if (game.release.generation >= 14) {
    switch (mode) {
      case 'private':
        return 'gm';
      case 'blind':
        return 'blind';
      case 'self':
        return 'self';
      default:
        return 'public';
    }
  }

  switch (mode) {
    case 'private':
      return 'gmroll';
    case 'blind':
      return 'blindroll';
    case 'self':
      return 'selfroll';
    default:
      return 'roll';
  }
}

function toMessageOptions(mode) {
  const value = rollMode(mode);
  return game.release.generation >= 14 ? { messageMode: value } : { rollMode: value };
}

async function createChatMessage(data, mode) {
  const messageData = { ...data };
  const value = rollMode(mode);

  if (Number(game.release?.generation ?? 13) >= 14 && ChatMessage.applyMode) {
    ChatMessage.applyMode(messageData, value);
  } else if (ChatMessage.applyRollMode) {
    ChatMessage.applyRollMode(messageData, value);
  } else if (mode === 'private' || mode === 'blind') {
    messageData.whisper = ChatMessage.getWhisperRecipients('GM').map((user) => user.id);
    if (mode === 'blind') messageData.blind = true;
  } else if (mode === 'self') {
    messageData.whisper = [game.user.id];
  }

  await ChatMessage.create(messageData);
}

function criticalHtml(critical, damageResult = null) {
  const rows = [
    [t('OD2CA.Chat.rule'), critical.rule],
    ['Descricao', critical.description],
    ['Dano critico', critical.damageLabel],
    [t('OD2CA.Chat.effect'), critical.effect],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  if (critical.total) {
    rows.splice(1, 0, ['2d6', critical.total]);
  }

  if (damageResult?.mode === 'increased') {
    rows.push(['Formula ajustada', damageResult.formula]);
  }

  if (critical.bleedingAmount) {
    rows.push([t('OD2CA.Chat.bleeding'), bleedingSchedule(critical.bleedingAmount)]);
  }

  if (critical.deathRounds) {
    rows.push([t('OD2CA.Chat.effect'), tf('OD2CA.Chat.deathInRounds', { rounds: critical.deathRounds })]);
  }

  if (critical.instantDeath) {
    rows.push([t('OD2CA.Chat.effect'), t('OD2CA.Chat.immediateDeath')]);
  }

  const rowHtml = rows
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join('');

  return `
    <div class="od2ca-critical">
      <div class="od2ca-title">${t('OD2CA.Chat.critical')}</div>
      <dl>${rowHtml}</dl>
    </div>`;
}

async function confirmCriticalDamage(target, critical, damageResult) {
  const content = `
    <div class="od2ca-card">
      <p>${t('OD2CA.Dialog.criticalDamage.content')}</p>
      <dl>
        <dt>Alvo</dt><dd>${escapeHtml(target.name)}</dd>
        <dt>${t('OD2CA.Dialog.criticalDamage.value')}</dt><dd>${Number(damageResult?.total) || 0}</dd>
        ${damageResult?.formula ? `<dt>Formula</dt><dd>${escapeHtml(damageResult.formula)}</dd>` : ''}
      </dl>
      ${criticalHtml(critical, damageResult)}
    </div>`;

  return confirmCompat({
    title: t('OD2CA.Dialog.criticalDamage.title'),
    content,
    yes: () => true,
    no: () => false,
    defaultYes: true,
  });
}

async function requestCriticalManualDamage(critical) {
  const content = `
    <form>
      <div class="od2ca-card">
        <p>${t('OD2CA.Dialog.criticalDamage.manualContent')}</p>
        ${criticalHtml(critical)}
        <div class="form-group">
          <label>${t('OD2CA.Dialog.criticalDamage.value')}</label>
          <input name="damage" type="number" min="0" step="1" value="0" autofocus>
        </div>
      </div>
    </form>`;

  const value = await promptNumberCompat({
    title: t('OD2CA.Dialog.criticalDamage.title'),
    content,
    label: t('OD2CA.Dialog.criticalDamage.confirm'),
  });

  return value ?? null;
}

function bleedingSchedule(amount) {
  const values = [];
  for (let value = Number(amount) || 0; value > 0; value -= 1) {
    values.push(value);
  }

  return values.length ? `${amount} (${values.join(' / ')})` : '0';
}

async function requestManualDamage() {
  const content = `
    <form>
      <p>${t('OD2CA.Dialog.manualDamage.content')}</p>
      <div class="form-group">
        <label>${t('OD2CA.Dialog.manualDamage.label')}</label>
        <input name="damage" type="number" min="0" step="1" value="0" autofocus>
      </div>
    </form>`;

  const value = await promptNumberCompat({
    title: t('OD2CA.Dialog.manualDamage.title'),
    content,
    label: t('OD2CA.Dialog.apply'),
  });

  return value ?? null;
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;

  const match = value.match(/-?\d+/);
  return match ? Number(match[0]) : NaN;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}
