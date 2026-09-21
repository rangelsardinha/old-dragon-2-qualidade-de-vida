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
  itemTypes: Object.freeze(["misc"]),
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
  )
]);
