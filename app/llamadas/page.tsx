import {
  Headphones,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Timer,
  UsersRound,
} from "lucide-react";

import {
  CallActivityChart,
  PickupRateChart,
} from "@/components/call-charts";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { resolveDateRange } from "@/lib/date-range";
import { getCallsDashboardData } from "@/lib/data";
import { stageLabel } from "@/lib/terminology";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import {
  dateLabel,
  dateTimeLabel,
  duration,
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
    ReturnType<typeof getCallsDashboardData>
  >["daily"],
  key: keyof Awaited<
    ReturnType<typeof getCallsDashboardData>
  >["daily"][number],
): number {
  return rows.reduce(
    (total, row) => total + Number(row[key] ?? 0),
    0,
  );
}

const outcomeLabels: Record<string, string> = {
  fit: "Qualified / Fit",
  no_fit: "No Fit",
  school_tour: "School Tour",
  pasadia: "Trial Day",
  follow_up_or_indecision: "Follow-up / Indecision",
  lost: "Lost",
  evaluation: "Evaluation",
  enrollment: "Enrollment",
  other_stage_change: "Other Movement",
  no_stage_change_within_24h: "No Movement within 24 Hours",
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const locale = await getDashboardLocale();
  const range = resolveDateRange(params);
  const data = await getCallsDashboardData(range);
  const selected = data.daily;
  const outbound = sum(selected, "outbound_attempts");
  const meaningful = sum(
    selected,
    "meaningful_3min_plus_calls",
  );
  const meaningfulRate =
    outbound > 0 ? (meaningful / outbound) * 100 : null;

  const advisorTotals = new Map<
    string,
    {
      outbound: number;
      inbound: number;
      connected: number;
      meaningful: number;
      contacts: number;
      duration: number;
    }
  >();

  for (const row of data.byUser) {
    const current = advisorTotals.get(row.advisor_name) ?? {
      outbound: 0,
      inbound: 0,
      connected: 0,
      meaningful: 0,
      contacts: 0,
      duration: 0,
    };

    current.outbound += row.outbound_attempts;
    current.inbound += row.inbound_calls;
    current.connected += row.ghl_connected_calls;
    current.meaningful +=
      row.meaningful_3min_plus_calls;
    current.contacts += row.unique_contacts;
    current.duration += row.total_duration_seconds;
    advisorTotals.set(row.advisor_name, current);
  }

  const outcomeTotals = new Map<string, number>();
  for (const row of data.outcomes) {
    outcomeTotals.set(
      row.observed_outcome_24h,
      (outcomeTotals.get(row.observed_outcome_24h) ?? 0) +
        1,
    );
  }

  return (
    <DashboardLayout
      eyebrow={tr(locale, "Call Activity", "Actividad de Llamadas")}
      title={tr(locale, "Call Operations", "Operación de Llamadas")}
      subtitle={tr(locale, "Dials, inbound calls, pickup and observed movements after the call.", "Llamadas, llamadas entrantes, respuesta y movimientos observados después de la llamada.")}
      statusLabel={`${tr(locale, "Period", "Periodo")} ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <DateRangeFilter
        basePath="/llamadas"
        range={range}
        locale={locale}
      />

      <section className="scope-banner">
        <PhoneCall size={19} />
        <div>
          <strong>
            {tr(locale, "Coverage: calls registered in GHL", "Cobertura: llamadas registradas en GHL")}
          </strong>
          <span>
            {tr(locale, "Calls made from other lines are not included.", "Las llamadas realizadas desde otras líneas no están incluidas.")}
          </span>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label={`${tr(locale, "Number of Dials", "Llamadas GHL")} · ${range.label}`}
          value={number(outbound)}
          helper={tr(locale, "Answered or unanswered", "Contestadas o no contestadas")}
          icon={PhoneOutgoing}
          definitionKey="number_of_dials"
          locale={locale}
        />
        <KpiCard
          label={tr(locale, "Inbound", "Entrantes")}
          value={number(sum(selected, "inbound_calls"))}
          helper={`${number(sum(selected, "probable_return_calls"))} ${tr(locale, "probable return calls", "probables devoluciones de llamada")}`}
          icon={PhoneIncoming}
          definitionKey="inbound_calls"
          locale={locale}
        />
        <KpiCard
          label={tr(locale, "Connected Calls (GHL)", "Llamadas Contestadas (GHL)")}
          value={number(
            sum(selected, "ghl_connected_calls"),
          )}
          helper={tr(locale, "Raw platform classification", "Clasificación cruda de la plataforma")}
          icon={Headphones}
          definitionKey="connected_calls"
          locale={locale}
        />
        <KpiCard
          label={tr(locale, "Meaningful Conversations", "Conversaciones Significativas")}
          value={number(meaningful)}
          helper={`${percent(
            meaningfulRate,
          )} of outbound dials`}
          icon={Timer}
          definitionKey="meaningful_conversations"
          locale={locale}
        />
        <KpiCard
          label={tr(locale, "Unique Contacted Leads", "Leads Únicos Contactados")}
          value={number(
            sum(selected, "unique_contacts_called"),
          )}
          helper={tr(locale, "Daily sum; leads may repeat across days", "Suma diaria; un lead puede repetirse entre días")}
          icon={UsersRound}
          definitionKey="unique_contacted_leads"
          locale={locale}
        />
        <KpiCard
          label={tr(locale, "Recorded Call Time", "Tiempo de Llamada Registrado")}
          value={duration(
            sum(selected, "total_duration_seconds"),
          )}
          helper={tr(locale, "Duration reported by GHL", "Duración reportada por GHL")}
          icon={PhoneCall}
          definitionKey="recorded_call_time"
          locale={locale}
        />
      </section>

      {selected.length ? (
        <div className="two-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{range.label}</p>
                <h2>{tr(locale, "Dials and Conversations", "Llamadas y Conversaciones")}</h2>
              </div>
            </div>
            <CallActivityChart data={selected} locale={locale} />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{range.label}</p>
                <h2>{tr(locale, "Two Pickup Readings", "Dos Lecturas de Respuesta")}</h2>
              </div>
              <p className="panel-note">
                {tr(locale, "GHL connected is preserved; 3+ minutes is the operational proxy.", "Se conserva la clasificación connected de GHL; 3+ minutos es solo una referencia operativa.")}
              </p>
            </div>
            <PickupRateChart data={selected} locale={locale} />
          </section>
        </div>
      ) : (
        <EmptyState message={tr(locale, "No GHL calls exist in the selected period.", "No hay llamadas GHL en el periodo seleccionado.")} />
      )}

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                Team · {range.label}
              </p>
              <h2>{tr(locale, "Activity by Advisor", "Actividad por Asesora")}</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr(locale, "Advisor", "Asesora")}</th>
                  <th>{tr(locale, "Outbound", "Salientes")}</th>
                  <th>{tr(locale, "Inbound", "Entrantes")}</th>
                  <th>{tr(locale, "Connected", "Contestadas")}</th>
                  <th>3+ min</th>
                  <th>{tr(locale, "Time", "Tiempo")}</th>
                </tr>
              </thead>
              <tbody>
                {[...advisorTotals.entries()].map(
                  ([advisor, values]) => (
                    <tr key={advisor}>
                      <td>{advisor}</td>
                      <td>{number(values.outbound)}</td>
                      <td>{number(values.inbound)}</td>
                      <td>{number(values.connected)}</td>
                      <td>{number(values.meaningful)}</td>
                      <td>{duration(values.duration)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                Process · {range.label}
              </p>
              <h2>{tr(locale, "First Movement within 24 Hours", "Primer Movimiento dentro de 24 Horas")}</h2>
            </div>
            <p className="panel-note">
              {tr(locale, "Temporal relationship; it does not claim causality.", "Relación temporal; no implica causalidad.")}
            </p>
          </div>
          <div className="outcome-list">
            {[...outcomeTotals.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([outcome, count]) => (
                <div className="outcome-row" key={outcome}>
                  <span>
                    {outcomeLabels[outcome] ?? outcome}
                  </span>
                  <strong>{number(count)}</strong>
                </div>
              ))}
            {!outcomeTotals.size ? (
              <EmptyState message={tr(locale, "No observed outcomes exist in the selected period.", "No hay resultados observados en el periodo seleccionado.")} />
            ) : null}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{range.label}</p>
            <h2>{tr(locale, "Calls and Subsequent Movement", "Llamadas y Movimiento Posterior")}</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr(locale, "Date", "Fecha")}</th>
                <th>{tr(locale, "Direction", "Dirección")}</th>
                <th>{tr(locale, "Status", "Estado")}</th>
                <th>{tr(locale, "Duration", "Duración")}</th>
                <th>3+ min</th>
                <th>{tr(locale, "Observed Outcome", "Resultado Observado")}</th>
                <th>{tr(locale, "Subsequent Stage", "Stage Posterior")}</th>
              </tr>
            </thead>
            <tbody>
              {data.outcomes.map((row) => (
                <tr key={row.event_id}>
                  <td>{dateTimeLabel(row.call_timestamp)}</td>
                  <td>{row.direction}</td>
                  <td>{row.call_status ?? "—"}</td>
                  <td>
                    {duration(row.call_duration_seconds)}
                  </td>
                  <td>
                    {row.is_meaningful_conversation
                      ? tr(locale, "Yes", "Sí")
                      : tr(locale, "No", "No")}
                  </td>
                  <td>
                    {outcomeLabels[
                      row.observed_outcome_24h
                    ] ?? row.observed_outcome_24h}
                  </td>
                  <td>{stageLabel(row.to_stage, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
