import { NextRequest, NextResponse } from "next/server";

import { fetchLinkPreview } from "@/lib/link-preview";

// Pure UX helper for ThroneClaimModal's "Fetch info" button — reads a page's
// title/description/og:image so the claimer doesn't have to type the
// Content section by hand. Never trusted as-is: whatever ends up in
// brandTitle/description/logoUrl (whether typed or auto-filled) still goes
// through /api/throne/claim's own banned-word check on submit.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ ok: false, error: "Missing 'url'." }, { status: 400 });
  }

  const preview = await fetchLinkPreview(url);
  if (!preview.ok) {
    return NextResponse.json({ ok: false, error: preview.reason }, { status: 422 });
  }

  return NextResponse.json(preview);
}
