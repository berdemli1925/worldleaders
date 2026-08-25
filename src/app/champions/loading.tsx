export default function Loading() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-4xl animate-pulse flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-48 rounded-sm bg-surface" />
          <div className="h-4 w-64 rounded-sm bg-surface" />
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 w-full rounded-md border border-border bg-surface" />
          ))}
        </div>
      </main>
    </div>
  );
}
