"use client";

import { useState } from "react";

// Temporary diagnostic page — NOT part of the real leader-post feature.
// Pastes a tweet URL, calls /api/x-preview (which tries the syndication
// endpoint and the official oEmbed endpoint, both unauthenticated), and
// dumps the raw JSON each one returns. Built to answer one question: can we
// get a post's text/author/handle/avatar/image/date without logging in.
export default function XEmbedTestPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/x-preview?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Request failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-3xl flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">X post fetch test</h1>
          <p className="text-sm text-muted">
            Temporary diagnostic page. Paste a tweet/post URL — this calls the syndication and oEmbed endpoints
            (both unauthenticated) and shows exactly what each one returns, raw.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://x.com/user/status/1234567890"
            className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted-2 outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || !url}
            className="rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Fetching…" : "Fetch"}
          </button>
        </form>

        {error && <p className="text-sm text-danger">{error}</p>}

        {result !== null && (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-surface p-4 text-xs text-foreground">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </main>
    </div>
  );
}
