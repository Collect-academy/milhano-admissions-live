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

export const dynamic = "force-dynamic";

const statusLabels = {
  healthy: "Saludable",
  warning: "Atención",
  error: "Error",
  pending: "Pendiente",
  unknown: "Desconocido",
  pass: "Correcto",
  info: "Informativo",
};

function statusClass(status: string): string {
  if (status === "healthy" || status === "pass") {
    return "status-pill status-good";
  }

  if (status === "error") {
    return "status-pill status-bad";
  }

  return "status-pill status-pending";
}

function ageLabel(minutes: number | null): string {
  if (minutes === null) return "Sin ejecución";

  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  if (minutes < 1440) {
    return `${Math.round(minutes / 60)} h`;
  }

  return `${Math.round(minutes / 1440)} días`;
}

export default async function SystemPage() {
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
      eyebrow="Confiabilidad"
      title="System Health"
      subtitle="Freshness de sincronizaciones y controles básicos de calidad de datos."
      statusLabel={`Estado general: ${
        statusLabels[data.overallStatus]
      }`}
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
              ? "Los componentes monitoreados están dentro de sus ventanas esperadas."
              : data.overallStatus === "error"
                ? "Hay al menos un componente o control de datos en error."
                : "Hay componentes pendientes o que requieren revisión."}
          </strong>
          <span>
            Este monitor detecta datos atrasados; no sustituye la
            conciliación de GHL.
          </span>
        </div>
      </section>

      <section className="kpi-grid pipeline-kpi-grid">
        <KpiCard
          label="Componentes saludables"
          value={number(healthy)}
          helper={`${number(data.health.length)} monitoreados`}
          icon={CheckCircle2}
        />
        <KpiCard
          label="Advertencias"
          value={number(warning)}
          helper="Requieren observación"
          icon={AlertTriangle}
        />
        <KpiCard
          label="Errores"
          value={number(errors)}
          helper="Requieren acción"
          icon={XCircle}
        />
        <KpiCard
          label="Issues de datos"
          value={number(qualityIssues)}
          helper="Warnings + errors"
          icon={DatabaseZap}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Freshness</p>
            <h2>Componentes operativos</h2>
          </div>
          <p className="panel-note">
            WhatsApp y Calls deberían actualizarse cada 15 minutos.
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
                    {statusLabels[row.status]}
                  </span>
                </div>

                <div className="health-card-meta">
                  <div>
                    <Clock3 size={15} />
                    <span>
                      Último éxito:{" "}
                      {dateTimeLabel(row.last_success_at)}
                    </span>
                  </div>
                  <div>
                    <CircleHelp size={15} />
                    <span>
                      Antigüedad: {ageLabel(row.age_minutes)}
                    </span>
                  </div>
                </div>

                <details>
                  <summary>Detalles técnicos</summary>
                  <pre>
                    {JSON.stringify(row.details, null, 2)}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="Todavía no se han generado controles de salud." />
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Validación</p>
            <h2>Calidad de datos</h2>
          </div>
          <p className="panel-note">
            Los controles informativos no invalidan los KPIs.
          </p>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Control</th>
                <th>Status</th>
                <th>Registros</th>
                <th>Impacto / contexto</th>
                <th>Revisado</th>
              </tr>
            </thead>
            <tbody>
              {data.quality.map((row) => (
                <tr key={row.check_key}>
                  <td>{row.check_label}</td>
                  <td>
                    <span className={statusClass(row.status)}>
                      {statusLabels[row.status]}
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
            Los mensajes manuales del WhatsApp compartido sin
            usuario son esperados. El volumen de equipo sigue siendo
            válido aunque no exista atribución individual.
          </p>
        </section>
      </section>
    </DashboardLayout>
  );
}
