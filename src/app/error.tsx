"use client";

import Link from "next/link";
import { useEffect } from "react";

// Error boundaries must be Client Components. Wraps everything under the
// root layout (nav/footer still render normally — this only replaces
// page content) — see global-error.tsx for the root-layout-itself case.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 bg-background px-4 py-12 text-center">
      <p className="font-mono text-sm text-muted-2">Error</p>
      <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted">
        That&apos;s on us, not you. Try again, or head back to the map.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:brightness-110"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          Back to the map
        </Link>
      </div>
    </div>
  );
}
