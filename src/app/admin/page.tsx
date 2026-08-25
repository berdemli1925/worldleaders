import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AdminDashboard, {
  type ActiveLeader,
  type BlockedHandle,
  type ModerationReport,
  type PaymentRow,
} from "./AdminDashboard";
import AdminLoginForm from "./AdminLoginForm";

// noindex/nofollow at the page level — the reliable de-indexing control.
// src/app/robots.ts's Disallow is the crawl-level backstop.
export const metadata: Metadata = {
  title: "Admin — World Leaders",
  robots: { index: false, follow: false },
};

// Deliberately queries the raw tables (thrones, throne_claims, ...) via
// supabaseAdmin rather than the public thrones_with_leader/thrones_live
// views — those views mask everything when the kill switch is on, which is
// exactly the state an admin needs to see through, not be subject to.
async function loadAdminData() {
  const [{ data: thrones }, { data: reports }, { data: blocked }, { data: settings }, { data: payments }] =
    await Promise.all([
      supabaseAdmin
        .from("thrones")
        .select("country_iso_code, base_price, current_value, current_claim_id, cycle_start, cycle_end")
        .not("current_claim_id", "is", null),
      supabaseAdmin
        .from("moderation_reports")
        .select("id, throne_claim_id, reason, details, created_at")
        .is("resolved_at", null)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("blocked_handles")
        .select("x_handle, reason, blocked_at")
        .order("blocked_at", { ascending: false }),
      supabaseAdmin.from("site_settings").select("value").eq("key", "leadership_hidden").maybeSingle(),
      supabaseAdmin
        .from("payments")
        .select(
          "id, country_iso_code, x_handle, amount, credit_applied, net_amount, provider, provider_reference, status, failure_reason, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const claimIds = (thrones ?? []).map((t) => t.current_claim_id as number);
  const { data: claims } =
    claimIds.length > 0
      ? await supabaseAdmin
          .from("throne_claims")
          .select("id, x_handle, amount_paid, brand_title, description, logo_url, link_url, post_text, removed_at")
          .in("id", claimIds)
      : { data: [] };
  const claimById = new Map((claims ?? []).map((c) => [c.id, c]));

  const activeLeaders: ActiveLeader[] = (thrones ?? [])
    .map((t) => {
      const claim = claimById.get(t.current_claim_id as number);
      // Skip rows whose cycle already ended (stored state can lag until the
      // next sweep) or whose claim was already removed.
      const cycleEnd = t.cycle_end as string | null;
      const stillActive = cycleEnd !== null && new Date(cycleEnd).getTime() > Date.now();
      if (!claim || !stillActive || claim.removed_at) return null;
      return {
        country: t.country_iso_code as string,
        claimId: claim.id as number,
        handle: claim.x_handle as string,
        brandTitle: claim.brand_title as string | null,
        description: claim.description as string | null,
        logoUrl: claim.logo_url as string | null,
        linkUrl: claim.link_url as string | null,
        postText: claim.post_text as string | null,
        amountPaid: claim.amount_paid as number,
        currentValue: t.current_value as number,
        cycleEnd: cycleEnd as string,
      };
    })
    .filter((row): row is ActiveLeader => row !== null);

  const moderationReports: ModerationReport[] = (reports ?? []).map((r) => ({
    id: r.id as number,
    throneClaimId: r.throne_claim_id as number,
    reason: r.reason as string,
    details: r.details as string | null,
    createdAt: r.created_at as string,
  }));

  const blockedHandles: BlockedHandle[] = (blocked ?? []).map((b) => ({
    xHandle: b.x_handle as string,
    reason: b.reason as string | null,
    blockedAt: b.blocked_at as string,
  }));

  const leadershipHidden = settings?.value === true;

  const paymentRows: PaymentRow[] = (payments ?? []).map((p) => ({
    id: p.id as number,
    country: p.country_iso_code as string,
    handle: p.x_handle as string,
    amount: p.amount as number,
    creditApplied: p.credit_applied as number | null,
    netAmount: p.net_amount as number | null,
    provider: p.provider as string,
    providerReference: p.provider_reference as string | null,
    status: p.status as "pending" | "completed" | "failed",
    failureReason: p.failure_reason as string | null,
    createdAt: p.created_at as string,
  }));

  return { activeLeaders, moderationReports, blockedHandles, leadershipHidden, paymentRows };
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuthed = verifySessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  if (!isAuthed) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
        <AdminLoginForm />
      </div>
    );
  }

  const data = await loadAdminData();

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-4xl flex-col gap-8">
        <h1 className="text-2xl font-semibold text-foreground">Admin</h1>
        <AdminDashboard {...data} />
      </main>
    </div>
  );
}
