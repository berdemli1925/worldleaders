import { NextRequest, NextResponse } from "next/server";

// Site-wide password gate for while the project isn't ready to be public —
// a free-plan-compatible stand-in for Vercel's Password Protection
// (Deployment Protection), which is a Pro-only feature. Uses plain HTTP
// Basic Auth: the browser shows its own native username/password prompt,
// no login page to build. Any username works — only the password matters.
//
// Fails OPEN when SITE_ACCESS_PASSWORD isn't set, specifically so local dev
// is never accidentally locked out — only set this env var in Vercel's
// project settings once you actually want the live domain gated, and remove
// it there (not here) once the site is ready to launch.
//
// /api/cron is excluded: Vercel Cron calls it server-to-server with its own
// `Authorization: Bearer $CRON_SECRET` header (checked inside that route
// itself) — it can't complete a Basic Auth challenge, so gating it here
// would silently break the scheduled job.
export function middleware(request: NextRequest) {
  const password = process.env.SITE_ACCESS_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice("Basic ".length), "base64").toString("utf-8");
    const suppliedPassword = decoded.split(":")[1] ?? "";
    if (suppliedPassword === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="World Leaders"' },
  });
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
