import dotenv from "dotenv";

dotenv.config();

function requiredEnv(key: string, fallback?: string) {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  mongoUri: requiredEnv("MONGO_URI", "mongodb://127.0.0.1:27017/ipark"),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
  jwtSecret: requiredEnv("JWT_SECRET", "dev_jwt_secret_change_me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  resetTokenSecret: requiredEnv("RESET_TOKEN_SECRET", "dev_reset_secret_change_me"),
  resetTokenExpiresIn: process.env.RESET_TOKEN_EXPIRES_IN ?? "10m",
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
  otpExpiresInMinutes: Number(process.env.OTP_EXPIRES_IN_MINUTES ?? 5),
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 30),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "iPARK <no-reply@ipark.local>",
  },
};
