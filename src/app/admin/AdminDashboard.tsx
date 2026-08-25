"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CTA_CLASSES } from "@/lib/cta-style";

export interface ActiveLeader {
  country: string;
  claimId: number;
  handle: string;
  brandTitle: string | null;
  description: string | null;
  logoUrl: string | null;
  linkUrl: string | null;
  postText: string | null;
  amountPaid: number;
  currentValue: number;
  cycleEnd: string;
}

export interface ModerationReport {
  id: number;
  throneClaimId: number;
  reason: string;
  details: string | null;
  createdAt: string;
}

export interface BlockedHandle {
  xHandle: string;
  reason: string | null;
  blockedAt: string;
}

export interface PaymentRow {
  id: number;
  country: string;
  handle: string;
  amount: number;
  creditApplied: number | null;
  netAmount: number | null;
  provider: string;
  providerReference: string | null;
  status: "pending" | "completed" | "failed";
  failureReason: string | null;
  createdAt: string;
}

interface AdminDashboardProps {
  activeLeaders: ActiveLeader[];
  moderationReports: ModerationReport[];
  blockedHandles: BlockedHandle[];
  leadershipHidden: boolean;
  paymentRows: PaymentRow[];
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Every mutation here follows the same shape: POST, refresh the server
// component on success, surface the error inline otherwise. Deliberately
// not optimistic — this is an internal tool, correctness over snappiness.
async function post(url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => null);
  return { ok: false, error: data?.error ?? `Request failed (${res.status}).` };
}

function statusClasses(status: PaymentRow["status"]): string {
  if (status === "completed") return "bg-accent/15 text-accent";
  if (status === "failed") return "bg-danger/15 text-danger";
  return "bg-surface-hover text-muted";
}

const inputClasses =
  "rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent";

