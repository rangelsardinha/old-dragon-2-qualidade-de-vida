export const LIGHT_SOURCES_MODULE_ID = "light-sources";

const baseLight = Object.freeze({
  negative: false,
  color: "#ff8800",
  animation: Object.freeze({ speed: 5, reverse: false })
});

function light({ dim, bright, angle, alpha, type, intensity }) {
  return {
    dim,
    bright,
    negative: baseLight.negative,
    angle,
    color: baseLight.color,
    alpha,
    animation: {
      type,
      speed: baseLight.animation.speed,
      intensity,
      reverse: baseLight.animation.reverse
    }
  };
}

function source(uuid, lightData) {
  return {
    uuid,
    consume: false,
    freeForAll: false,
    coverable: false,
    hudHidden: false,
    durationMode: "world",
    durationMinutes: 0,
    patterns: [{ name: "Standard", light: lightData }]
  };
}

export const OD2_LIGHT_SOURCE_COMPATIBILITY = Object.freeze({
  itemTypes: Object.freeze(["misc", "spell"]),
  actorTypes: Object.freeze([]),
  quantityPath: ""
});

export const OD2_LIGHT_SOURCES = Object.freeze([
  source(
    "Compendium.olddragon2e.equipment.Item.TXUSIkFDzA0Y5u5T",
    light({ dim: 6, bright: 12, angle: 360, alpha: 0.4, type: "torch", intensity: 5 })
  ),
  source(
    "Compendium.olddragon2e.equipment.Item.5RwY59f3nG4xKQZ3",
    light({ dim: 12, bright: 24, angle: 60, alpha: 0.45, type: "torch", intensity: 1 })
  ),
  source(
    "Compendium.olddragon2e.equipment.Item.W0jMlPQ594L2tMfd",
    light({ dim: 1, bright: 2, angle: 360, alpha: 0.4, type: "flame", intensity: 5 })
  ),
  source(
    "Compendium.olddragon2e.equipment.Item.D20RuafQR6u26MF1",
    light({ dim: 6, bright: 12, angle: 330, alpha: 0.4, type: "flame", intensity: 5 })
  ),
  source(
    "Compendium.olddragon2e.spells.Item.R8L5MhdnzRM5k3BR",
    light({ dim: 4, bright: 8, angle: 360, alpha: 0.4, type: "flame", intensity: 5 })
  ),
  source(
    "Compendium.olddragon2e.spells.Item.MJEu3lz6sXtfEiDz",
    light({ dim: 4, bright: 8, angle: 360, alpha: 0.4, type: "flame", intensity: 5 })
  )
]);

export function upgradedItemTypes(current, presetVersion) {
  if (Number(presetVersion) >= 2) return current;
  const values = Array.isArray(current) ? current : [];
  if (values.length === 1 && values[0] === "misc") return ["misc", "spell"];
  return values;
}

export function normalizedLightName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function lightResourceKind(itemName) {
  const name = normalizedLightName(itemName);
  if (name === "tocha") return "torch";
  if (name === "vela") return "candle";
  if (name === "lamparina" || name === "lanterna furta-fogo") return "oil";
  return null;
}

export function inventoryResourceKind(item) {
  const id = normalizedLightName(item?.system?.odo_id);
  const name = normalizedLightName(item?.name);
  if (id === "tocha" || name === "tocha") return "torch";
  if (id === "vela" || name === "vela") return "candle";
  if (id === "oleo" || name === "oleo") return "oil";
  return null;
}

export function quantityAfterConsumption(value) {
  const quantity = value == null ? 1 : Math.max(0, Math.trunc(Number(value) || 0));
  return quantity <= 1 ? { delete: true, quantity: 0 } : { delete: false, quantity: quantity - 1 };
}

export function expiresWithSessionEvent(itemName, event, hour) {
  const name = normalizedLightName(itemName);
  if (event === "torch") return name === "tocha" || (name === "vela" && [2, 4].includes(Number(hour)));
  if (event === "lamp") return name === "lamparina" || name === "lanterna furta-fogo";
  return false;
}

export function portableLampName(value) {
  const name = normalizedLightName(value);
  return name === "lamparina" || name === "lanterna furta-fogo" ? name : null;
}

export function isPortableLampItem(item, lightName) {
  const expected = portableLampName(lightName);
  if (!expected) return false;
  const id = normalizedLightName(item?.system?.odo_id);
  const name = normalizedLightName(item?.name);
  return name === expected || id === expected.replaceAll(" ", "-");
}

export function isFlintItem(item) {
  const id = normalizedLightName(item?.system?.odo_id);
  const name = normalizedLightName(item?.name);
  const quantity = item?.system?.quantity == null ? 1 : Math.max(0, Math.trunc(Number(item.system.quantity) || 0));
  return quantity > 0 && (id === "pederneira" || name === "pederneira");
}
