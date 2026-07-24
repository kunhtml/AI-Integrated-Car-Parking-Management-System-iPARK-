import type { Response } from "express";

export type RealtimeEventName = "recognition-log" | "device-status" | "notification" | "ping";

export type RealtimeEvent = {
  type: RealtimeEventName;
  data: unknown;
  at: string;
};

type Client = {
  id: string;
  response: Response;
  roles?: string[];
};

const clients = new Map<string, Client>();

function writeEvent(response: Response, event: RealtimeEvent) {
  response.write(`event: ${event.type}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function subscribeRealtime(response: Response, roles?: string[]) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  clients.set(id, { id, response, roles });

  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.write("\n");

  writeEvent(response, {
    type: "ping",
    data: { ok: true, clients: clients.size },
    at: new Date().toISOString(),
  });

  const heartbeat = setInterval(() => {
    try {
      response.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    clients.delete(id);
  };

  response.on("close", cleanup);
  response.on("error", cleanup);

  return id;
}

export function publishRealtime(type: RealtimeEventName, data: unknown) {
  const event: RealtimeEvent = {
    type,
    data,
    at: new Date().toISOString(),
  };

  for (const client of clients.values()) {
    try {
      writeEvent(client.response, event);
    } catch {
      clients.delete(client.id);
    }
  }
}

export function getRealtimeClientCount() {
  return clients.size;
}
