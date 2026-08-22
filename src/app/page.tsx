import WorldMap from "@/components/WorldMap";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-12 font-sans dark:bg-black">
      <main className="flex w-full max-w-5xl flex-col items-center gap-6">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          World Leaders
        </h1>
        <p className="max-w-xl text-center text-zinc-600 dark:text-zinc-400">
          An interactive map where the world&apos;s countries compete by vote.
        </p>
        <div className="w-full rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <WorldMap />
        </div>
      </main>
    </div>
  );
}
