import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";
import { UserRole } from "../models/User.js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  avatarUrl?: string;
  provider?: string;
};

function secretKey() {
  return new TextEncoder().encode(env.jwtSecret);
}

export async function signSession(user: AuthUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secretKey());
}

export async function verifySession(token?: string): Promise<AuthUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as AuthUser;
  } catch {
    return null;
  }
}
