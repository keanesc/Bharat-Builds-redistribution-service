# RescueRadius API Contract

Base URL is the `ApiUrl` CloudFormation output from `RescueRadiusStack`.

## Authentication

All routes that require identity must include the demo actor header:

```text
X-Demo-Actor: <actor-id>
```

This is **demo-only identity** and is not production authentication. Valid actor IDs and their roles:

| Actor ID | Role |
|---|---|
| `restaurant-001` | `RESTAURANT` |
| `responder-001` | `RESPONDER` |
| `responder-002` | `RESPONDER` |
| `admin-001` | `ADMIN` |

Routes that require `X-Demo-Actor` will return `400 BAD_REQUEST` if the header is absent or the actor ID is not a known demo actor.

## Error Shape

All error responses use:

```json
{ "error": "ERROR_CODE", "message": "Human-readable description" }
```

| Code | HTTP Status | Meaning |
|---|---|---|
| `BAD_REQUEST` | 400 | Missing or invalid field |
| `UNAUTHORIZED_ACTOR` | 400 | `X-Demo-Actor` absent or unrecognised |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CLAIM_CONFLICT` | 409 | Listing already claimed, cancelled, or expired |
| `STATUS_CONFLICT` | 409 | Status transition not allowed for this actor/state |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## `GET /health`

No headers required.

**Response 200:**
```json
{ "ok": true, "service": "rescue-radius-api", "region": "ap-south-1" }
```

---

## `GET /listings`

No auth required. Optional query parameters:

| Parameter | Type | Description |
|---|---|---|
| `latitude` | number | Origin latitude for radius filter |
| `longitude` | number | Origin longitude for radius filter |
| `radiusKm` | number | Radius in km (default: 10) |
| `foodCategory` | `VEG` \| `NON_VEG` \| `PACKAGED` | Filter by food category |
| `minQuantity` | number | Minimum meals required |
| `maxMinutesUntilDeadline` | number | Only listings expiring within N minutes |
| `restaurantId` | string | Filter to a specific restaurant's listings |

Expired listings are excluded server-side. Results are sorted by `pickupDeadline` ascending.

**Response 200:**
```json
{
  "listings": [
    {
      "id": "listing-001",
      "restaurantId": "restaurant-001",
      "restaurantName": "Koramangala Kitchen",
      "foodDescription": "Packed rice and dal meals",
      "quantityMeals": 30,
      "foodCategory": "VEG",
      "latitude": 12.9352,
      "longitude": 77.6245,
      "packedAt": "2026-09-19T10:00:00.000Z",
      "pickupDeadline": "2026-09-19T10:45:00.000Z",
      "status": "AVAILABLE",
      "createdAt": "2026-09-19T10:00:00.000Z",
      "statusHistory": [
        { "from": null, "to": "AVAILABLE", "actorId": "restaurant-001", "timestamp": "2026-09-19T10:00:00.000Z" }
      ]
    }
  ]
}
```

---

## `GET /listings/{id}`

No auth required.

**Response 200:** Full `SurplusListing` object (same shape as above).

**Response 404:**
```json
{ "error": "NOT_FOUND", "message": "Listing not found" }
```

---

## `POST /listings`

Requires `X-Demo-Actor` with a `RESTAURANT` actor.

**Request body:**
```json
{
  "restaurantId": "restaurant-001",
  "restaurantName": "Koramangala Kitchen",
  "foodDescription": "Packed rice and dal meals",
  "quantityMeals": 30,
  "foodCategory": "VEG",
  "latitude": 12.9352,
  "longitude": 77.6245,
  "packedAt": "2026-09-19T10:00:00.000Z",
  "pickupDeadline": "2026-09-19T10:45:00.000Z",
  "photoUrl": "https://example.com/photo.jpg"
}
```

`photoUrl` is optional. `foodCategory` must be one of `VEG`, `NON_VEG`, `PACKAGED`. `pickupDeadline` must be in the future. `packedAt` must be a valid ISO timestamp.

**Response 201:** Full `SurplusListing` object with `status: "AVAILABLE"` and initial `statusHistory`.

**Response 400:**
```json
{ "error": "BAD_REQUEST", "message": "foodCategory must be VEG, NON_VEG, or PACKAGED" }
```

---

## `POST /listings/{id}/claim`

Requires `X-Demo-Actor` (any `RESPONDER` actor).

Atomically claims an available listing using a DynamoDB conditional write. Only one concurrent claim succeeds.

**Response 200:** Updated `SurplusListing` with `status: "CLAIMED"`, `claimedBy`, `claimedAt`.

**Response 409:**
```json
{ "error": "CLAIM_CONFLICT", "message": "Listing is already claimed, cancelled, or expired" }
```

---

## Status Routes

All require `X-Demo-Actor`. Only the actor that claimed the listing may transition it.

```
POST /listings/{id}/pickup   — CLAIMED → PICKED_UP
POST /listings/{id}/deliver  — PICKED_UP → DELIVERED
POST /listings/{id}/cancel   — CLAIMED → CANCELLED
```

**Response 200:** Updated `SurplusListing` with new `status` and appended `statusHistory`.

**Response 409:**
```json
{ "error": "STATUS_CONFLICT", "message": "Listing status or actor does not allow this transition" }
```

---

## `GET /profiles`

No auth required. Returns all seeded responder profiles.

**Response 200:**
```json
{
  "profiles": [
    {
      "id": "responder-001",
      "name": "Hope Kitchen NGO",
      "role": "NGO",
      "latitude": 12.9352,
      "longitude": 77.6245,
      "capacityMeals": 50,
      "foodPreferences": ["VEG", "PACKAGED"],
      "verified": true,
      "approvalStatus": "APPROVED"
    }
  ]
}
```

---

## `GET /profiles/{id}`

No auth required.

**Response 200:** Single `ResponderProfile` object.

**Response 404:**
```json
{ "error": "NOT_FOUND", "message": "Profile not found" }
```

---

## `POST /notifications/events`

Internal use — called by backend logic after claim, cancellation, near-expiry, pickup, and delivery-failed events.

Requires `X-Demo-Actor`.

**Request body:**
```json
{
  "eventType": "CLAIMED",
  "listingId": "listing-001",
  "actorId": "responder-001",
  "timestamp": "2026-09-19T10:05:00.000Z",
  "payload": {
    "listingTitle": "Packed rice and dal meals",
    "quantityMeals": 30,
    "restaurantName": "Koramangala Kitchen",
    "targetRecipients": ["restaurant-001"]
  }
}
```

Valid `eventType` values: `CLAIMED`, `CANCELLED`, `NEAR_EXPIRY`, `PICKED_UP`, `DELIVERY_FAILED`.

**Response 200:**
```json
{ "ok": true, "eventType": "CLAIMED", "listingId": "listing-001" }
```

**Response 400:**
```json
{ "error": "BAD_REQUEST", "message": "eventType must be one of: CLAIMED, CANCELLED, NEAR_EXPIRY, PICKED_UP, DELIVERY_FAILED" }
```

---

## `GET /dashboard/impact`

No auth required.

**Response 200:**
```json
{
  "totalMealsListed": 163,
  "mealsClaimed": 48,
  "mealsPickedUp": 30,
  "mealsDelivered": 18,
  "expiredListings": 2,
  "averageTimeToClaimMinutes": 4.7,
  "pickupSuccessRate": 0.625
}
```
