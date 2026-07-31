"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Resumen" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/llamadas", label: "Llamadas" },
  { href: "/eod", label: "EOD" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="Secciones del dashboard">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);

        return (
          <Link
            className={active ? "nav-link nav-link-active" : "nav-link"}
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
