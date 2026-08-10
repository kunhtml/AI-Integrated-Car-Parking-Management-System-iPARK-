import crypto from "node:crypto";
import { env } from "../config/env.js";

const DEFAULT_SERVICE_TOKEN = "smart-parking-rut-gon-service-token-change-me";

export function getServiceToken(): string {
  return (env as Record<string, unknown>).serviceToken as string | undefined || DEFAULT_SERVICE_TOKEN;
}

export function generateServiceToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}