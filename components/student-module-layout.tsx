import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, LogOut, UsersRound } from "lucide-react";

import { logout } from "@/app/login/actions";
import { isSupabaseAuthConfigured } from "@/lib/auth";
import { DisplayPreferences } from "@/components/display-preferences";
import { requireStudentModuleContext } from "@/lib/student-records";

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  statusLabel?: string;
  children: ReactNode;
};

export async function StudentModuleLayout({ eyebrow, title, subtitle, statusLabel, children }: Props) {
  const context = await requireStudentModuleContext();
  const individualAuth = isSupabaseAuthConfigured();

  return (
    <main className="dashboard-shell student-shell">
      <div className="navigation-row student-navigation-row">
        <div className="brand-lockup">
          <span className="brand-mark">M</span>
          <div>
            <strong>Milhano</strong>
            <span>Expediente escolar</span>
          </div>
        </div>

        <nav className="app-nav" aria-label="Expediente escolar">
          <Link className="nav-link nav-link-active" href="/alumnos">
            <UsersRound size={14} />
            Alumnos
          </Link>
          {context.user.role === "admin" ? (
            <Link className="nav-link" href="/">
              <ArrowLeft size={14} />
              Admissions
            </Link>
          ) : null}
        </nav>

        <div className="session-controls">
          <DisplayPreferences locale="es" />
          <div className="session-user">
            <strong>{context.user.displayName}</strong>
            <span>Expediente escolar</span>
          </div>
          {individualAuth ? (
            <form action={logout}>
              <button aria-label="Cerrar sesión" type="submit">
                <LogOut size={16} />
                Salir
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <header className="topbar student-topbar">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        {statusLabel ? (
          <div className="data-badge">
            <span className="status-dot" />
            {statusLabel}
          </div>
        ) : null}
      </header>

      {children}

      <footer className="footer student-footer">
        <span>Milhano · Expediente escolar</span>
        <span>Información resguardada en Supabase con permisos por formato.</span>
      </footer>
    </main>
  );
}
