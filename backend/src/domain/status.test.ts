import assert from "node:assert/strict";
import test from "node:test";
import { canTransition } from "./status.js";

test("validates the normal listing lifecycle", () => {
  assert.equal(canTransition("AVAILABLE", "CLAIMED"), true);
  assert.equal(canTransition("CLAIMED", "PICKED_UP"), true);
  assert.equal(canTransition("PICKED_UP", "DELIVERED"), true);
});

test("rejects invalid lifecycle transitions", () => {
  assert.equal(canTransition("AVAILABLE", "DELIVERED"), false);
  assert.equal(canTransition("DELIVERED", "AVAILABLE"), false);
});
