export function seedAdvancedTurns(turns = {}, advanced) {
  if (advanced && typeof advanced === "object") return { ...advanced };
  return Object.fromEntries(Object.entries(turns).filter(([, state]) => state === "passed").map(([key]) => [key, "legacy"]));
}

export function updateTurnState(turnsSource = {}, advancedSource = {}, key, passed, stamp = true) {
  const turns = { ...turnsSource };
  const advanced = { ...advancedSource };
  const previous = turns[key];
  if (passed) turns[key] = "passed";
  else delete turns[key];
  const shouldAdvance = passed && previous !== "passed" && !advanced[key];
  if (shouldAdvance) advanced[key] = stamp;
  return { turns, advanced, previous, shouldAdvance };
}
