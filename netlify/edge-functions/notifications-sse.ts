// Edge Function for persistent Server-Sent Events without 10-second timeout
// Copyright © 2025
// Comments in English as per project standards

import { notificationService } from "../../src/lib/ailock/notification-service.ts";

// Lightweight utilities compatible with Edge runtime (no external npm modules)
function base64UrlDecode(str: string): string {
  // Replace URL-safe chars and add padding
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  return atob(str);
}

function decodeJwtPayload(token: string): any | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = base64UrlDecode(payload);
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function getAuthTokenFromHeaders(headers: Record<string, string>): string | null {
  const cookieHeader = headers["cookie"] || headers["Cookie"];
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split("; ");
  for (const c of cookies) {
    const [name, ...rest] = c.split("=");
    if (name === "auth_token") return rest.join("=");
  }
  return null;
}

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
  const payload = decodeJwtPayload(token);
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
