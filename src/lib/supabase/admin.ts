import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the secret key — this bypasses Row Level
// Security entirely, so it must only ever be imported from server-side code
// (Route Handlers, Server Components). Never import this from a "use client"
// file or expose SUPABASE_SECRET_KEY to the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY environment variables.",
  );
}

export const supabaseAdmin = createClient(url, secretKey, {
  auth: { persistSession: false },
});
