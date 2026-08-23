import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cookies", label: "Cookie Policy" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 px-4 py-6 text-xs text-muted-2 sm:flex-row sm:justify-between">
        <p>&copy; {new Date().getFullYear()} World Leaders</p>
        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