// Direct request: "her şeye müdahale edilebilir olsun kolayca" — a way to
// fix a claim's content in place (typo, a broken logo link, toning down a
// description) instead of the only lever being "remove entirely" below.
// Local, uncontrolled-from-parent state: opens pre-filled from the current
// claim, and only the fields actually changed are sent (see
// /api/admin/claims/[id]/edit — undefined fields are left alone server-side
// too), so leaving three fields untouched and fixing one doesn't blank the
// other three.
function EditClaimForm({
  leader,
  onSave,
  onCancel,
  busy,
}: {
  leader: ActiveLeader;
  onSave: (fields: { brandTitle: string; description: string; logoUrl: string; linkUrl: string }) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [brandTitle, setBrandTitle] = useState(leader.brandTitle ?? "");
  const [description, setDescription] = useState(leader.description ?? "");
  const [logoUrl, setLogoUrl] = useState(leader.logoUrl ?? "");
  const [linkUrl, setLinkUrl] = useState(leader.linkUrl ?? "");

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <input
        value={brandTitle}
        onChange={(event) => setBrandTitle(event.target.value)}
        placeholder="Brand / title"
        className={inputClasses}
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description"
        rows={2}
        className={`${inputClasses} resize-none`}
      />
      <input
        value={logoUrl}
        onChange={(event) => setLogoUrl(event.target.value)}
        placeholder="Logo image URL"
        className={inputClasses}
      />
      <input
        value={linkUrl}
        onChange={(event) => setLinkUrl(event.target.value)}
        placeholder="Link URL"
        className={inputClasses}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave({ brandTitle, description, logoUrl, linkUrl })}
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60 ${CTA_CLASSES}`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-hover"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard({
  activeLeaders,
  moderationReports,
  blockedHandles,
  leadershipHidden,
  paymentRows,
}: AdminDashboardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockHandleInput, setBlockHandleInput] = useState("");
  const [blockReasonInput, setBlockReasonInput] = useState("");
  const [editingClaimId, setEditingClaimId] = useState<number | null>(null);
  const [priceCountryInput, setPriceCountryInput] = useState("");
  const [priceValueInput, setPriceValueInput] = useState("");

  async function run(key: string, url: string, body?: unknown) {
    setBusy(key);
    setError(null);
    const result = await post(url, body);
    if (!result.ok) setError(result.error ?? "Something went wrong.");
    setBusy(null);
    router.refresh();
  }

  async function runAnd(key: string, url: string, body: unknown, after: () => void) {
    setBusy(key);
    setError(null);
    const result = await post(url, body);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
    } else {
      after();
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between rounded-md border border-danger/40 bg-danger/10 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Emergency kill switch</p>
          <p className="text-xs text-muted">
            {leadershipHidden
              ? "All leadership content is hidden site-wide, and new claims are paused."
              : "Leadership content is visible normally."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy === "kill-switch"}
          onClick={() => run("kill-switch", "/api/admin/kill-switch", { hidden: !leadershipHidden })}
          className={
            leadershipHidden
              ? "rounded-sm bg-surface-hover px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
              : "rounded-sm bg-danger px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          }
        >
          {leadershipHidden ? "Restore leadership content" : "Hide all leadership content"}
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Set a country&apos;s base price</h2>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-4">
          <input
            value={priceCountryInput}
            onChange={(event) => setPriceCountryInput(event.target.value)}
            placeholder="ISO code (e.g. TR)"
            maxLength={2}
            className={`${inputClasses} w-32 uppercase`}
          />
          <input
            value={priceValueInput}
            onChange={(event) => setPriceValueInput(event.target.value)}
            placeholder="Base price ($)"
            inputMode="decimal"
            className={`${inputClasses} w-36`}
          />
          <button
            type="button"
            disabled={!priceCountryInput.trim() || !priceValueInput.trim() || busy === "set-base-price"}
            onClick={() =>
              runAnd(
                "set-base-price",
                `/api/admin/thrones/${priceCountryInput.trim()}/set-base-price`,
                { basePrice: Number(priceValueInput) },
                () => setPriceValueInput(""),
              )
            }
            className={`px-3 py-1.5 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60 ${CTA_CLASSES}`}
          >
            Set price
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Active leaders ({activeLeaders.length})</h2>
        {activeLeaders.length === 0 && <p className="text-sm text-muted">No active leaders.</p>}
        <div className="flex flex-col gap-3">
          {activeLeaders.map((leader) => (
            <div key={leader.claimId} className="rounded-md border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {leader.country} — @{leader.handle}
                    {leader.brandTitle ? ` · ${leader.brandTitle}` : ""}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-2">{leader.postText}</p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    Paid {formatMoney(leader.amountPaid)} · throne worth {formatMoney(leader.currentValue)} · ends{" "}
                    {new Date(leader.cycleEnd).toLocaleString("en-US")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingClaimId((current) => (current === leader.claimId ? null : leader.claimId))}
                    className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-hover"
                  >
                    {editingClaimId === leader.claimId ? "Close" : "Edit"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === `remove-${leader.claimId}`}
                    onClick={() =>
                      run(`remove-${leader.claimId}`, `/api/admin/claims/${leader.claimId}/remove`, {
                        reason: "Removed by admin.",
                      })
                    }
                    className="rounded-sm bg-danger/15 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/25"
                  >
                    Remove content
                  </button>
                  <button
                    type="button"
                    disabled={busy === `reset-${leader.country}`}
                    onClick={() => run(`reset-${leader.country}`, `/api/admin/thrones/${leader.country}/reset`)}
                    className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-hover"
                  >
                    Reset throne
                  </button>
                </div>
              </div>
              {editingClaimId === leader.claimId && (
                <EditClaimForm
                  leader={leader}
                  busy={busy === `edit-${leader.claimId}`}
                  onCancel={() => setEditingClaimId(null)}
                  onSave={(fields) =>
                    runAnd(`edit-${leader.claimId}`, `/api/admin/claims/${leader.claimId}/edit`, fields, () =>
                      setEditingClaimId(null),
                    )
                  }
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Open reports ({moderationReports.length})</h2>
        {moderationReports.length === 0 && <p className="text-sm text-muted">No open reports.</p>}
        <div className="flex flex-col gap-3">
          {moderationReports.map((report) => (
            <div key={report.id} className="rounded-md border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {report.reason} — claim #{report.throneClaimId}
                  </p>
                  {report.details && <p className="mt-1 text-xs text-muted-2">{report.details}</p>}
                  <p className="mt-1 text-xs text-muted">{new Date(report.createdAt).toLocaleString("en-US")}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy === `remove-${report.throneClaimId}`}
                    onClick={() =>
                      run(`remove-${report.throneClaimId}`, `/api/admin/claims/${report.throneClaimId}/remove`, {
                        reason: `Removed following report: ${report.reason}`,
                      })
                    }
                    className="rounded-sm bg-danger/15 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/25"
                  >
                    Remove content
                  </button>
                  <button
                    type="button"
                    disabled={busy === `resolve-${report.id}`}
                    onClick={() => run(`resolve-${report.id}`, `/api/admin/reports/${report.id}/resolve`, {})}
                    className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-hover"
                  >
                    Mark resolved
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Blocked handles ({blockedHandles.length})</h2>
        <div className="flex flex-wrap gap-2 rounded-md border border-border bg-surface p-4">
          <input
            type="text"
            value={blockHandleInput}
            onChange={(event) => setBlockHandleInput(event.target.value)}
            placeholder="@handle"
            className={`flex-1 ${inputClasses}`}
          />
          <input
            type="text"
            value={blockReasonInput}
            onChange={(event) => setBlockReasonInput(event.target.value)}
            placeholder="Reason (optional)"
            className={`flex-1 ${inputClasses}`}
          />
          <button
            type="button"
            disabled={!blockHandleInput.trim() || busy === "block"}
            onClick={async () => {
              await run("block", "/api/admin/handles/block", {
                xHandle: blockHandleInput.trim(),
                reason: blockReasonInput.trim() || null,
              });
              setBlockHandleInput("");
              setBlockReasonInput("");
            }}
            className={`px-3 py-1.5 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60 ${CTA_CLASSES}`}
          >
            Block
          </button>
        </div>
        {blockedHandles.length === 0 && <p className="text-sm text-muted">No blocked handles.</p>}
        <div className="flex flex-col gap-2">
          {blockedHandles.map((blocked) => (
            <div
              key={blocked.xHandle}
              className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-2"
            >
              <p className="text-sm text-foreground">
                @{blocked.xHandle}
                {blocked.reason && <span className="text-muted-2"> — {blocked.reason}</span>}
              </p>
              <button
                type="button"
                disabled={busy === `unblock-${blocked.xHandle}`}
                onClick={() =>
                  run(`unblock-${blocked.xHandle}`, "/api/admin/handles/unblock", { xHandle: blocked.xHandle })
                }
                className="rounded-sm border border-border px-3 py-1 text-xs text-muted hover:bg-surface-hover"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Payments (last {paymentRows.length})</h2>
        {paymentRows.length === 0 && <p className="text-sm text-muted">No payments yet.</p>}
        <div className="flex flex-col gap-2">
          {paymentRows.map((payment) => (
            <div key={payment.id} className="rounded-md border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {payment.country} — @{payment.handle}
                    <span className={`ml-2 rounded-sm px-2 py-0.5 text-xs font-medium ${statusClasses(payment.status)}`}>
                      {payment.status}
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {formatMoney(payment.amount)}
                    {payment.creditApplied !== null && ` · credit ${formatMoney(payment.creditApplied)}`}
                    {payment.netAmount !== null && ` · net ${formatMoney(payment.netAmount)}`}
                    {" · "}
                    {payment.provider}
                    {payment.providerReference ? ` (${payment.providerReference})` : ""}
                  </p>
                  {payment.failureReason && <p className="mt-1 text-xs text-danger">{payment.failureReason}</p>}
                  <p className="mt-1 text-xs text-muted-2">{new Date(payment.createdAt).toLocaleString("en-US")}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={async () => {
          await fetch("/api/admin/logout", { method: "POST" });
          router.refresh();
        }}
        className="self-start text-sm text-muted hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
