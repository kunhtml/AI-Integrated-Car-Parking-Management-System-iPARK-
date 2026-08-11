import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const isProduction = process.env.NODE_ENV === "production";
const localJwtSecret =
  "local-development-secret-for-bai-do-xe-please-change-in-production";
const localServiceToken = "smart-parking-rut-gon-service-token-change-me";

function readSecret(name: "JWT_SECRET" | "SERVICE_TOKEN", localDefault: string) {
  const value = process.env[name]?.trim();
  const normalized = value?.toLowerCase() ?? "";
  const isWeak =
    !value ||
    value.length < 32 ||
    normalized.includes("change-me") ||
    normalized.includes("changeme") ||
    normalized.includes("default") ||
    normalized.includes("placeholder") ||
    value === localDefault;

  if (isProduction && isWeak) {
    throw new Error(
      `${name} must be set to a strong, non-default value of at least 32 characters in production.`,
    );
  }

  return value || localDefault;
}

const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (!isProduction) {
  corsOrigins.push(
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
  );
}

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bai-do-xe",
  mongoDb: process.env.MONGODB_DB || "bai-do-xe",
  jwtSecret: readSecret("JWT_SECRET", localJwtSecret),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  corsOrigins: [...new Set(corsOrigins)],
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://127.0.0.1:5000",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/api/auth/google/callback",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || "iPARK <no-reply@ipark.local>",
  totpIssuer: process.env.TOTP_ISSUER || "iPARK",
  serviceToken: readSecret("SERVICE_TOKEN", localServiceToken),
};
