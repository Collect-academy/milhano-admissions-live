import Link from "next/link";

import { DashboardLayout } from "@/components/dashboard-layout";

import "./after-school.css";

const nav = [
  ["/after-school", "Resumen"],
  ["/after-school/participants", "Participantes"],
  ["/after-school/sessions", "Sesiones"],
  ["/after-school/allocation", "Asignación"],
  ["/after-school/attendance", "Asistencia"],
  ["/after-school/config", "Configuración"],
] as const;

export default function AfterSchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout
      eyebrow="Milhano · After School"
      title="After School / Workshops"
      subtitle="Operación, cupos, asistencia y conversión del After School Experience."
      statusLabel="AS26 · Operación"
    >
      <section className="asShell">
        <div className="asTop">
          <div>
            <p className="asSub">
              Gestión independiente de Admissions · 20 lugares por sesión
            </p>
          </div>
          <Link
            className="asBtn primary"
            href="/after-school/registro"
            prefetch={false}
            target="_blank"
          >
            Ver registro público
          </Link>
        </div>
        <nav className="asNav" aria-label="After School sections">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} prefetch>
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </section>
    </DashboardLayout>
  );
}
