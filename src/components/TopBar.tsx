import CountdownTimer from "./CountdownTimer";

interface TopBarProps {
  totalVotes: number;
  votesToday: number;
  resetTarget: number | null;
  now: number | null;
}

function StatBox({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-2xl border border-border bg-surface px-4 py-3">
      <span className="text-xs text-muted-2">{label}</span>
      <span className={`text-xl font-semibold text-foreground ${mono ? "font-mono tabular-nums" : ""}`}>{value}</span>
    </div>
  );
}

// AŞAMA 6: "Online now" (a presence count that reads as dead when it's
// low — exactly the moments a pre-launch/early site is in most) is gone,
// replaced by "Votes today" — an activity number that's honest at any
// traffic level and only ever goes up over the course of a day.
export default function TopBar({ totalVotes, votesToday, resetTarget, now }: TopBarProps) {
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row">
      <StatBox label="Total votes" value={totalVotes.toLocaleString("en-US")} mono />
      <StatBox
        label="Votes today"
        mono
        value={
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
            {votesToday.toLocaleString("en-US")}
          </span>
        }
      />
      <StatBox
        label="Ranking resets in"
        mono
        value={resetTarget !== null ? <CountdownTimer target={resetTarget} now={now} /> : "—"}
      />
    </div>
  );
}
