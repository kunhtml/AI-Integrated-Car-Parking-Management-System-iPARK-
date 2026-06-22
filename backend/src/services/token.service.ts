import { SignJWT, jwtVerify } from "jose";
import type { Types } from "mongoose";
import { env } from "../config/env.js";

const jwtSecret = new TextEncoder().encode(env.jwtSecret);
const resetSecret = new TextEncoder().encode(env.resetTokenSecret);

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface ResetTokenPayload {
  email: string;
  purpose: "reset_password";
}

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

export async function signAccessToken(payload: AccessTokenPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn)
    .sign(jwtSecret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, jwtSecret);

  return payload as unknown as AccessTokenPayload & { sub: string };
}

export async function signSession(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn)
    .sign(jwtSecret);
}

export async function verifySession(token?: string): Promise<SessionUser | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    const id = String(payload.id || payload.sub || "");
    if (!id) {
      return null;
    }

    return {
      id,
      email: String(payload.email || ""),
      role: String(payload.role || "customer"),
      name: payload.name ? String(payload.name) : undefined,
    };
  } catch {
    return null;
  }
}

export async function signResetToken(payload: ResetTokenPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.email)
    .setIssuedAt()
    .setExpirationTime(env.resetTokenExpiresIn)
    .sign(resetSecret);
}

export async function verifyResetToken(token: string) {
  const { payload } = await jwtVerify(token, resetSecret);

  return payload as unknown as ResetTokenPayload & { sub: string };
}

export function normalizeUserId(id: Types.ObjectId | string) {
  return typeof id === "string" ? id : id.toString();
}
