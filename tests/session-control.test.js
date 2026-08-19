import test from "node:test";
import assert from "node:assert/strict";
import { seedAdvancedTurns, updateTurnState } from "../scripts/features/session-control/model.js";

test("marca um turno uma única vez para avanço do relógio", () => {
  const first = updateTurnState({}, {}, "1-1", true, 1000);
  assert.equal(first.shouldAdvance, true);
  assert.equal(first.turns["1-1"], "passed");
  assert.equal(first.advanced["1-1"], 1000);
  const reopened = updateTurnState(first.turns, first.advanced, "1-1", true, 2000);
  assert.equal(reopened.shouldAdvance, false);
});

test("desmarcar solicita reversão e permite reaplicar o turno", () => {
  const initial = updateTurnState({}, {}, "2-3", true, 1000);
  const cleared = updateTurnState(initial.turns, initial.advanced, "2-3", false, 1100);
  const remarked = updateTurnState(cleared.turns, cleared.advanced, "2-3", true, 1200);
  assert.equal(cleared.shouldRollback, true);
  assert.equal(cleared.transactionId, 1000);
  assert.equal(remarked.shouldAdvance, true);
});

test("cartas antigas preservam turnos já marcados sem avanço retroativo", () => {
  const advanced = seedAdvancedTurns({ "1-1": "passed", "1-2": "" }, undefined);
  assert.deepEqual(advanced, { "1-1": "legacy" });
});
