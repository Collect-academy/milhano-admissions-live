"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/locale";

const links = [
  { href: "/", en: "Summary", es: "Resumen" },
  { href: "/pipeline", en: "Pipeline", es: "Pipeline" },
  { href: "/whatsapp", en: "WhatsApp", es: "WhatsApp" },
  { href: "/llamadas", en: "Calls", es: "Llamadas" },
  { href: "/eod", en: "EOD", es: "EOD" },
  { href: "/reconciliation", en: "Reconciliation", es: "Reconciliación" },
  { href: "/logs", en: "Logs", es: "Logs" },
  { href: "/sistema", en: "System", es: "Sistema" },
];

export function AppNav({ locale, showStudents = false }: { locale: Locale; showStudents?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard sections"
      className="app-nav"
    >
      {[...links, ...(showStudents ? [{ href: "/alumnos", en: "Students", es: "Alumnos" }] : [])].map((link) => {
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
            {locale === "es" ? link.es : link.en}
          </Link>
        );
      })}
    </nav>
  );
}
