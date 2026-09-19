import assert from "node:assert/strict";
import test from "node:test";
import { haversineDistanceKm } from "./distance.js";

test("haversine distance is zero for the same point", () => {
  assert.equal(haversineDistanceKm({ latitude: 12.9, longitude: 77.6 }, { latitude: 12.9, longitude: 77.6 }), 0);
});

test("haversine distance is symmetric", () => {
  const a = { latitude: 12.9, longitude: 77.6 };
  const b = { latitude: 12.95, longitude: 77.65 };
  assert.equal(haversineDistanceKm(a, b), haversineDistanceKm(b, a));
});
