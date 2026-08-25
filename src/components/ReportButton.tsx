"use client";

import { useState } from "react";

import { REPORT_REASONS } from "@/lib/report-reasons";

interface ReportButtonProps {
  throneClaimId: number;
  /** Compact rendering for tight spaces (the ticker) vs. the leaderboard's fuller panel. */
  compact?: boolean;
}

// Small flag icon everywhere a leader's post is shown (leaderboard panel,
// ticker item) — opens an inline reason picker, no native confirm()/prompt()
// dialogs. Posts to /api/throne/report; doesn't take any moderation action
// itself, just queues it for /admin.
export default function ReportButton({ throneClaimId, compact }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/throne/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ throneClaimId, reason, details: details.trim() || undefined }),
      });
      setDone(true);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return <span className="text-[11px] text-muted-2">Reported</span>;
  }

  return (
    <span
      className="relative inline-block"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Report this content"
        title="Report this content"
        className={
          compact
            ? "text-muted-2 hover:text-danger"
            : "rounded-sm border border-border px-2 py-1 text-[11px] text-muted-2 hover:border-danger/40 hover:text-danger"
        }
      >
        {compact ? "⚑" : "Report"}
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="absolute right-0 top-full z-10 mt-1 flex w-64 flex-col gap-2 rounded-md border border-border bg-surface p-3 shadow-lg"
        >
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
          >
            {REPORT_REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Details (optional)"
            rows={2}
            className="resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-foreground">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-sm bg-danger px-3 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Submit"}
            </button>
          </div>
        </form>
      )}
    </span>
  );
}
