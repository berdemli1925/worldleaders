import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-4 py-12 text-center">
      <p className="font-mono text-sm text-muted-2">404</p>
      <h1 className="text-2xl font-semibold text-foreground">This country isn&apos;t on the map</h1>
      <p className="max-w-sm text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:brightness-110"
      >
        Back to the map
      </Link>
    </div>
  );
}
