// Voting is IP-based (no accounts, per the project spec), so every vote needs
// a caller IP. On Vercel, `x-forwarded-for` is set by the platform itself at
// the edge and can't be spoofed by the client. Locally (no proxy in front of
// `next dev`), it's usually absent, so we fall back to a fixed dev address.
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "127.0.0.1";
}
