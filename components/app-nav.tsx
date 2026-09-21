"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/locale";

const primaryLinks = [
  { href: "/", en: "V2 Summary", es: "V2 Resumen" },
  { href: "/pipeline", en: "Pipeline", es: "Pipeline" },
  { href: "/whatsapp", en: "WhatsApp", es: "WhatsApp" },
  { href: "/llamadas", en: "Calls", es: "Llamadas" },
  { href: "/eod", en: "EOD", es: "EOD" },
  { href: "/legacy", en: "V1 Legacy", es: "V1 Legacy" },
  { href: "/reconciliation", en: "Reconciliation", es: "Reconciliación" },
  { href: "/logs", en: "Logs", es: "Logs" },
  { href: "/sistema", en: "System", es: "Sistema" },
];

const afterSchoolLink = { href: "/after-school", en: "After School", es: "After School" };

export function AppNav({ locale, showStudents = false }: { locale: Locale; showStudents?: boolean }) {
  const pathname = usePathname();
  const links = [
    ...primaryLinks,
    ...(showStudents ? [{ href: "/alumnos", en: "Students", es: "Alumnos" }] : []),
    afterSchoolLink,
  ];

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
            className={active ? "nav-link nav-link-active" : "nav-link"}
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
