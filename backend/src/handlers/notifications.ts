import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { NotificationEvent, NotificationEventType } from "@rescue-radius/shared";
import { actorId, badRequest, internalError, json, parseBody } from "../lib/http.js";

const VALID_EVENT_TYPES: NotificationEventType[] = [
  "CLAIMED",
  "CANCELLED",
  "NEAR_EXPIRY",
  "PICKED_UP",
  "DELIVERY_FAILED"
];

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method;
    if (method !== "POST") {
      return json(405, { error: "METHOD_NOT_ALLOWED", message: "Only POST is supported" });
    }

    const actor = actorId(event);
    const body = parseBody<Partial<NotificationEvent>>(event);

    if (!body.eventType || !VALID_EVENT_TYPES.includes(body.eventType as NotificationEventType)) {
      return badRequest(`eventType must be one of: ${VALID_EVENT_TYPES.join(", ")}`);
    }
    if (!body.listingId) {
      return badRequest("listingId is required");
    }
    if (!body.payload?.listingTitle || !body.payload?.restaurantName || !Array.isArray(body.payload?.targetRecipients)) {
      return badRequest("payload must include listingTitle, restaurantName, and targetRecipients");
    }

    const notificationEvent: NotificationEvent = {
      eventType: body.eventType as NotificationEventType,
      listingId: body.listingId,
      actorId: actor,
      timestamp: new Date().toISOString(),
      payload: {
        listingTitle: body.payload.listingTitle,
        quantityMeals: body.payload.quantityMeals ?? 0,
        restaurantName: body.payload.restaurantName,
        targetRecipients: body.payload.targetRecipients,
        ...(body.payload.metadata ? { metadata: body.payload.metadata } : {})
      }
    };

    // Log payload to CloudWatch — actual delivery channel is owned by Keane
    console.log("[notification-event]", JSON.stringify(notificationEvent));

    return json(200, { ok: true, eventType: notificationEvent.eventType, listingId: notificationEvent.listingId });
  } catch (error) {
    if (error instanceof Error && error.message.includes("required")) return badRequest(error.message);
    return internalError(error);
  }
};
