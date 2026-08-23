import type { Metadata } from "next";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapThroneRow, type ThroneRow } from "@/lib/throne";
import LeadersList from "./LeadersList";

export const metadata: Metadata = {
  title: "Leaders — World Leaders",
  description: "Every country with an active leader right now.",
};

export default async function LeadersPage() {
  const { data, error } = await supabaseAdmin
    .from("thrones_with_leader")
    .select(
      "country_iso_code, base_price, current_value, current_claim_id, cycle_start, cycle_end, x_handle, amount_paid, post_text, post_author_name, post_author_avatar_url, post_image_url, post_created_at, brand_title, description, link_url, logo_url, claimed_at, post_image_width, post_image_height, post_image_scale, post_image_offset_x, post_image_offset_y, leader_x_url, leader_instagram_url, leader_tiktok_url, leader_facebook_url",
    )
    .not("current_value", "is", null)
    .order("current_value", { ascending: false });

  const thrones = (error ? [] : (data ?? [])).map((row) => mapThroneRow(row as ThroneRow));

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Leaders</h1>
          <p className="max-w-xl text-sm text-muted">Every country with an active leader, right now.</p>
        </div>
        <LeadersList thrones={thrones} />
      </main>
    </div>
  );
}
