// Sharing your vote on X grants +5 votes to the country you shared, once
// ever per person (IP + browser fingerprint, same pairing voting itself
// uses). Unlike the starting score/throne bonus, this genuinely needs
// server-side state — "once per person, ever" can't be derived from data
// that already exists — so it's the one piece of this feature set that
// needs a real database table: see scripts/setup-share-bonus.mjs (must be
// run once, with DATABASE_URL, before /api/share/bonus works — see that
// route for the exact failure mode until then) and the `share_bonuses` /
// `share_bonuses_public` objects it creates.
export const SHARE_VOTE_BONUS = 5;
