"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import Logo from "@/components/Logo";
import { PAYMENTS_ENABLED } from "@/lib/beta-mode";

const LINKS = [
  { href: "/", label: "Rankings" },
  { href: "/leaders", label: "Leaders" },
  { href: "/champions", label: "Champions" },
  { href: "/about", label: "About" },
  { href: "/rules", label: "Rules" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Logo />
          {!PAYMENTS_ENABLED && (
            <Link
              href="/rules"
              title="Leadership is free during the beta — see Rules for details"
              className="rounded-sm border border-accent/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent transition-colors hover:bg-accent/10"
            >
              Beta
            </Link>
          )}
        </div>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
          {LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "rounded-sm bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                    : "rounded-sm px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground sm:hidden"
        >
          <span className="sr-only">Menu</span>
          {mobileOpen ? "×" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <nav
          aria-label="Main (mobile)"
          className="flex flex-col gap-1 border-t border-border px-4 py-3 sm:hidden"
        >
          {LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={
                  isActive
                    ? "rounded-sm bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
                    : "rounded-sm px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
