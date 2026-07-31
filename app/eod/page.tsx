import {
  CalendarCheck2,
  CheckCircle2,
  Clock4,
  MessageCircleMore,
  PhoneCall,
  UsersRound,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { getEodData } from "@/lib/data";
import { dateLabel, dateTimeLabel, number } from "@/lib/format";

export const dynamic = "force-dynamic";

const teamMetricLabels: Record<string, string> = {
  whatsapp_total_messages: "WhatsApp totales",
  whatsapp_inbound_messages: "WhatsApp entrantes",
  whatsapp_outbound_messages: "WhatsApp salientes",
  whatsapp_manual_outbound_messages: "WhatsApp manuales",
  whatsapp_automated_outbound_messages: "WhatsApp automáticos",
  whatsapp_active_conversations: "Conversaciones activas",
  whatsapp_manually_attended_conversations: "Conversaciones atendidas",
  whatsapp_unique_contacts: "Contactos únicos",
  whatsapp_admissions_related_messages: "Mensajes con opportunity",
  whatsapp_general_or_unclassified_messages: "General / sin clasificar",
  team_outbound_call_attempts: "Intentos outbound",
  team_inbound_calls: "Llamadas inbound",
  team_meaningful_calls_3min: "Llamadas 3+ minutos",
};

const statusLabels: Record<string, string> = {
  system: "Sistema",
  pending: "Pendiente",
  matched: "Coincide",
  awaiting_confirmation: "Falta confirmar",
  mismatch: "Diferencia",
};

function statusClass(status: string): string {
  if (status === "matched" || status === "system") return "status-good";
  if (status === "mismatch") return "status-bad";
  return "status-pending";
}

export default async function EodPage() {
  const data = await getEodData();
  const latestSnapshot = data.snapshots[0] ?? null;
  const latestDate =
    latestSnapshot?.eod_date ?? data.rows[0]?.eod_date ?? null;
  const latestRows = latestDate
    ? data.rows.filter((row) => row.eod_date === latestDate)
    : [];

  const advisorGroups = new Map<
    string,
    {
      status: string;
      rows: typeof latestRows;
    }
  >();

  for (const row of latestRows) {
    const current = advisorGroups.get(row.display_name) ?? {
      status: row.submission_status,
      rows: [],
    };
    current.rows.push(row);
    advisorGroups.set(row.display_name, current);
  }

  const metrics = latestSnapshot?.metrics ?? {};
  const latestSync = data.syncRuns.find(
    (run) => run.sync_type === "eod_snapshot",
  );

  return (
    <DashboardLayout
      eyebrow="Cierre operativo"
      title="End of Day"
      subtitle="Snapshot individual por asesora y volumen compartido del canal institucional."
      statusLabel={`Cierre ${dateLabel(latestDate)}`}
    >
      <section className="scope-banner">
        <Clock4 size={19} />
        <div>
          <strong>Ventana: corte diario a las 14:50 de Mérida</strong>
          <span>
            El lunes incluye actividad desde el viernes anterior. El snapshot automático corre a las 14:52.
          </span>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Asesoras en snapshot"
          value={number(advisorGroups.size)}
          helper="Pathi y Cinthia activas"
          icon={UsersRound}
        />
        <KpiCard
          label="WhatsApp totales"
          value={number(metrics.whatsapp_total_messages)}
          helper="Métrica compartida del canal"
          icon={MessageCircleMore}
        />
        <KpiCard
          label="Conversaciones atendidas"
          value={number(metrics.whatsapp_manually_attended_conversations)}
          helper="Con al menos una salida manual"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Intentos de llamada"
          value={number(metrics.team_outbound_call_attempts)}
          helper="Registrados dentro de GHL"
          icon={PhoneCall}
        />
        <KpiCard
          label="Cierre generado"
          value={latestSnapshot ? "Sí" : "No"}
          helper={dateTimeLabel(latestSnapshot?.generated_at)}
          icon={CalendarCheck2}
        />
        <KpiCard
          label="Última sincronización"
          value={latestSync?.status === "success" ? "OK" : latestSync?.status ?? "—"}
          helper={dateTimeLabel(latestSync?.finished_at ?? latestSync?.started_at)}
          icon={CheckCircle2}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Equipo / canal</p>
            <h2>Métricas compartidas del cierre</h2>
          </div>
          <p className="panel-note">
            WhatsApp no se reparte artificialmente entre asesoras cuando GHL no entrega userId.
          </p>
        </div>

        {latestSnapshot ? (
          <div className="metric-tile-grid">
            {Object.entries(metrics).map(([key, value]) => (
              <article className="metric-tile" key={key}>
                <span>{teamMetricLabels[key] ?? key}</span>
                <strong>{number(value)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="Todavía no existe un snapshot de equipo." />
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Asesoras</p>
            <h2>Snapshot individual</h2>
          </div>
          <p className="panel-note">
            Lectura actual. La captura y confirmación individual se habilitará con Supabase Auth.
          </p>
        </div>

        {advisorGroups.size ? (
          <div className="advisor-grid">
            {[...advisorGroups.entries()].map(([advisor, group]) => (
              <article className="advisor-card" key={advisor}>
                <div className="advisor-heading">
                  <div>
                    <p className="eyebrow">Asesora</p>
                    <h3>{advisor}</h3>
                  </div>
                  <span className="status-pill status-pending">
                    {group.status}
                  </span>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Métrica</th>
                        <th>Sistema</th>
                        <th>Declarado</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={`${row.submission_id}-${row.metric_key}`}>
                          <td>{row.label}</td>
                          <td>{number(row.system_value)}</td>
                          <td>
                            {row.declared_value === null
                              ? "—"
                              : number(row.declared_value)}
                          </td>
                          <td>
                            <span
                              className={`status-pill ${statusClass(
                                row.reconciliation_status,
                              )}`}
                            >
                              {statusLabels[row.reconciliation_status] ??
                                row.reconciliation_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="Todavía no hay snapshots individuales para esta fecha." />
        )}
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Histórico</p>
              <h2>Últimos cierres de equipo</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>WhatsApp</th>
                  <th>Manual outbound</th>
                  <th>Conversaciones</th>
                  <th>Llamadas</th>
                </tr>
              </thead>
              <tbody>
                {data.snapshots.slice(0, 14).map((snapshot) => (
                  <tr key={snapshot.eod_date}>
                    <td>{dateLabel(snapshot.eod_date)}</td>
                    <td>{number(snapshot.metrics.whatsapp_total_messages)}</td>
                    <td>
                      {number(
                        snapshot.metrics.whatsapp_manual_outbound_messages,
                      )}
                    </td>
                    <td>
                      {number(
                        snapshot.metrics
                          .whatsapp_manually_attended_conversations,
                      )}
                    </td>
                    <td>
                      {number(snapshot.metrics.team_outbound_call_attempts)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Salud del sistema</p>
              <h2>Últimas sincronizaciones</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Proceso</th>
                  <th>Status</th>
                  <th>Leídos</th>
                  <th>Fallidos</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.syncRuns.slice(0, 12).map((run) => (
                  <tr key={run.id}>
                    <td>{run.sync_type}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          run.status === "success"
                            ? "status-good"
                            : run.status === "failed"
                              ? "status-bad"
                              : "status-pending"
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td>{number(run.records_read)}</td>
                    <td>{number(run.records_failed)}</td>
                    <td>{dateTimeLabel(run.finished_at ?? run.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
