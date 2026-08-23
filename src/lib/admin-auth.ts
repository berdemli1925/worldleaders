import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

// Single-password admin auth — no accounts, no session table. A session is
// just `${issuedAtMs}.${hmac(issuedAtMs)}` signed with ADMIN_PASSWORD,
// stored in an httpOnly cookie. Verifying only needs the cookie value and
// the env var — no database round-trip, no state to clean up. Server-only:
// never import this from a "use client" file.

export const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h

function secret(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (!value) {
    throw new Error("ADMIN_PASSWORD is not set.");
  }
  return value;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on mismatched lengths — pad to equal length with
  // a constant-time-irrelevant early return instead (the length check
  // itself leaks length, which is unavoidable and not sensitive here).
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function checkPassword(candidate: string): boolean {
  return timingSafeStringEqual(candidate, secret());
}

export function createSessionToken(): string {
  const issuedAt = Date.now().toString();
  const sig = createHmac("sha256", secret()).update(issuedAt).digest("hex");
  return `${issuedAt}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [issuedAt, sig] = token.split(".");
  if (!issuedAt || !sig) return false;
  if (!/^\d+$/.test(issuedAt)) return false;
  if (Date.now() - Number(issuedAt) > SESSION_MAX_AGE_MS) return false;

  const expected = createHmac("sha256", secret()).update(issuedAt).digest("hex");
  return timingSafeStringEqual(sig, expected);
}

/** Shared guard for every /api/admin/* route (except login itself). */
export function isAdminRequest(request: NextRequest): boolean {
  return verifySessionToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
}
