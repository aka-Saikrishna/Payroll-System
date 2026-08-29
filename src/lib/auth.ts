import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "veekay_token";

const encoder = new TextEncoder();

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return encoder.encode(secret);
}

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: "ADMIN" | "PAYROLL_MANAGER" | "VIEWER";
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN || "8h";
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Reads and verifies the session from the request cookie jar (server components / route handlers). */
export async function getSessionUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function roleAtLeast(role: SessionPayload["role"], required: SessionPayload["role"][]): boolean {
  return required.includes(role);
}
