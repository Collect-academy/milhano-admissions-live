import {
  Bot,
  ContactRound,
  Inbox,
  MessageCircleMore,
  MessagesSquare,
  Send,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import {
  WhatsAppActivityChart,
  WhatsAppClassificationChart,
} from "@/components/whatsapp-charts";
import { resolveDateRange } from "@/lib/date-range";
import { getWhatsAppDashboardData } from "@/lib/data";
import {
  dateLabel,
  decimal,
  number,
  percent,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

function sum(
  rows: Awaited<
    ReturnType<typeof getWhatsAppDashboardData>
  >["daily"],
  key: keyof Awaited<
    ReturnType<typeof getWhatsAppDashboardData>
  >["daily"][number],
): number {
  return rows.reduce(
    (total, row) => total + Number(row[key] ?? 0),
    0,
  );
}

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const data = await getWhatsAppDashboardData(range);
  const selected = data.daily;
  const latest = selected.at(-1) ?? null;
  const selectedTotal = sum(selected, "total_messages");
  const selectedGeneral = sum(
    selected,
    "general_or_unclassified_messages",
  );
  const selectedAdmissions = sum(
    selected,
    "admissions_related_messages",
  );
  const generalShare =
    selectedTotal > 0
      ? (selectedGeneral / selectedTotal) * 100
      : null;
  const backfill = data.backfill;
  const backfillRunning = backfill?.status === "running";
  const backfillCompleted =
    backfill?.status === "completed";

  return (
    <DashboardLayout
      eyebrow="Canal institucional"
      title="WhatsApp Operations"
      subtitle="Volumen del número institucional: atención general, admisiones y automatizaciones."
      statusLabel={`Periodo ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <DateRangeFilter
        basePath="/whatsapp"
        range={range}
      />

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
                  ? `${percent(
                      backfill.progress_pct,
                    )} cargado`
                  : backfill.status}
            </strong>
            <span>
              {number(backfill.records_seen)} de{" "}
              {number(backfill.total_reported)} mensajes ·{" "}
              {number(backfill.pages_processed)} páginas
            </span>
          </div>
        </section>
      ) : null}

      <section className="kpi-grid">
        <KpiCard
          label={`Mensajes · ${range.label}`}
          value={number(selectedTotal)}
          helper="Inbound + outbound"
          icon={MessageCircleMore}
        />
        <KpiCard
          label="Entrantes"
          value={number(sum(selected, "inbound_messages"))}
          helper="Demanda recibida"
          icon={Inbox}
        />
        <KpiCard
          label="Salientes manuales"
          value={number(
            sum(selected, "manual_outbound_messages"),
          )}
          helper="Canal compartido"
          icon={Send}
        />
        <KpiCard
          label="Automáticos"
          value={number(
            sum(selected, "automated_outbound_messages"),
          )}
          helper="Enviados por workflows"
          icon={Bot}
        />
        <KpiCard
          label="Conversaciones"
          value={number(
            sum(selected, "active_conversations"),
          )}
          helper="Suma diaria; puede repetir entre días"
          icon={MessagesSquare}
        />
        <KpiCard
          label="Contactos"
          value={number(sum(selected, "unique_contacts"))}
          helper="Suma diaria; puede repetir entre días"
          icon={ContactRound}
        />
      </section>

      <section className="decision-banner">
        <div>
          <p className="eyebrow">
            Señal operativa · {range.label}
          </p>
          <h2>
            El número institucional absorbe atención más allá
            de admisiones
          </h2>
          <p>
            {percent(generalShare)} de los mensajes del periodo
            están clasificados como atención general o sin
            opportunity.
          </p>
        </div>
        <div className="decision-stats">
          <div>
            <strong>{number(selectedAdmissions)}</strong>
            <span>Con opportunity</span>
          </div>
          <div>
            <strong>{number(selectedGeneral)}</strong>
            <span>General / sin clasificar</span>
          </div>
        </div>
      </section>

      {selected.length ? (
        <div className="two-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{range.label}</p>
                <h2>Mensajes y conversaciones</h2>
              </div>
              <p className="panel-note">
                Manual refleja trabajo humano del canal, no
                una asesora específica.
              </p>
            </div>
            <WhatsAppActivityChart data={selected} />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{range.label}</p>
                <h2>Admisiones vs atención general</h2>
              </div>
              <p className="panel-note">
                “Con opportunity” es relación operativa, no
                clasificación semántica.
              </p>
            </div>
            <WhatsAppClassificationChart data={selected} />
          </section>
        </div>
      ) : (
        <EmptyState message="No hay actividad de WhatsApp en el periodo seleccionado." />
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Detalle diario</p>
            <h2>{range.label}</h2>
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
                <th>Atendidas</th>
                <th>Msg / conversación</th>
              </tr>
            </thead>
            <tbody>
              {[...selected].reverse().map((row) => (
                <tr key={row.activity_date}>
                  <td>{dateLabel(row.activity_date)}</td>
                  <td>{number(row.total_messages)}</td>
                  <td>{number(row.inbound_messages)}</td>
                  <td>
                    {number(row.manual_outbound_messages)}
                  </td>
                  <td>
                    {number(row.automated_outbound_messages)}
                  </td>
                  <td>{number(row.active_conversations)}</td>
                  <td>
                    {number(
                      row.manually_attended_conversations,
                    )}
                  </td>
                  <td>
                    {decimal(
                      row.messages_per_active_conversation,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel compact-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Cobertura total cargada</p>
            <h2>Acumulado disponible en Supabase</h2>
          </div>
        </div>
        <div className="summary-row">
          <div>
            <strong>
              {number(data.summary?.total_messages)}
            </strong>
            <span>mensajes</span>
          </div>
          <div>
            <strong>
              {number(data.summary?.active_conversations)}
            </strong>
            <span>conversaciones</span>
          </div>
          <div>
            <strong>
              {number(data.summary?.unique_contacts)}
            </strong>
            <span>contactos</span>
          </div>
          <div>
            <strong>
              {dateLabel(data.summary?.first_message_at)}
            </strong>
            <span>primer registro</span>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
