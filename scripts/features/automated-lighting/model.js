function number(value) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&atilde;/gi, "ã")
    .replace(/&aacute;/gi, "á")
    .replace(/&ccedil;/gi, "ç")
    .replace(/\s+/g, " ");
}

export function infravisionFromText(value) {
  const match = plainText(value).match(/infravis[aã]o[^0-9]{0,40}(\d+(?:[.,]\d+)?)\s*(?:m(?:etros?)?)\b/i);
  return match ? number(match[1]) : 0;
}

export function actorInfravisionMeters(actor) {
  const race = actor?.system?.race ?? actor?.items?.find?.((item) => item.type === "race");
  const structured = [
    race?.system?.infravision,
    actor?.system?.infravision,
    actor?.system?.details?.infravision
  ].map(number).find((value) => value > 0);
  if (structured) return structured;

  const texts = [
    actor?.system?.description,
    actor?.system?.flavor,
    actor?.system?.details?.notes,
    actor?.system?.notes,
    race?.system?.description,
    ...[...(actor?.items ?? [])].map((item) => item.system?.description)
  ];
  return Math.max(0, ...texts.map(infravisionFromText));
}

export function gridVisionRange(infravisionMeters, squareMeters) {
  const meters = number(infravisionMeters);
  const square = number(squareMeters);
  if (!meters || !square) return 0;
  return Math.round((meters / square) * 100) / 100;
}

export function prototypeVisionUpdate(infravisionMeters, squareMeters) {
  const range = gridVisionRange(infravisionMeters, squareMeters);
  if (!range) return null;
  return {
    "prototypeToken.sight.enabled": true,
    "prototypeToken.sight.range": range,
    "prototypeToken.sight.visionMode": "darkvision"
  };
}
