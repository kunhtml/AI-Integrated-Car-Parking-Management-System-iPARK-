import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function parseSessionUser(rawToken?: string) {
  if (!rawToken) return null;

  const token = rawToken.replace(/^Bearer\s+/i, "");
  const candidates = [token, decodeURIComponent(token)];
  const jwtPayload = token.split(".")[1];
  if (jwtPayload) {
    candidates.push(decodeBase64Url(jwtPayload));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        id: parsed.id || parsed.sub || parsed.userId,
        role: parsed.role || "customer",
        email: parsed.email,
      };
    } catch {
      // Keep trying other token shapes.
    }
  }

  return { id: token, role: "customer" };
}

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

  req.user = parseSessionUser(authHeader || cookie) || { role: "customer" };
  next();
}

export function requireRole(roles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
}
