import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

import { logout } from "@/app/login/actions";
import { AppNav } from "@/components/app-nav";
import { LanguageToggle } from "@/components/language-toggle";
import { DisplayPreferences } from "@/components/display-preferences";
import {
  isSupabaseAuthConfigured,
  requireAdmissionsAppUser,
} from "@/lib/auth";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  children: ReactNode;
};

const roleLabels = {
  advisor: "Advisor",
  admin: "Admin",
  viewer: "Leadership",
  student_staff: "Student staff",
} as const;

export async function DashboardLayout({
  eyebrow,
  title,
  subtitle,
  statusLabel,
  children,
}: Props) {
  const user = await requireAdmissionsAppUser();
  const locale = await getDashboardLocale();
  const individualAuth = isSupabaseAuthConfigured();

  return (
    <main className="dashboard-shell">
      <div className="navigation-row">
        <div className="brand-lockup">
          <span className="brand-mark">M</span>
          <div>
            <strong>Milhano</strong>
            <span>Admissions OS</span>
          </div>
        </div>
        <AppNav locale={locale} showStudents={user.role === "admin"} />
        <div className="session-controls">
          <DisplayPreferences locale={locale} />
          {user.username?.toLowerCase() !== "monacashflow" ? (
            <LanguageToggle locale={locale} />
          ) : null}
          <div className="session-user">
            <strong>{user.displayName}</strong>
            <span>{locale === "es" ? ({ advisor: "Asesora", admin: "Admin", viewer: "Dirección", student_staff: "Expediente escolar" } as const)[user.role] : roleLabels[user.role]}</span>
          </div>
          {individualAuth ? (
            <form action={logout}>
              <button
                aria-label="Sign out"
                type="submit"
              >
                <LogOut size={16} />
                {tr(locale, "Sign Out", "Salir")}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <header className="topbar">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        <div className="data-badge">
          <span className="status-dot" />
          {statusLabel}
        </div>
      </header>

      {children}

      <footer className="footer">
        <span>{tr(locale, "Milhano Operations Dashboard · Live", "Dashboard Operativo Milhano · Live")}</span>
        <span>{tr(locale, "Sources: GHL + EOD + verified manual adjustments → Supabase", "Fuentes: GHL + EOD + ajustes manuales verificados → Supabase")}</span>
      </footer>
    </main>
  );
}
