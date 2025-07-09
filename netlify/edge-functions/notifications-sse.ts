// Edge Function for persistent Server-Sent Events without 10-second timeout
// Copyright © 2025
// Comments in English as per project standards

import { verifyToken, getAuthTokenFromHeaders } from "../../src/lib/auth/auth-utils.ts";
import { notificationService } from "../../src/lib/ailock/notification-service.ts";

export default async (request: Request, context: any): Promise<Response> => {
  // Allow only GET
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Resolve origin for CORS (Edge: request.headers.get("origin") may be null)
  const origin = request.headers.get("origin") || request.headers.get("referer") || "*";

  // ===== Authentication (Bearer header OR cookie auth_token) =====
  let token: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    token = getAuthTokenFromHeaders(Object.fromEntries(request.headers.entries()));
  }
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }
  const payload = verifyToken(token);
  if (!payload?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }
  const userId = payload.sub;

  // Prepare SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Helper to send SSE formatted events
  const send = (event: string, data: any) => {
    writer.write(`event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`);
  };

  // Initial events: connection + unread notifications
  const unread = await notificationService.getUserUnreadNotifications(userId);
  send("connection", { type: "connection", status: "connected", userId });
  send("notifications", { type: "notifications", notifications: unread });

  // Keep-alive ping every 25 seconds (Edge functions have no hard timeout)
  const pingInterval = setInterval(() => {
    send("ping", { type: "ping", timestamp: Date.now() });
  }, 25000);

  // Close handler if client aborts
  request.signal.addEventListener("abort", () => {
    clearInterval(pingInterval);
    writer.close();
  });

  // Ensure interval is cleaned up when function context ends
  context.waitUntil(
    new Promise<void>((resolve) => {
      request.signal.addEventListener("abort", () => resolve());
    })
  );

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};
