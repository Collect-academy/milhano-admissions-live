import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock3,
  DatabaseZap,
  Info,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { dateTimeLabel, number } from "@/lib/format";
import { getSystemHealthData } from "@/lib/system-health";
import { getDashboardLocale } from "@/lib/i18n";
import { tr, type Locale } from "@/lib/locale";

export const dynamic = "force-dynamic";

const statusLabels = {
  healthy: "Healthy",
  warning: "Warning",
  error: "Error",
  pending: "Pending",
  unknown: "Unknown",
  pass: "Pass",
  info: "Info",
};

function systemStatusLabel(status: keyof typeof statusLabels | string, locale: Locale): string {
  const es: Record<string, string> = {
    healthy: "Saludable", warning: "Alerta", error: "Error", pending: "Pendiente",
    unknown: "Desconocido", pass: "Correcto", info: "Info",
  };
  return locale === "es" ? (es[status] ?? status) : (statusLabels[status as keyof typeof statusLabels] ?? status);
}

function statusClass(status: string): string {
  if (status === "healthy" || status === "pass") {
    return "status-pill status-good";
  }

  if (status === "error") {
    return "status-pill status-bad";
  }

  return "status-pill status-pending";
}

function ageLabel(minutes: number | null, locale: Locale): string {
  if (minutes === null) return tr(locale, "No execution", "Sin ejecución");

  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  if (minutes < 1440) {
    return `${Math.round(minutes / 60)} hr`;
  }

  return `${Math.round(minutes / 1440)} ${tr(locale, "days", "días")}`;
}

