export const env = {
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  port: Number(process.env.PORT || 4000),
  skipAuth: process.env.SKIP_AUTH === "true",
};
