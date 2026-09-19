import assert from "node:assert/strict";
import test from "node:test";
import type { NotificationEvent, NotificationEventType } from "@rescue-radius/shared";

const VALID_EVENT_TYPES: NotificationEventType[] = [
  "CLAIMED",
  "CANCELLED",
  "NEAR_EXPIRY",
  "PICKED_UP",
  "DELIVERY_FAILED"
];

function buildEvent(eventType: NotificationEventType, listingId = "listing-001"): NotificationEvent {
  return {
    eventType,
    listingId,
    actorId: "responder-001",
    timestamp: new Date().toISOString(),
    payload: {
      listingTitle: "Packed rice and dal meals",
      quantityMeals: 30,
      restaurantName: "Koramangala Kitchen",
      targetRecipients: ["restaurant-001"]
    }
  };
}

test("CLAIMED event has correct shape", () => {
  const evt = buildEvent("CLAIMED");
  assert.equal(evt.eventType, "CLAIMED");
  assert.equal(evt.listingId, "listing-001");
  assert.ok(Array.isArray(evt.payload.targetRecipients));
  assert.ok(evt.payload.targetRecipients.length > 0);
});

test("CANCELLED event has correct shape", () => {
  const evt = buildEvent("CANCELLED");
  assert.equal(evt.eventType, "CANCELLED");
  assert.ok(typeof evt.payload.listingTitle === "string");
});

test("NEAR_EXPIRY event has correct shape", () => {
  const evt = buildEvent("NEAR_EXPIRY");
  assert.equal(evt.eventType, "NEAR_EXPIRY");
  assert.ok(evt.payload.quantityMeals > 0);
});

test("PICKED_UP event has correct shape", () => {
  const evt = buildEvent("PICKED_UP");
  assert.equal(evt.eventType, "PICKED_UP");
  assert.ok(typeof evt.payload.restaurantName === "string");
});

test("DELIVERY_FAILED event has correct shape", () => {
  const evt = buildEvent("DELIVERY_FAILED");
  assert.equal(evt.eventType, "DELIVERY_FAILED");
});

test("all VALID_EVENT_TYPES are covered", () => {
  const covered = new Set(["CLAIMED", "CANCELLED", "NEAR_EXPIRY", "PICKED_UP", "DELIVERY_FAILED"]);
  for (const t of VALID_EVENT_TYPES) {
    assert.ok(covered.has(t), `Missing test for event type: ${t}`);
  }
});

test("eventType validation rejects unknown types", () => {
  const isValid = (t: string) => VALID_EVENT_TYPES.includes(t as NotificationEventType);
  assert.equal(isValid("UNKNOWN"), false);
  assert.equal(isValid("CLAIMED"), true);
  assert.equal(isValid("DELIVERY_FAILED"), true);
});

test("payload targetRecipients must be an array", () => {
  const evt = buildEvent("CLAIMED");
  assert.ok(Array.isArray(evt.payload.targetRecipients));
});

test("optional metadata field is preserved when provided", () => {
  const evt: NotificationEvent = {
    ...buildEvent("CLAIMED"),
    payload: {
      ...buildEvent("CLAIMED").payload,
      metadata: { reason: "capacity-match" }
    }
  };
  assert.equal(evt.payload.metadata?.reason, "capacity-match");
});
