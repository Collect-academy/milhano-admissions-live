"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Summary" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/llamadas", label: "Calls" },
  { href: "/eod", label: "EOD" },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/sistema", label: "System" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard sections"
      className="app-nav"
    >
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);

        return (
          <Link
            className={
              active
                ? "nav-link nav-link-active"
                : "nav-link"
            }
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
