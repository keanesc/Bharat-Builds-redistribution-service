import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { FoodCategory, ResponderProfile, SurplusListing } from "@rescue-radius/shared";
import { db, listingsTable, profilesTable } from "./lib/db.js";
import { statusEvent } from "./domain/status.js";

type Fixture = {
  profiles: ResponderProfile[];
  restaurants: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  listings: Array<{
    id: string;
    restaurantId: string;
    foodDescription: string;
    quantityMeals: number;
    foodCategory: FoodCategory;
    packedMinutesAgo: number;
    pickupWindowMinutes: number;
  }>;
};

const fixturePath = resolve(new URL("../../fixtures/demo.json", import.meta.url).pathname);
const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture;
const now = Date.now();

for (const profile of fixture.profiles) {
  await db.send(new PutCommand({ TableName: profilesTable, Item: profile }));
}

for (const item of fixture.listings) {
  const restaurant = fixture.restaurants.find((candidate) => candidate.id === item.restaurantId);
  if (!restaurant) throw new Error(`Unknown restaurant ${item.restaurantId}`);
  const packedAt = new Date(now - item.packedMinutesAgo * 60_000).toISOString();
  const pickupDeadline = new Date(now + (item.pickupWindowMinutes - item.packedMinutesAgo) * 60_000).toISOString();
  const listing: SurplusListing = {
    id: item.id,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    foodDescription: item.foodDescription,
    quantityMeals: item.quantityMeals,
    foodCategory: item.foodCategory,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    packedAt,
    pickupDeadline,
    status: "AVAILABLE",
    createdAt: packedAt,
    statusHistory: [statusEvent(null, "AVAILABLE", restaurant.id, packedAt)]
  };
  await db.send(new PutCommand({ TableName: listingsTable, Item: listing }));
}

console.log(`Seeded ${fixture.profiles.length} responders and ${fixture.listings.length} listings`);
