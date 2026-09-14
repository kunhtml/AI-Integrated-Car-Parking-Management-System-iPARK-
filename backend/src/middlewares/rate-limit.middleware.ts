import { NextFunction, Request, Response } from "express";

/**
 * Rate limiter nhẹ cho các route nhạy cảm (đăng nhập, OTP, quên mật khẩu).
 *
 * SEC: chặn brute-force OTP/mật khẩu theo IP. Không thêm dependency mới —
 * dùng bộ đếm trong bộ nhớ (đủ cho 1 instance backend hiện tại).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Dọn bucket hết hạn định kỳ để không rò rỉ bộ nhớ.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweepAt = Date.now();

function sweep(now: number) {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function rateLimit(options: {
  /** Số request tối đa trong mỗi cửa sổ. */
  max: number;
  /** Độ rộng cửa sổ (ms). */
  windowMs: number;
  /** Tiền tố key để phân biệt các route dùng chung middleware. */
  keyPrefix: string;
}) {
  return function rateLimitMiddleware(
    request: Request,
    response: Response,
    next: NextFunction,
  ) {
    const now = Date.now();
    sweep(now);

    const key = `${options.keyPrefix}:${request.ip ?? "unknown"}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      response.set("Retry-After", String(retryAfter));
      response.status(429).json({
        message: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfter} giây.`,
        retryAfter,
      });
      return;
    }

    next();
  };
}