export default async function SystemPage() {
  const locale = await getDashboardLocale();
  const data = await getSystemHealthData();

  const healthy = data.health.filter(
    (row) => row.status === "healthy",
  ).length;
  const warning = data.health.filter(
    (row) =>
      row.status === "warning" ||
      row.status === "unknown",
  ).length;
  const errors =
    data.health.filter((row) => row.status === "error").length +
    data.quality.filter((row) => row.status === "error").length;
  const qualityIssues = data.quality.reduce(
    (total, row) =>
      total +
      (row.status === "warning" || row.status === "error"
        ? row.issue_count
        : 0),
    0,
  );

  return (
    <DashboardLayout
      eyebrow={tr(locale, "Reliability", "Confiabilidad")}
      title={tr(locale, "System Health", "Salud del Sistema")}
      subtitle={tr(locale, "Synchronization freshness and basic data-quality checks.", "Actualización de sincronizaciones y validaciones básicas de calidad de datos.")}
      statusLabel={`${tr(locale, "Overall Status", "Estado General")}: ${systemStatusLabel(data.overallStatus, locale)}`}
    >
      <section
        className={
          data.overallStatus === "healthy"
            ? "scope-banner scope-banner-success"
            : data.overallStatus === "error"
              ? "scope-banner system-banner-error"
              : "scope-banner"
        }
      >
        {data.overallStatus === "healthy" ? (
          <ShieldCheck size={20} />
        ) : data.overallStatus === "error" ? (
          <XCircle size={20} />
        ) : (
          <AlertTriangle size={20} />
        )}
        <div>
          <strong>
            {data.overallStatus === "healthy"
              ? tr(locale, "Monitored components are within their expected windows.", "Los componentes monitoreados están dentro de sus ventanas esperadas.")
              : data.overallStatus === "error"
                ? tr(locale, "At least one component or data check is in error.", "Al menos un componente o validación de datos tiene error.")
                : tr(locale, "Some components are pending or require review.", "Algunos componentes están pendientes o requieren revisión.")}
          </strong>
          <span>
            {tr(locale, "This monitor detects stale data; it does not replace GHL reconciliation.", "Este monitor detecta datos desactualizados; no reemplaza la reconciliación con GHL.")}
          </span>
        </div>
      </section>

      <section className="kpi-grid pipeline-kpi-grid">
        <KpiCard
          label={tr(locale, "Healthy Components", "Componentes Saludables")}
          value={number(healthy)}
          helper={`${number(data.health.length)} ${tr(locale, "monitored", "monitoreados")}`}
          icon={CheckCircle2}
        />
        <KpiCard
          label={tr(locale, "Warnings", "Alertas")}
          value={number(warning)}
          helper={tr(locale, "Require observation", "Requieren observación")}
          icon={AlertTriangle}
        />
        <KpiCard
          label={tr(locale, "Errors", "Errores")}
          value={number(errors)}
          helper={tr(locale, "Require action", "Requieren acción")}
          icon={XCircle}
        />
        <KpiCard
          label={tr(locale, "Data Issues", "Problemas de Datos")}
          value={number(qualityIssues)}
          helper={tr(locale, "Warnings + errors", "Alertas + errores")}
          icon={DatabaseZap}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Freshness", "Actualización")}</p>
            <h2>{tr(locale, "Operational Components", "Componentes Operativos")}</h2>
          </div>
          <p className="panel-note">
            {tr(locale, "WhatsApp and Calls should update every 15 minutes.", "WhatsApp y Llamadas deberían actualizarse cada 15 minutos.")}
          </p>
        </div>

        {data.health.length ? (
          <div className="health-card-grid">
            {data.health.map((row) => (
              <article
                className="health-component-card"
                key={row.component_key}
              >
                <div className="health-card-heading">
                  <strong>{row.component_label}</strong>
                  <span className={statusClass(row.status)}>
                    {systemStatusLabel(row.status, locale)}
                  </span>
                </div>

                <div className="health-card-meta">
                  <div>
                    <Clock3 size={15} />
                    <span>
                      {tr(locale, "Last Success", "Último Éxito")}: {" "}
                      {dateTimeLabel(row.last_success_at)}
                    </span>
                  </div>
                  <div>
                    <CircleHelp size={15} />
                    <span>
                      {tr(locale, "Age", "Antigüedad")}: {ageLabel(row.age_minutes, locale)}
                    </span>
                  </div>
                </div>

                <details>
                  <summary>{tr(locale, "Technical Details", "Detalles Técnicos")}</summary>
                  <pre>
                    {JSON.stringify(row.details, null, 2)}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message={tr(locale, "No health checks have been generated yet.", "Aún no se han generado validaciones de salud.")} />
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Validation", "Validación")}</p>
            <h2>{tr(locale, "Data Quality", "Calidad de Datos")}</h2>
          </div>
          <p className="panel-note">
            {tr(locale, "Informational checks do not invalidate KPIs.", "Las validaciones informativas no invalidan los KPIs.")}
          </p>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr(locale, "Check", "Validación")}</th>
                <th>{tr(locale, "Status", "Estado")}</th>
                <th>{tr(locale, "Records", "Registros")}</th>
                <th>{tr(locale, "Impact / Context", "Impacto / Contexto")}</th>
                <th>{tr(locale, "Checked", "Revisado")}</th>
              </tr>
            </thead>
            <tbody>
              {data.quality.map((row) => (
                <tr key={row.check_key}>
                  <td>{row.check_label}</td>
                  <td>
                    <span className={statusClass(row.status)}>
                      {systemStatusLabel(row.status, locale)}
                    </span>
                  </td>
                  <td>{number(row.issue_count)}</td>
                  <td>
                    <code className="inline-json">
                      {JSON.stringify(row.details)}
                    </code>
                  </td>
                  <td>{dateTimeLabel(row.last_checked_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="monitoring-note">
          <Info size={18} />
          <p>
            {tr(locale, "Manual messages from the shared WhatsApp channel without a user are expected. Team volume remains valid even without individual attribution.", "Es normal que existan mensajes manuales del canal compartido de WhatsApp sin usuario atribuido. El volumen de equipo sigue siendo válido aun sin atribución individual.")}
          </p>
        </section>
      </section>
    </DashboardLayout>
  );
}
