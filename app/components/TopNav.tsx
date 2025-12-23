"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/single", label: "Single" },
  { href: "/compare", label: "Compare" },
  { href: "/batch", label: "Batch" }
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-8 flex items-center justify-between gap-4">
      <Link href="/" className="text-lg font-bold text-white">
        ColorGamut
      </Link>
      <div className="flex items-center gap-3 text-sm">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-xl px-3 py-2 transition ${
              pathname === link.href
                ? "bg-ink-accent text-slate-900"
                : "text-slate-200 hover:bg-slate-800"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
