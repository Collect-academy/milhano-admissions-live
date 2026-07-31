import type { ReactNode } from "react";

import { AppNav } from "@/components/app-nav";

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  children: ReactNode;
};

export function DashboardLayout({
  eyebrow,
  title,
  subtitle,
  statusLabel,
  children,
}: Props) {
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
        <span>Fuente: GHL → n8n → Supabase</span>
      </footer>
    </main>
  );
}
