import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bai-do-xe",
  mongoDb: process.env.MONGODB_DB || "bai-do-xe",
  jwtSecret:
    process.env.JWT_SECRET ||
    "local-development-secret-for-bai-do-xe-please-change-in-production",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
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
  serviceToken: process.env.SERVICE_TOKEN || "smart-parking-rut-gon-service-token-change-me",
};
