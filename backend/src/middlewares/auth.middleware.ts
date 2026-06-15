import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

// Minimal middleware: in dev you can set SKIP_AUTH=true to bypass checks.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (process.env.SKIP_AUTH === "true" || env.skipAuth) {
    // attach a demo user
    (req as any).user = { id: "dev-user", role: "admin", email: "dev@local" };
    next();
    return;
  }

  // otherwise expect cookie 'parking_session' or Authorization header (bearer)
  const cookie = req.cookies?.parking_session;
  const authHeader = req.headers.authorization;
  if (!cookie && !authHeader) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  // For now, we don't validate tokens here - assume downstream will validate if needed.
  (req as any).user = { id: "user-from-token", role: "customer" };
  next();
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (user.role !== role) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
}
