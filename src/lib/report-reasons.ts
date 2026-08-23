// Shared between ReportButton.tsx (the <select> options) and
// src/app/api/throne/report/route.ts (server-side validation) — kept in one
// place so they can't drift apart.
export const REPORT_REASONS = ["Inappropriate content", "Spam", "Impersonation", "Sensitive or NSFW", "Other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
