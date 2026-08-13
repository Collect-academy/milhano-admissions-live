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
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";

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
  const locale = await getDashboardLocale();
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
      eyebrow={tr(locale, "Institutional Channel", "Canal Institucional")}
      title={tr(locale, "WhatsApp Operations", "Operación de WhatsApp")}
      subtitle={tr(locale, "Institutional number volume: general service, admissions and automations.", "Volumen del número institucional: servicio general, admisiones y automatizaciones.")}
      statusLabel={`${tr(locale, "Period", "Periodo")} ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <DateRangeFilter
        basePath="/whatsapp"
        range={range}
        locale={locale}
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
              WhatsApp History:{" "}
              {backfillCompleted
                ? "completed"
                : backfillRunning
                  ? `${percent(
                      backfill.progress_pct,
                    )} loaded`
                  : backfill.status}
            </strong>
            <span>
              {number(backfill.records_seen)} de{" "}
              {number(backfill.total_reported)} messages ·{" "}
              {number(backfill.pages_processed)} pages
            </span>
          </div>
        </section>
      ) : null}

      <section className="kpi-grid">
        <KpiCard
          label={`${tr(locale, "Messages", "Mensajes")} · ${range.label}`}
          value={number(selectedTotal)}
          helper={tr(locale, "Inbound + outbound", "Entrantes + salientes")}
          icon={MessageCircleMore}
          definitionKey="whatsapp_messages"
          locale={locale}
        />
        <KpiCard
          label={tr(locale, "Inbound", "Entrantes")}
          value={number(sum(selected, "inbound_messages"))}
          helper={tr(locale, "Received demand", "Demanda recibida")}
          icon={Inbox}
          definitionKey="whatsapp_inbound"
          locale={locale}
        />
        <KpiCard
          label={tr(locale, "Manual Outbound", "Salientes Manuales")}
          value={number(
            sum(selected, "manual_outbound_messages"),
          )}
          helper={tr(locale, "Shared channel", "Canal compartido")}
          icon={Send}
          definitionKey="whatsapp_manual_outbound"
          locale={locale}
        />
        <KpiCard
          label={tr(locale, "Automated", "Automatizados")}
          value={number(
            sum(selected, "automated_outbound_messages"),
          )}
          helper={tr(locale, "Sent by workflows", "Enviados por workflows")}
          icon={Bot}
          definitionKey="whatsapp_automated"
          locale={locale}
        />
        <KpiCard
          label={tr(locale, "Conversations", "Conversaciones")}
          value={number(
            sum(selected, "active_conversations"),
          )}
          helper={tr(locale, "Daily sum; contacts may repeat across days", "Suma diaria; los contactos pueden repetirse entre días")}
          icon={MessagesSquare}
          definitionKey="whatsapp_conversations"
          locale={locale}
        />
        <KpiCard
          label={tr(locale, "Contacts", "Contactos")}
          value={number(sum(selected, "unique_contacts"))}
          helper={tr(locale, "Daily sum; contacts may repeat across days", "Suma diaria; los contactos pueden repetirse entre días")}
          icon={ContactRound}
          definitionKey="whatsapp_contacts"
          locale={locale}
        />
      </section>

      <section className="decision-banner">
        <div>
          <p className="eyebrow">
            {tr(locale, "Operational Signal", "Señal Operativa")} · {range.label}
          </p>
          <h2>
            {tr(locale, "The institutional number handles service beyond admissions", "El número institucional atiende servicio más allá de admisiones")}
          </h2>
          <p>
            {percent(generalShare)} {tr(locale, "of period messages are classified as general service or have no opportunity.", "de los mensajes del periodo se clasifican como servicio general o no tienen opportunity.")}
          </p>
        </div>
        <div className="decision-stats">
          <div>
            <strong>{number(selectedAdmissions)}</strong>
            <span>{tr(locale, "With Opportunity", "Con Opportunity")}</span>
          </div>
          <div>
            <strong>{number(selectedGeneral)}</strong>
            <span>{tr(locale, "General / Unclassified", "General / Sin clasificar")}</span>
          </div>
        </div>
      </section>

      {selected.length ? (
        <div className="two-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{range.label}</p>
                <h2>{tr(locale, "Messages and Conversations", "Mensajes y Conversaciones")}</h2>
              </div>
              <p className="panel-note">
                {tr(locale, "Manual activity reflects human work on the channel, not a specific advisor.", "La actividad manual refleja trabajo humano en el canal, no necesariamente de una asesora específica.")}
              </p>
            </div>
            <WhatsAppActivityChart data={selected} locale={locale} />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{range.label}</p>
                <h2>{tr(locale, "Admissions vs General Service", "Admisiones vs Servicio General")}</h2>
              </div>
              <p className="panel-note">
                {tr(locale, "“With Opportunity” is an operational relationship, not a semantic classification.", "“Con Opportunity” es una relación operativa, no una clasificación semántica.")}
              </p>
            </div>
            <WhatsAppClassificationChart data={selected} locale={locale} />
          </section>
        </div>
      ) : (
        <EmptyState message={tr(locale, "No WhatsApp activity exists in the selected period.", "No hay actividad de WhatsApp en el periodo seleccionado.")} />
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Daily Detail", "Detalle Diario")}</p>
            <h2>{range.label}</h2>
          </div>
          <p className="panel-note">
            {tr(locale, "Each Message ID is counted once.", "Cada Message ID se cuenta una sola vez.")}
          </p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr(locale, "Date", "Fecha")}</th>
                <th>Total</th>
                <th>{tr(locale, "Inbound", "Entrantes")}</th>
                <th>{tr(locale, "Manual Outbound", "Salientes Manuales")}</th>
                <th>{tr(locale, "Automated", "Automatizados")}</th>
                <th>{tr(locale, "Conversations", "Conversaciones")}</th>
                <th>{tr(locale, "Handled", "Atendidas")}</th>
                <th>{tr(locale, "Messages / Conversation", "Mensajes / Conversación")}</th>
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
            <p className="eyebrow">{tr(locale, "Loaded Historical Coverage", "Cobertura Histórica Cargada")}</p>
            <h2>{tr(locale, "Available Total in Supabase", "Total Disponible en Supabase")}</h2>
          </div>
        </div>
        <div className="summary-row">
          <div>
            <strong>
              {number(data.summary?.total_messages)}
            </strong>
            <span>{tr(locale, "messages", "mensajes")}</span>
          </div>
          <div>
            <strong>
              {number(data.summary?.active_conversations)}
            </strong>
            <span>{tr(locale, "conversations", "conversaciones")}</span>
          </div>
          <div>
            <strong>
              {number(data.summary?.unique_contacts)}
            </strong>
            <span>{tr(locale, "contacts", "contactos")}</span>
          </div>
          <div>
            <strong>
              {dateLabel(data.summary?.first_message_at)}
            </strong>
            <span>{tr(locale, "first record", "primer registro")}</span>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
