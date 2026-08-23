export default function Loading() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-4xl animate-pulse flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-56 rounded-full bg-surface" />
          <div className="h-4 w-72 rounded-full bg-surface" />
        </div>
        <div className="aspect-[960/500] w-full rounded-2xl border border-border bg-surface" />
        <div className="flex w-full flex-col gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 w-full rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      </main>
    </div>
  );
}
