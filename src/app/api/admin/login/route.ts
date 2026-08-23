import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, checkPassword, createSessionToken } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : null;

  let ok: boolean;
  try {
    ok = Boolean(password) && checkPassword(password as string);
  } catch {
    // ADMIN_PASSWORD isn't set — a config problem, not a wrong-password
    // attempt, so it gets its own clear message instead of a generic 500.
    return NextResponse.json({ error: "ADMIN_PASSWORD isn't configured on the server." }, { status: 500 });
  }

  if (!ok) {
    // Deliberately vague — no "wrong password" vs "no such user" distinction
    // to leak, though there's only ever one password here anyway.
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h, matches admin-auth's SESSION_MAX_AGE_MS
  });
  return response;
}
