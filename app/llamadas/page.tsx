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
  fit: "Fit",
  no_fit: "No fit",
  school_tour: "School Tour",
  pasadia: "Pasadía",
  follow_up_or_indecision: "Seguimiento / indecisión",
  lost: "Lost",
  evaluation: "Evaluación",
  enrollment: "Inscripción",
  other_stage_change: "Otro movimiento",
  no_stage_change_within_24h: "Sin movimiento en 24 h",
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
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
      eyebrow="Actividad telefónica"
      title="Call Operations"
      subtitle="Intentos, inbound, pickup y movimientos observados después de la llamada."
      statusLabel={`Periodo ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <DateRangeFilter
        basePath="/llamadas"
        range={range}
      />

      <section className="scope-banner">
        <PhoneCall size={19} />
        <div>
          <strong>
            Cobertura: llamadas registradas dentro de GHL
          </strong>
          <span>
            Las realizadas desde otras líneas no aparecen.
          </span>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label={`Intentos outbound · ${range.label}`}
          value={number(outbound)}
          helper="Contestados o no"
          icon={PhoneOutgoing}
        />
        <KpiCard
          label="Inbound"
          value={number(sum(selected, "inbound_calls"))}
          helper={`${number(
            sum(selected, "probable_return_calls"),
          )} probables devoluciones`}
          icon={PhoneIncoming}
        />
        <KpiCard
          label="Connected según GHL"
          value={number(
            sum(selected, "ghl_connected_calls"),
          )}
          helper="Estado raw de la plataforma"
          icon={Headphones}
        />
        <KpiCard
          label="Conversaciones 3+ min"
          value={number(meaningful)}
          helper={`${percent(
            meaningfulRate,
          )} de intentos outbound`}
          icon={Timer}
        />
        <KpiCard
          label="Contactos"
          value={number(
            sum(selected, "unique_contacts_called"),
          )}
          helper="Suma diaria; puede repetir"
          icon={UsersRound}
        />
        <KpiCard
          label="Tiempo registrado"
          value={duration(
            sum(selected, "total_duration_seconds"),
          )}
          helper="Duración reportada por GHL"
          icon={PhoneCall}
        />
      </section>

      {selected.length ? (
        <div className="two-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{range.label}</p>
                <h2>Intentos y conversaciones</h2>
              </div>
            </div>
            <CallActivityChart data={selected} />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{range.label}</p>
                <h2>Dos lecturas de pickup</h2>
              </div>
              <p className="panel-note">
                GHL connected se conserva; 3+ minutos es el
                proxy operativo.
              </p>
            </div>
            <PickupRateChart data={selected} />
          </section>
        </div>
      ) : (
        <EmptyState message="No hay llamadas registradas en el periodo seleccionado." />
      )}

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                Equipo · {range.label}
              </p>
              <h2>Actividad atribuida por asesora</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Asesora</th>
                  <th>Outbound</th>
                  <th>Inbound</th>
                  <th>Connected</th>
                  <th>3+ min</th>
                  <th>Tiempo</th>
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
                Proceso · {range.label}
              </p>
              <h2>Primer movimiento hasta 24 h después</h2>
            </div>
            <p className="panel-note">
              Correlación temporal; no afirma causalidad.
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
              <EmptyState message="No hay outcomes observados en el periodo." />
            ) : null}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{range.label}</p>
            <h2>Llamadas y movimiento posterior</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Dirección</th>
                <th>Status</th>
                <th>Duración</th>
                <th>3+ min</th>
                <th>Outcome observado</th>
                <th>Stage posterior</th>
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
                      ? "Sí"
                      : "No"}
                  </td>
                  <td>
                    {outcomeLabels[
                      row.observed_outcome_24h
                    ] ?? row.observed_outcome_24h}
                  </td>
                  <td>{row.to_stage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
