import type { MetadataRoute } from "next";

// Keeps /admin out of crawl paths. Belt-and-suspenders with the
// `robots: { index: false }` metadata on src/app/admin/page.tsx itself —
// a robots.txt disallow alone doesn't guarantee de-indexing of a URL
// discovered some other way (a link from elsewhere, etc.), only noindex
// does.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
  };
}
