import Link from "next/link";

import WorldMap from "@/components/WorldMap";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-4xl flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">World leaders</h1>
          <p className="max-w-xl text-sm text-muted">
            Vote for your country, watch the ranking shift, and see who&apos;s currently sitting on the throne.
          </p>
          <Link href="/champions" className="text-sm text-muted underline-offset-4 hover:text-accent hover:underline">
            See past months&apos; champions →
          </Link>
        </div>
        <WorldMap />
      </main>
    </div>
  );
}
