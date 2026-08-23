import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import SiteNav from "@/components/SiteNav";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono-numeric",
  subsets: ["latin"],
});

// Resolves relative URLs used elsewhere in metadata (OG images, canonical
// links, etc.) against the real production domain instead of Vercel's
// preview-deployment URL. Doesn't affect anything on localhost/preview —
// Next.js only uses this to build absolute URLs.
export const metadata: Metadata = {
  metadataBase: new URL("https://worldleaders.lol"),
  title: "World Leaders",
  description: "Vote for your favorite country on an interactive world map.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${displayFont.variable} ${monoFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
