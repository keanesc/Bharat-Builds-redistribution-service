import assert from "node:assert/strict";
import test from "node:test";
import { canTransition, statusEvent } from "./status.js";

test("validates the normal listing lifecycle", () => {
  assert.equal(canTransition("AVAILABLE", "CLAIMED"), true);
  assert.equal(canTransition("CLAIMED", "PICKED_UP"), true);
  assert.equal(canTransition("PICKED_UP", "DELIVERED"), true);
});

test("validates cancellation and expiry transitions", () => {
  assert.equal(canTransition("AVAILABLE", "CANCELLED"), true);
  assert.equal(canTransition("AVAILABLE", "EXPIRED"), true);
  assert.equal(canTransition("CLAIMED", "CANCELLED"), true);
  assert.equal(canTransition("CLAIMED", "EXPIRED"), true);
  assert.equal(canTransition("CLAIMED", "AVAILABLE"), true); // reassignment / release
  assert.equal(canTransition("CANCELLED", "AVAILABLE"), true); // return to available
});

test("rejects invalid lifecycle transitions", () => {
  assert.equal(canTransition("AVAILABLE", "DELIVERED"), false);
  assert.equal(canTransition("DELIVERED", "AVAILABLE"), false);
  assert.equal(canTransition("DELIVERED", "CLAIMED"), false);
  assert.equal(canTransition("DELIVERED", "PICKED_UP"), false);
  assert.equal(canTransition("EXPIRED", "AVAILABLE"), false);
  assert.equal(canTransition("EXPIRED", "CLAIMED"), false);
  assert.equal(canTransition("PICKED_UP", "AVAILABLE"), false);
  assert.equal(canTransition("PICKED_UP", "CANCELLED"), false);
});

test("statusEvent creates structured event record with and without reason", () => {
  const timestamp = "2026-09-19T10:00:00.000Z";
  const eventWithoutReason = statusEvent("AVAILABLE", "CLAIMED", "responder-001", timestamp);
  assert.deepEqual(eventWithoutReason, {
    from: "AVAILABLE",
    to: "CLAIMED",
    actorId: "responder-001",
    timestamp
  });

  const eventWithReason = statusEvent(
    "CLAIMED",
    "CANCELLED",
    "responder-001",
    timestamp,
    "Vehicle breakdown"
  );
  assert.deepEqual(eventWithReason, {
    from: "CLAIMED",
    to: "CANCELLED",
    actorId: "responder-001",
    timestamp,
    reason: "Vehicle breakdown"
  });
});
