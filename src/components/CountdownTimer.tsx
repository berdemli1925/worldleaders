// Pure/presentational — the ticking clock lives once in Dashboard and is
// passed down as `now`, rather than every card running its own setInterval.
// `now === null` means "not mounted on the client yet"; we render a dash
// instead of a value computed from server-time so hydration never mismatches.
interface CountdownTimerProps {
  target: number;
  now: number | null;
  className?: string;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "Ended";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function CountdownTimer({ target, now, className }: CountdownTimerProps) {
  return <span className={className}>{now === null ? "—" : formatDuration(target - now)}</span>;
}
