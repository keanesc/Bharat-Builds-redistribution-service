# RescueRadius API contract

Base URL is the `ApiUrl` CloudFormation output from `RescueRadiusStack`.

All requests may include:

```text
X-Demo-Actor: restaurant-001
```

This is demo identity only. It is not production authentication.

## `GET /health`

Returns:

```json
{
  "ok": true,
  "service": "rescue-radius-api",
  "region": "ap-south-1"
}
```

## `GET /listings`

Optional query parameters:

```text
latitude=12.9352
longitude=77.6245
radiusKm=10
```

Returns active listings within the radius:

```json
{
  "listings": []
}
```

Expired listings are excluded server-side.

## `POST /listings`

Request:

```json
{
  "restaurantId": "restaurant-001",
  "restaurantName": "Koramangala Kitchen",
  "foodDescription": "Packed rice and dal meals",
  "quantityMeals": 30,
  "foodCategory": "VEG",
  "latitude": 12.9352,
  "longitude": 77.6245,
  "packedAt": "2026-09-19T12:00:00Z",
  "pickupDeadline": "2026-09-19T13:00:00Z"
}
```

The listing begins in `AVAILABLE` state.

## `POST /listings/{id}/claim`

Requires `X-Demo-Actor`.

Returns the claimed listing or `409 Conflict` when the listing is already claimed, cancelled, or expired.

The claim is protected by a DynamoDB conditional update.

## Status routes

```text
POST /listings/{id}/cancel
POST /listings/{id}/pickup
POST /listings/{id}/deliver
```

Only the actor that claimed the listing may complete its status transitions.

## `GET /dashboard/impact`

Returns:

```json
{
  "totalMealsListed": 0,
  "mealsClaimed": 0,
  "mealsPickedUp": 0,
  "mealsDelivered": 0,
  "expiredListings": 0,
  "averageTimeToClaimMinutes": 0,
  "pickupSuccessRate": 0
}
```
