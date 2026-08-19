const MINIMUM_VERSION = "1.0.4";

function normalized(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function identifiesDarkSun(module) {
  const identity = `${normalized(module?.id)} ${normalized(module?.title)}`;
  return identity.includes("dark sun") || identity.includes("darksun");
}

export function darkSunModule({ activeOnly = true } = {}) {
  return game.modules.find((module) => {
    if (!identifiesDarkSun(module)) return false;
    if (activeOnly && !module.active) return false;
    const version = module.version ?? module.manifest?.version ?? "0.0.0";
    return !foundry.utils.isNewerVersion(MINIMUM_VERSION, version);
  }) ?? null;
}

export function darkSunEnabled() {
  return Boolean(darkSunModule());
}

export function darkSunPacks(documentName = null) {
  const module = darkSunModule();
  if (!module) return [];
  return game.packs.filter((pack) => {
    const packageName = pack.metadata?.packageName ?? pack.metadata?.package;
    return packageName === module.id && (!documentName || pack.documentName === documentName);
  });
}

export async function darkSunDocuments(type) {
  const documents = [];
  for (const pack of darkSunPacks("Item")) {
    const index = await pack.getIndex({ fields: ["type"] });
    if (!index.some((entry) => entry.type === type)) continue;
    documents.push(...(await pack.getDocuments()).filter((document) => document.type === type));
  }
  return documents;
}

Hooks.once("ready", () => {
  const installed = game.modules.find(identifiesDarkSun);
  if (!installed) return;
  const version = installed.version ?? installed.manifest?.version ?? "0.0.0";
  if (!installed.active) {
    console.info(`old-dragon-2-qualidade-de-vida | Dark Sun ${version} detectado, mas inativo; integração de compêndios não carregada.`);
    return;
  }
  if (foundry.utils.isNewerVersion(MINIMUM_VERSION, version)) {
    console.warn(`old-dragon-2-qualidade-de-vida | Dark Sun ${version} detectado; a integração requer ${MINIMUM_VERSION} ou superior.`);
    return;
  }
  console.info(`old-dragon-2-qualidade-de-vida | Integração Dark Sun ${version} ativa com ${darkSunPacks().length} compêndio(s).`);
});

export { MINIMUM_VERSION as DARK_SUN_MINIMUM_VERSION };
