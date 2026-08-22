import { createClient } from "@supabase/supabase-js";

// Browser-safe Supabase client using the publishable (anon) key. Used for the
// live leaderboard view (public, read-only) and Realtime broadcast/presence
// channels — never for anything that needs to bypass Row Level Security.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables.",
  );
}

export const supabaseBrowser = createClient(url, publishableKey);
