const MODULE_ID = "old-dragon-2-qualidade-de-vida";

Hooks.once("init", () => {
  const labels = {
    enableCombatAutomation: {
      name: "Automação de combate",
      hint: "Ativa ataques contra CA, dano, críticos, falhas críticas e distribuição de XP."
    },
    enableEquipmentContainers: {
      name: "Equipamentos em recipientes",
      hint: "Permite guardar itens e moedas em recipientes, aninhar recipientes e transferir todo o conteúdo em conjunto."
    },
    enableMonsterEquipment: {
      name: "Monstros carregam itens",
      hint: "Adiciona uma aba de equipamentos aos monstros e permite transferir itens entre monstros, ajudantes e personagens."
    },
    enableSpellTome: {
      name: "Tomo de Magia",
      hint: "Adiciona os compêndios, navegador, regras e automações de Magia Selvagem do Tomo de Magia OD2."
    },
    enableScrollGenerator: {
      name: "Gerador de pergaminhos",
      hint: "Permite ao Mestre gerar pergaminhos arcanos e divinos do SRD e, quando habilitado, do Tomo de Magia."
    },
    enableSessionControl: {
      name: "Carta de Controle de Sessão",
      hint: "Adiciona aos Diários uma carta para controlar turnos, encontros, descanso, tochas, lanternas e notas da sessão."
    },
    enableCharacterGenerator: {
      name: "Gerador de personagens",
      hint: "Adiciona ao diretório de Atores um assistente para criar personagens usando raças, classes e progressão do SRD."
    }
  };
  const localized = (key, fallback) => {
    const value = game.i18n.localize(key);
    return value === key ? fallback : value;
  };
  const worldToggle = (key, defaultValue = true) => game.settings.register(MODULE_ID, key, {
    name: localized(`OD2QDV.Settings.${key}.name`, labels[key].name),
    hint: localized(`OD2QDV.Settings.${key}.hint`, labels[key].hint),
    scope: "world",
    config: true,
    type: Boolean,
    default: defaultValue,
    requiresReload: true
  });

  worldToggle("enableCombatAutomation");
  worldToggle("enableEquipmentContainers");
  worldToggle("enableMonsterEquipment");
  worldToggle("enableSpellTome");
  worldToggle("enableScrollGenerator");
  worldToggle("enableSessionControl");
  worldToggle("enableCharacterGenerator");

  game.settings.register(MODULE_ID, "sessionEncounterDie", {
    name: "Dado de encontros aleatórios",
    hint: "Fórmula rolada em segredo para o Mestre nos turnos marcados com E.",
    scope: "world", config: true, type: String, default: "1d6"
  });

  game.settings.register(MODULE_ID, "combatAutoDamage", {
    name: "OD2CA.Settings.combatAutoDamage.name",
    hint: "OD2CA.Settings.combatAutoDamage.hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "combatRequireOneTarget", {
    name: "OD2CA.Settings.combatRequireOneTarget.name",
    hint: "OD2CA.Settings.combatRequireOneTarget.hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "combatAllowPlayersApplyDamage", {
    name: "OD2CA.Settings.combatAllowPlayersApplyDamage.name",
    hint: "OD2CA.Settings.combatAllowPlayersApplyDamage.hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
});

Hooks.once("ready", () => {
  if (game.system.id !== "olddragon2e") {
    ui.notifications.warn("Old Dragon 2: Qualidade de Vida requer o sistema Old Dragon 2ª Edição.");
  }
});
