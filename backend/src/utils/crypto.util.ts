import crypto from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";

function deriveKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const candidate = trimmed.startsWith("base64:")
    ? trimmed.slice("base64:".length)
    : trimmed;

  const asBase64 = Buffer.from(candidate, "base64");
  if (asBase64.length === 32) return asBase64;

  const asHex = Buffer.from(candidate, "hex");
  if (asHex.length === 32) return asHex;

  return crypto.createHash("sha256").update(candidate).digest();
}

function getKey(): Buffer {
  return deriveKey(env.encryptionKey || process.env.ENCRYPTION_KEY || "");
}

export function encryptField(plain: string): string {
  if (!plain) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptField(payload: string): string {
  if (!payload) return payload;
  const parts = payload.split(":");
  if (parts.length !== 3) return payload;

  const [ivB64, authTagB64, encryptedB64] = parts;
  if (!ivB64 || !authTagB64 || !encryptedB64) return payload;

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function fingerprintField(plain: string): string {
  if (!plain) return "";
  return crypto.createHash("sha256").update(plain).digest("hex");
}
