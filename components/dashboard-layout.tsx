import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

import { logout } from "@/app/login/actions";
import { AppNav } from "@/components/app-nav";
import {
  isSupabaseAuthConfigured,
  requireCurrentAppUser,
} from "@/lib/auth";

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
} as const;

export async function DashboardLayout({
  eyebrow,
  title,
  subtitle,
  statusLabel,
  children,
}: Props) {
  const user = await requireCurrentAppUser();
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
        <AppNav />
        <div className="session-controls">
          <div className="session-user">
            <strong>{user.displayName}</strong>
            <span>{roleLabels[user.role]}</span>
          </div>
          {individualAuth ? (
            <form action={logout}>
              <button
                aria-label="Sign out"
                type="submit"
              >
                <LogOut size={16} />
                Sign Out
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
        <span>Milhano Operations Dashboard · Live</span>
        <span>Sources: GHL + EOD + verified manual adjustments → Supabase</span>
      </footer>
    </main>
  );
}
