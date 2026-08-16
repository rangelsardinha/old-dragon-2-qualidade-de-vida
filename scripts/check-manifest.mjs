import { access, readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
for (const field of ["id", "title", "version", "esmodules", "styles", "relationships"]) {
  if (!manifest[field]) throw new Error(`Campo obrigatório ausente no manifesto: ${field}`);
}
if (manifest.id !== "old-dragon-2-qualidade-de-vida") throw new Error("ID inesperado no manifesto");
const expectedCompatibility = { minimum: "13", verified: "14", maximum: "14" };
for (const [key, value] of Object.entries(expectedCompatibility)) {
  if (manifest.compatibility?.[key] !== value) {
    throw new Error(`Compatibilidade ${key} deve ser ${value}`);
  }
}
for (const path of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(({ path }) => path)]) {
  await access(new URL(`../${path}`, import.meta.url));
}
console.log(`Manifesto ${manifest.id} v${manifest.version} válido.`);
