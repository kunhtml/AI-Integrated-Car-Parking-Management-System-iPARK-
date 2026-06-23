import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { apiRoutes } from "./routes/index.js";

export const app = express();

// Giới hạn tần suất yêu cầu (Rate Limit) cho toàn bộ API để tránh tấn công DoS
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 300, // Tối đa 300 yêu cầu từ mỗi IP
  message: { message: "Quá nhiều yêu cầu từ IP của bạn, vui lòng thử lại sau 15 phút." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Giới hạn tần suất đặc biệt cho các hành động xác thực nhạy cảm
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 30, // Tối đa 30 yêu cầu đăng nhập/đăng ký/quên mật khẩu
  message: { message: "Yêu cầu quá thường xuyên. Vui lòng thử lại sau 15 phút." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/verify-otp", authLimiter);
app.use("/api/auth/reset-password", authLimiter);

app.use("/api", globalLimiter, apiRoutes);
app.use(errorMiddleware);
