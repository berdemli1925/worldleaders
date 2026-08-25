import { ImageResponse } from "next/og";

import { getCountryMeta } from "@/lib/country-meta";
import { getRankedLeaderboard } from "@/lib/country-rank";
import { flagUrl } from "@/lib/flag";
import { findClosestRival } from "@/lib/rank";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const contentType = "image/png";

// Site's current dark/serious theme tokens (see globals.css) — hardcoded
// because satori can't read CSS custom properties.
const BG = "#0a0a0b";
const FG = "#f4f4f5";
const MUTED = "#9c9ca4";
const MUTED_2 = "#6c6c74";
const BORDER = "#2b2b30";
const GOLD = "#d8ab35"; // --cta-text
const RED = "#9c332b"; // --cta-border

const BRAND_BAR = (
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    {/* Corner brand mark — same "Coordinate" glyph as the site header (see
        components/Logo.tsx), redrawn for satori. */}
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M4 12c6-4 18-4 24 0" stroke={MUTED_2} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 21c6 3.6 18 3.6 24 0" stroke={MUTED_2} strokeWidth="1.7" strokeLinecap="round" opacity={0.6} />
      <path d="M16 4c4.3 5.3 4.3 18.7 0 24" stroke={MUTED_2} strokeWidth="1.7" strokeLinecap="round" opacity={0.55} />
      <circle cx="22.5" cy="15.5" r="2.3" fill={GOLD} />
    </svg>
    <span style={{ display: "flex", fontSize: 28, color: MUTED_2 }}>worldleaders.lol</span>
  </div>
);

// A Route Handler rather than the opengraph-image file convention — there's
// no /countries/[iso] page today, so this is generated on demand from
// ?country= links (see page.tsx's generateMetadata) instead of adding 250
// new statically-generated routes. Always built from the current ranking at
// request time — direct request: "kart görseli her paylaşımda o anki
// güncel verilerle üretilsin, sabit bir görsel olmasın."
export async function GET(_request: Request, { params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const isoCode = iso.toUpperCase();
  const meta = getCountryMeta(isoCode);

  const [rows, { data: throneRow }] = await Promise.all([
    getRankedLeaderboard(), // ranked by total power (AŞAMA 5) — see src/lib/rank.ts
    supabaseAdmin
      .from("thrones_with_leader")
      .select("x_handle")
      .eq("country_iso_code", isoCode)
      .not("current_value", "is", null)
      .maybeSingle(),
  ]);

  const rank = rows.findIndex((row) => row.isoCode === isoCode);
  const voteCount = rank >= 0 ? rows[rank].voteCount : 0;
  // Direct request: the share card is a matchup against the closest rival
  // — whichever neighbor in the ranking is nearest in votes — rather than
  // the country shown alone, unless the gap is too big for that to read
  // as a real contest (see findClosestRival). rank is 0-based here; the
  // helper works on the same rows/index either way.
  const rival = rank >= 0 ? findClosestRival(rows, isoCode) : null;

  if (rival) {
    const selfSide = { isoCode, name: meta?.name ?? isoCode, voteCount, rank: rank + 1 };
    const rivalRank = rival.direction === "ahead" ? rank : rank + 2; // adjacent by construction
    const rivalSide = { isoCode: rival.isoCode, name: rival.name, voteCount: rival.voteCount, rank: rivalRank };
    // Higher vote count on the left — same convention as the share text
    // (buildMatchupShareText) and the ClosestBattles UI section.
    const [left, right] = selfSide.voteCount >= rivalSide.voteCount ? [selfSide, rivalSide] : [rivalSide, selfSide];

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: 70,
            background: BG,
            color: FG,
          }}
        >
          <div style={{ display: "flex", fontSize: 26, color: MUTED_2, letterSpacing: 2, textTransform: "uppercase" }}>
            #{left.rank} vs #{right.rank} on World Leaders
          </div>

          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
            {[left, right].map((side, i) => (
              <div
                key={side.isoCode}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: i === 0 ? "flex-start" : "flex-end",
                  gap: 18,
                  width: 420,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={flagUrl(side.isoCode, 320)}
                  alt=""
                  width={180}
                  height={120}
                  style={{ borderRadius: 14, objectFit: "cover", border: `2px solid ${BORDER}` }}
                />
                <div style={{ display: "flex", fontSize: 52, fontWeight: 700, textAlign: i === 0 ? "left" : "right" }}>
                  {side.name}
                </div>
                <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: GOLD }}>
                  {side.voteCount.toLocaleString("en-US")}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: -30 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 84,
                height: 84,
                borderRadius: 999,
                border: `3px solid ${RED}`,
                background: BG,
                fontSize: 26,
                fontWeight: 700,
                color: RED,
              }}
            >
              VS
            </div>
            <div style={{ display: "flex", fontSize: 26, color: MUTED, fontWeight: 500 }}>
              Only {rival.gap.toLocaleString("en-US")} points apart
            </div>
          </div>

          <div style={{ display: "flex", marginTop: "auto", paddingTop: 40 }}>{BRAND_BAR}</div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  // No rival close enough to name — single-country fallback.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 80,
          background: BG,
          color: FG,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flagUrl(isoCode, 320)}
            alt=""
            width={200}
            height={133}
            style={{ borderRadius: 16, objectFit: "cover", border: `2px solid ${BORDER}` }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 68, fontWeight: 700 }}>{meta?.name ?? isoCode}</div>
            <div style={{ display: "flex", gap: 20, fontSize: 34, color: MUTED }}>
              {rank >= 0 && <span style={{ display: "flex" }}>#{rank + 1} this month</span>}
              <span style={{ display: "flex" }}>{voteCount.toLocaleString("en-US")} votes</span>
            </div>
          </div>
        </div>

        {throneRow?.x_handle ? (
          <div style={{ display: "flex", marginTop: 56, fontSize: 36, fontWeight: 600, color: GOLD }}>
            Led by @{throneRow.x_handle}
          </div>
        ) : (
          <div style={{ display: "flex", marginTop: 56, fontSize: 32, color: MUTED_2 }}>
            No leader yet — claim the throne.
          </div>
        )}

        <div style={{ display: "flex", marginTop: "auto" }}>{BRAND_BAR}</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
