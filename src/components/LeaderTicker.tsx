import Flag from "./Flag";
import ReportButton from "./ReportButton";

export interface TickerItem {
  isoCode: string;
  countryName: string;
  handle: string;
  amountPaid: number;
  throneClaimId: number;
}

interface LeaderTickerProps {
  items: TickerItem[];
  onSelect: (isoCode: string) => void;
}

function TickerRow({ items, onSelect, hidden }: { items: TickerItem[]; onSelect: (iso: string) => void; hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item, index) => (
        <div
          key={`${item.isoCode}-${index}`}
          role="button"
          tabIndex={hidden ? -1 : 0}
          onClick={() => onSelect(item.isoCode)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(item.isoCode);
            }
          }}
          className="flex shrink-0 cursor-pointer items-center gap-2 border-r border-border px-4 py-2.5 text-sm hover:bg-surface-hover"
        >
          <Flag alpha2={item.isoCode} width={18} />
          <span className="font-medium text-foreground">{item.countryName}</span>
          <span className="text-muted-2">·</span>
          <span className="text-muted">@{item.handle}</span>
          <span className="font-mono font-semibold text-accent">
            {item.amountPaid > 0 ? `$${item.amountPaid.toLocaleString("en-US")}` : "Free"}
          </span>
          {!hidden && <ReportButton throneClaimId={item.throneClaimId} compact />}
        </div>
      ))}
    </div>
  );
}

// Fixed band pinned to the bottom of the viewport, continuously scrolling
// right-to-left. The item list is rendered twice back to back and the track
// animates exactly -50% so the loop is seamless; the second copy is
// aria-hidden to keep screen readers from reading everything twice.
export default function LeaderTicker({ items, onSelect }: LeaderTickerProps) {
  if (items.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 overflow-hidden border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="group overflow-hidden">
        <div className="flex w-max animate-ticker group-hover:[animation-play-state:paused]">
          <TickerRow items={items} onSelect={onSelect} />
          <TickerRow items={items} onSelect={onSelect} hidden />
        </div>
      </div>
    </div>
  );
}
