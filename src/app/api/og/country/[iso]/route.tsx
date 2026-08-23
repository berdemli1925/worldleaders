import { ImageResponse } from "next/og";

import { getCountryMeta } from "@/lib/country-meta";
import { flagUrl } from "@/lib/flag";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const contentType = "image/png";

// A Route Handler rather than the opengraph-image file convention — there's
// no /countries/[iso] page today, so this is generated on demand from
// ?country= links (see page.tsx's generateMetadata) instead of adding 250
// new statically-generated routes.
export async function GET(_request: Request, { params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const isoCode = iso.toUpperCase();
  const meta = getCountryMeta(isoCode);

  const [{ data: ranking }, { data: throneRow }] = await Promise.all([
    supabaseAdmin.from("leaderboard").select("iso_code, vote_count").order("vote_count", { ascending: false }),
    supabaseAdmin
      .from("thrones_with_leader")
      .select("x_handle")
      .eq("country_iso_code", isoCode)
      .not("current_value", "is", null)
      .maybeSingle(),
  ]);

  const rows = (ranking ?? []) as { iso_code: string; vote_count: number }[];
  const rank = rows.findIndex((row) => row.iso_code === isoCode);
  const voteCount = rank >= 0 ? rows[rank].vote_count : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 80,
          background: "#0a0a0b",
          color: "#f4f4f5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flagUrl(isoCode, 320)}
            alt=""
            width={200}
            height={133}
            style={{ borderRadius: 16, objectFit: "cover", border: "2px solid #2b2b30" }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 68, fontWeight: 700 }}>{meta?.name ?? isoCode}</div>
            <div style={{ display: "flex", gap: 20, fontSize: 34, color: "#9c9ca4" }}>
              {rank >= 0 && <span style={{ display: "flex" }}>#{rank + 1} this month</span>}
              <span style={{ display: "flex" }}>{voteCount.toLocaleString("en-US")} votes</span>
            </div>
          </div>
        </div>

        {throneRow?.x_handle ? (
          <div
            style={{
              display: "flex",
              marginTop: 56,
              fontSize: 36,
              fontWeight: 600,
              color: "#f5b301",
            }}
          >
            Led by @{throneRow.x_handle}
          </div>
        ) : (
          <div style={{ display: "flex", marginTop: 56, fontSize: 32, color: "#6c6c74" }}>
            No leader yet — claim the throne.
          </div>
        )}

        <div style={{ display: "flex", marginTop: "auto", fontSize: 28, color: "#6c6c74" }}>worldleaders.lol</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
