// Banned-word filter for throne-claim content (post text, brand title,
// description). Kept as a flat, easy-to-edit list in its own file rather
// than a database table — add or remove entries here and redeploy, no
// migration needed.
//
// Matching is case-insensitive substring matching (see findBannedWord
// below), so keep entries as short, specific fragments rather than full
// phrases, and be mindful of false positives inside longer words.
//
// This is a starter list, not an exhaustive one — extend the category
// arrays below as you find gaps. Turkish entries deliberately include both
// the standard-diacritic spelling and a plain-ASCII fold (ç→c, ğ→g, ı/İ→i,
// ö→o, ş→s, ü→u) since that's the realistic evasion pattern for a
// substring filter, rather than trying to normalize accents in code.
//
// Ethnic/religious group names are inherently context-dependent (neutral
// in most use, a slur only when used as one) — the entries here are
// derogatory forms/slang specifically, not plain ethnonyms, to keep false
// positives down. Review and tune this category in particular for your
// audience.

const ENGLISH_PROFANITY = [
  "fuck",
  "fucker",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "piss off",
  "whore",
  "slut",
  "twat",
  "wanker",
  "prick",
  "douchebag",
];

const ENGLISH_SEXUAL_CONTENT = [
  "porn",
  "porno",
  "xxx",
  "nude",
  "nudes",
  "nsfw",
  "blowjob",
  "handjob",
  "cumshot",
  "gangbang",
  "hentai",
  "camgirl",
  "onlyfans",
];

const ENGLISH_SLURS = [
  "nigger",
  "nigga",
  "chink",
  "spic",
  "kike",
  "wetback",
  "gook",
  "raghead",
  "towelhead",
  "coon",
  "tranny",
  "faggot",
  "fag",
  "dyke",
  "retard",
  "retarded",
];

const ENGLISH_THREATS = [
  "kill you",
  "kill yourself",
  "kys",
  "gonna kill",
  "i will kill",
  "i'll kill",
  "i will hurt you",
  "i'll hurt you",
  "you're dead",
  "ur dead",
  "i will find you",
  "i have a gun",
  "bomb threat",
];

const TURKISH_PROFANITY = [
  "amk",
  "amına koyayım",
  "amina koyayim",
  "siktir",
  "siktir git",
  "orospu",
  "orospu çocuğu",
  "orospu cocugu",
  "piç",
  "pic",
  "yavşak",
  "yavsak",
  "got herif",
  "göt herif",
  "şerefsiz",
  "serefsiz",
  "namussuz",
  "puşt",
  "pust",
  "kaltak",
  "sürtük",
  "surtuk",
  "yarrak",
  "yarak",
  "amcık",
  "amcik",
  "taşak",
  "tasak",
  "ananı sikeyim",
  "anani sikeyim",
  "dallama",
];

const TURKISH_SEXUAL_CONTENT = ["porno", "çıplak fotoğraf", "ciplak fotograf", "seks kaseti", "götveren", "gotveren"];

const TURKISH_SLURS = ["kıro", "kiro", "zenci herif", "çingene dölü", "cingene dolu"];

const TURKISH_THREATS = [
  "seni öldürürüm",
  "seni oldururum",
  "geberteceğim",
  "gebertecegim",
  "keserim seni",
  "canını alırım",
  "canini alirim",
  "öldüreceğim seni",
  "oldurecegim seni",
  "kanını içerim",
  "kanini icerim",
  "mezara gömerim",
  "mezara gomerim",
];

export const BANNED_WORDS: string[] = [
  ...ENGLISH_PROFANITY,
  ...ENGLISH_SEXUAL_CONTENT,
  ...ENGLISH_SLURS,
  ...ENGLISH_THREATS,
  ...TURKISH_PROFANITY,
  ...TURKISH_SEXUAL_CONTENT,
  ...TURKISH_SLURS,
  ...TURKISH_THREATS,
];

/**
 * Returns the first banned word found in `text`, or null if none match.
 * The caller decides what to do with the match (this module never exposes
 * *which* word matched to end users — see src/app/api/throne/claim, which
 * shows a generic rejection message instead of naming the trigger word).
 */
export function findBannedWord(text: string): string | null {
  if (BANNED_WORDS.length === 0) return null;
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (word && lower.includes(word.toLowerCase())) return word;
  }
  return null;
}
