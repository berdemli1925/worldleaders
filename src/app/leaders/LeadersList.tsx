"use client";

import { useEffect, useState } from "react";

import CountdownTimer from "@/components/CountdownTimer";
import Flag from "@/components/Flag";
import { getCountryMeta } from "@/lib/country-meta";
import type { ThroneEntry } from "@/lib/throne";

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface LeadersListProps {
  thrones: ThroneEntry[];
}

// Only responsibility beyond rendering: run one shared ticking clock so
// every row's CountdownTimer is live — same minimal pattern as
// Dashboard.tsx, just for this standalone page.
export default function LeadersList({ thrones }: LeadersListProps) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (thrones.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
        Nobody holds a throne right now — be the first from the rankings page.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {thrones.map((throne) => {
        const meta = getCountryMeta(throne.isoCode);
        return (
          <article key={throne.isoCode} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
                <Flag alpha2={throne.isoCode} width={32} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{meta?.name ?? throne.isoCode}</p>
                  <a
                    href={`https://x.com/${throne.handle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-xs text-muted hover:text-accent"
                  >
                    {throne.brandTitle || `@${throne.handle}`}
                  </a>
                </div>
              </div>

              {throne.postImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={throne.postImageUrl}
                  alt=""
                  className="h-32 w-full shrink-0 rounded-xl object-cover sm:h-20 sm:w-32"
                />
              )}

              <div className="min-w-0 flex-1">
                {throne.description && <p className="text-sm text-muted">{throne.description}</p>}
                {throne.linkUrl && (
                  <a
                    href={throne.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-muted-2 hover:text-accent"
                  >
                    {throne.linkUrl}
                  </a>
                )}
                <p className="mt-2 font-mono text-xs text-muted">
                  Paid <span className="text-accent">{formatMoney(throne.currentValue ?? 0)}</span>
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-[11px] text-muted-2">Reign ends in</p>
                <CountdownTimer target={throne.cycleEnd ?? 0} now={now} className="font-mono text-sm text-foreground" />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
