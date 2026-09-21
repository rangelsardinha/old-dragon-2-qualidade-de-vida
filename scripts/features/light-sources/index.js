import {
  LIGHT_SOURCES_MODULE_ID,
  OD2_LIGHT_SOURCE_COMPATIBILITY,
  OD2_LIGHT_SOURCES,
  upgradedItemTypes
} from "./model.js";

const MODULE_ID = "old-dragon-2-qualidade-de-vida";
const PRESET_VERSION = 2;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "lightSourcesPresetVersion", {
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
});

async function waitForApi(retries = 20, delayMs = 250) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const api = game.modules.get(LIGHT_SOURCES_MODULE_ID)?.api;
    if (api) return api;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

Hooks.once("ready", async () => {
  if (game.system.id !== "olddragon2e") return;
  const dependency = game.modules.get(LIGHT_SOURCES_MODULE_ID);
  if (!dependency?.active) {
    console.error(`${MODULE_ID} | Light Sources 0.0.9 ou superior precisa estar ativo.`);
    return;
  }

  const activeGm = game.users?.activeGM;
  if (!game.user?.isGM || (activeGm && activeGm.id !== game.user.id)) return;

  const api = await waitForApi();
  if (!api) {
    console.error(`${MODULE_ID} | A API do Light Sources não ficou disponível.`);
    return;
  }

  await api.registerCompatibility(OD2_LIGHT_SOURCE_COMPATIBILITY);
  const presetVersion = game.settings.get(MODULE_ID, "lightSourcesPresetVersion");
  const currentItemTypes = game.settings.get(LIGHT_SOURCES_MODULE_ID, "itemTypes");
  const itemTypes = upgradedItemTypes(currentItemTypes, presetVersion);
  if (itemTypes !== currentItemTypes) {
    await game.settings.set(LIGHT_SOURCES_MODULE_ID, "itemTypes", itemTypes);
  }
  await api.registerSources(OD2_LIGHT_SOURCES, { managedBy: MODULE_ID });
  if (presetVersion < PRESET_VERSION) {
    await game.settings.set(MODULE_ID, "lightSourcesPresetVersion", PRESET_VERSION);
  }
  console.info(`${MODULE_ID} | Fontes de luz do Old Dragon 2 registradas no Light Sources.`);
});
