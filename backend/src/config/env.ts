import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:3000",
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ipark",
  skipAuth: process.env.SKIP_AUTH === "true",
  jwtSecret: process.env.JWT_SECRET || "dev_jwt_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  resetTokenSecret: process.env.RESET_TOKEN_SECRET || "dev_reset_secret_change_me",
  resetTokenExpiresIn: process.env.RESET_TOKEN_EXPIRES_IN ?? "10m",
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
  otpExpiresInMinutes: Number(process.env.OTP_EXPIRES_IN_MINUTES ?? 5),
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 30),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || "",
  totpIssuer: process.env.TOTP_ISSUER || "iPARK",
  encryptionKey: process.env.ENCRYPTION_KEY || "dev_encryption_key_change_me",
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "iPARK <no-reply@ipark.local>",
  },
};
