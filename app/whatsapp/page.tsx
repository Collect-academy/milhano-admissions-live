import {
  Bot,
  ContactRound,
  Inbox,
  MessageCircleMore,
  MessagesSquare,
  Send,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import {
  WhatsAppActivityChart,
  WhatsAppClassificationChart,
} from "@/components/whatsapp-charts";
import { getWhatsAppDashboardData } from "@/lib/data";
import { dateLabel, decimal, number, percent } from "@/lib/format";

export const dynamic = "force-dynamic";

function sum(
  rows: Awaited<ReturnType<typeof getWhatsAppDashboardData>>["daily"],
  key: keyof Awaited<ReturnType<typeof getWhatsAppDashboardData>>["daily"][number],
): number {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

export default async function WhatsAppPage() {
  const data = await getWhatsAppDashboardData();
  const recent = data.daily.slice(-30);
  const latest = data.daily.at(-1) ?? null;
  const recentTotal = sum(recent, "total_messages");
  const recentGeneral = sum(recent, "general_or_unclassified_messages");
  const recentAdmissions = sum(recent, "admissions_related_messages");
  const generalShare = recentTotal > 0 ? (recentGeneral / recentTotal) * 100 : null;
  const backfill = data.backfill;
  const backfillRunning = backfill?.status === "running";
  const backfillCompleted = backfill?.status === "completed";

  return (
    <DashboardLayout
      eyebrow="Canal institucional"
      title="WhatsApp Operations"
      subtitle="Volumen completo del número institucional: atención general, admisiones y automatizaciones."
      statusLabel={`Última actividad ${dateLabel(latest?.activity_date)}`}
    >
      {backfill ? (
        <section
          className={
            backfillCompleted
              ? "scope-banner scope-banner-success"
              : "scope-banner"
          }
        >
          <MessageCircleMore size={19} />
          <div>
            <strong>
              Historial de WhatsApp:{" "}
              {backfillCompleted
                ? "completado"
                : backfillRunning
                  ? `${percent(backfill.progress_pct)} cargado`
                  : backfill.status}
            </strong>
            <span>
              {number(backfill.records_seen)} de{" "}
              {number(backfill.total_reported)} mensajes recorridos ·{" "}
              {number(backfill.pages_processed)} páginas
            </span>
          </div>
        </section>
      ) : null}

      <section className="kpi-grid">
        <KpiCard
          label="Mensajes · 30 días"
          value={number(recentTotal)}
          helper="Inbound + outbound"
          icon={MessageCircleMore}
        />
        <KpiCard
          label="Entrantes"
          value={number(sum(recent, "inbound_messages"))}
          helper="Demanda recibida"
          icon={Inbox}
        />
        <KpiCard
          label="Salientes manuales"
          value={number(sum(recent, "manual_outbound_messages"))}
          helper="Canal compartido, sin atribución individual"
          icon={Send}
        />
        <KpiCard
          label="Automáticos"
          value={number(sum(recent, "automated_outbound_messages"))}
          helper="Mensajes enviados por workflows"
          icon={Bot}
        />
        <KpiCard
          label="Conversaciones"
          value={number(sum(recent, "active_conversations"))}
          helper="Suma diaria de conversaciones activas"
          icon={MessagesSquare}
        />
        <KpiCard
          label="Contactos únicos"
          value={number(latest?.unique_contacts)}
          helper="Último día con actividad"
          icon={ContactRound}
        />
      </section>

      <section className="decision-banner">
        <div>
          <p className="eyebrow">Señal operativa</p>
          <h2>El número institucional absorbe atención más allá de admisiones</h2>
          <p>
            En los últimos 30 días capturados, {percent(generalShare)} de los
            mensajes están clasificados como atención general o sin opportunity.
            Esta métrica ayuda a justificar un número exclusivo para informes.
          </p>
        </div>
        <div className="decision-stats">
          <div>
            <strong>{number(recentAdmissions)}</strong>
            <span>Con opportunity</span>
          </div>
          <div>
            <strong>{number(recentGeneral)}</strong>
            <span>General / sin clasificar</span>
          </div>
        </div>
      </section>

      {data.daily.length ? (
        <div className="two-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Últimos 30 días</p>
                <h2>Mensajes y conversaciones</h2>
              </div>
              <p className="panel-note">
                Los mensajes manuales reflejan trabajo humano del canal, no de una asesora específica.
              </p>
            </div>
            <WhatsAppActivityChart data={data.daily} />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Clasificación preliminar</p>
                <h2>Admisiones vs atención general</h2>
              </div>
              <p className="panel-note">
                “Con opportunity” es una relación operativa, no una clasificación semántica del mensaje.
              </p>
            </div>
            <WhatsAppClassificationChart data={data.daily} />
          </section>
        </div>
      ) : (
        <EmptyState message="Todavía no hay actividad de WhatsApp capturada." />
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Detalle diario</p>
            <h2>Últimos 14 días con actividad</h2>
          </div>
          <p className="panel-note">
            Cada Message ID se contabiliza una sola vez.
          </p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Total</th>
                <th>Inbound</th>
                <th>Manual outbound</th>
                <th>Automático</th>
                <th>Conversaciones</th>
                <th>Atendidas manualmente</th>
                <th>Msg / conversación</th>
              </tr>
            </thead>
            <tbody>
              {data.daily
                .slice(-14)
                .reverse()
                .map((row) => (
                  <tr key={row.activity_date}>
                    <td>{dateLabel(row.activity_date)}</td>
                    <td>{number(row.total_messages)}</td>
                    <td>{number(row.inbound_messages)}</td>
                    <td>{number(row.manual_outbound_messages)}</td>
                    <td>{number(row.automated_outbound_messages)}</td>
                    <td>{number(row.active_conversations)}</td>
                    <td>{number(row.manually_attended_conversations)}</td>
                    <td>{decimal(row.messages_per_active_conversation)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel compact-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Cobertura capturada</p>
            <h2>Acumulado disponible en Supabase</h2>
          </div>
        </div>
        <div className="summary-row">
          <div><strong>{number(data.summary?.total_messages)}</strong><span>mensajes</span></div>
          <div><strong>{number(data.summary?.active_conversations)}</strong><span>conversaciones</span></div>
          <div><strong>{number(data.summary?.unique_contacts)}</strong><span>contactos</span></div>
          <div><strong>{dateLabel(data.summary?.first_message_at)}</strong><span>primer registro</span></div>
        </div>
      </section>
    </DashboardLayout>
  );
}
