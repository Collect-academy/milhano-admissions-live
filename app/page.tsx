import Link from "next/link";

import {
  Clock3,
  GraduationCap,
  MessageCircleMore,
  PhoneCall,
  Route,
  Users,
} from "lucide-react";

import { DashboardCharts } from "@/components/dashboard-charts";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { KpiCard } from "@/components/kpi-card";
import {
  dateRangeQuery,
  resolveDateRange,
} from "@/lib/date-range";
import { getDashboardData } from "@/lib/data";
import { getSystemHealthData } from "@/lib/system-health";
import { dateLabel, number, percent } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

function stageCount(
  pipeline: Awaited<
    ReturnType<typeof getDashboardData>
  >["pipeline"],
  name: string,
): number {
  return (
    pipeline.find((row) => row.stage_name === name)
      ?.opportunity_count ?? 0
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const [data, health] = await Promise.all([
    getDashboardData(range),
    getSystemHealthData(),
  ]);

  const totalOpportunities = data.pipeline.reduce(
    (sum, row) => sum + row.opportunity_count,
    0,
  );
  const active = data.pipeline.reduce(
    (sum, row) => sum + row.open_count,
    0,
  );
  const noFitAndLost =
    stageCount(data.pipeline, "No fit") +
    stageCount(data.pipeline, "Lost / Sin continuidad");
  const leadToEnrolled =
    data.funnel.find(
      (row) => row.stage_name === "Inscrito",
    )?.conversion_from_lead_pct ?? null;
  const currentFit = stageCount(data.pipeline, "Fit");
  const currentTour = stageCount(
    data.pipeline,
    "School Tour agendado",
  );
  const currentPassday = stageCount(
    data.pipeline,
    "Pasadía agendada",
  );
  const rangeQuery = dateRangeQuery(range);

  return (
    <DashboardLayout
      eyebrow="Milhano · Admisiones"
      title="Pipeline & Growth Dashboard"
      subtitle="Cohortes, actividad, pipeline actual y canales institucionales."
      statusLabel={`Periodo ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <Link
        className={
          health.overallStatus === "healthy"
            ? "system-health-link system-health-good"
            : health.overallStatus === "error"
              ? "system-health-link system-health-error"
              : "system-health-link system-health-warning"
        }
        href="/sistema"
      >
        <span>
          {health.overallStatus === "healthy"
            ? "Sistema actualizado"
            : health.overallStatus === "error"
              ? "Sistema con errores"
              : "Sistema requiere revisión"}
        </span>
        <strong>Ver monitoreo →</strong>
      </Link>

      <DateRangeFilter basePath="/" range={range} />

      <section
        className="kpi-grid"
        aria-label="Indicadores del periodo"
      >
        <KpiCard
          label="Leads del periodo"
          value={number(data.period.new_leads)}
          helper={range.label}
          icon={Users}
        />
        <KpiCard
          label="Fit del periodo"
          value={number(data.period.fits)}
          helper="Entradas registradas a Fit"
          icon={Route}
        />
        <KpiCard
          label="Tours agendados"
          value={number(data.period.tours_scheduled)}
          helper={`${number(data.period.tours_attended)} atendidos`}
          icon={Clock3}
        />
        <KpiCard
          label="Inscritos"
          value={number(data.period.enrolled)}
          helper={`${percent(leadToEnrolled)} de la cohorte`}
          icon={GraduationCap}
        />
        <KpiCard
          label="WhatsApp"
          value={number(data.period.whatsapp_messages)}
          helper={`${number(
            data.period.whatsapp_conversations_daily_sum,
          )} conversaciones/día acumuladas`}
          icon={MessageCircleMore}
        />
        <KpiCard
          label="Llamadas registradas"
          value={number(data.period.call_attempts)}
          helper={`${number(
            data.period.outbound_call_attempts,
          )} intentos outbound`}
          icon={PhoneCall}
        />
      </section>

      <section className="insight-strip">
        <div>
          <span className="insight-label">
            Cohorte seleccionada
          </span>
          <strong>{number(totalOpportunities)}</strong>
          <span>Opportunities captadas</span>
        </div>
        <div>
          <span className="insight-label">
            Activas actualmente
          </span>
          <strong>{number(active)}</strong>
          <span>De la cohorte seleccionada</span>
        </div>
        <div>
          <span className="insight-label">Etapas clave</span>
          <strong>
            {number(
              currentFit + currentTour + currentPassday,
            )}
          </strong>
          <span>Fit, tour o pasadía agendada</span>
        </div>
        <div>
          <span className="insight-label">Salidas actuales</span>
          <strong>{number(noFitAndLost)}</strong>
          <span>No fit + Lost</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              Cohorte · {range.label}
            </p>
            <h2>Stage actual de los leads captados</h2>
          </div>
          <p className="panel-note">
            El periodo selecciona la fecha de entrada del lead; las
            cards muestran dónde se encuentra actualmente.
          </p>
        </div>

        <div className="pipeline-grid">
          {data.pipeline.map((stage) => (
            <Link
              className="stage-card stage-card-link"
              href={`/pipeline?${rangeQuery}&stage=${encodeURIComponent(
                stage.stage_name,
              )}`}
              key={stage.stage_name}
            >
              <div className="stage-topline">
                <span
                  className={`stage-chip stage-${stage.stage_group.toLowerCase()}`}
                >
                  {stage.stage_group}
                </span>
                <strong>
                  {number(stage.opportunity_count)}
                </strong>
              </div>
              <h3>{stage.stage_name}</h3>
              <div className="stage-meta">
                <span>{number(stage.open_count)} abiertas</span>
                <span>
                  {number(stage.open_8_plus_days)} con 8+ días
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="two-column">
        <DashboardCharts
          daily={data.daily}
          funnel={data.funnel}
          rangeLabel={range.label}
        />
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                Cohorte · {range.label}
              </p>
              <h2>Rendimiento por fuente</h2>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fuente</th>
                  <th>Leads</th>
                  <th>Fit</th>
                  <th>Inscritos</th>
                  <th>Lead → inscrito</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((row) => (
                  <tr key={row.source ?? "sin-fuente"}>
                    <td>{row.source ?? "Sin fuente"}</td>
                    <td>{number(row.leads)}</td>
                    <td>{number(row.fits)}</td>
                    <td>{number(row.enrolled)}</td>
                    <td>
                      {percent(row.lead_to_enrolled_pct)}
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
              <p className="eyebrow">
                Cohorte · {range.label}
              </p>
              <h2>Rendimiento por asesora</h2>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Asesora</th>
                  <th>Leads</th>
                  <th>Fit</th>
                  <th>Inscritos</th>
                  <th>Lead → inscrito</th>
                </tr>
              </thead>
              <tbody>
                {data.owners.map((row) => (
                  <tr
                    key={
                      row.operational_owner ?? "sin-asignar"
                    }
                  >
                    <td>
                      {row.operational_owner ?? "Sin asignar"}
                    </td>
                    <td>{number(row.leads)}</td>
                    <td>{number(row.fits)}</td>
                    <td>{number(row.enrolled)}</td>
                    <td>
                      {percent(row.lead_to_enrolled_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{range.label}</p>
              <h2>Salidas registradas en el periodo</h2>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Salida</th>
                  <th>Último hito</th>
                  <th>Motivo</th>
                  <th>Casos</th>
                </tr>
              </thead>
              <tbody>
                {data.exits.map((row, index) => (
                  <tr
                    key={`${row.exit_type}-${row.exit_from_stage}-${row.exit_reason}-${index}`}
                  >
                    <td>{row.exit_type}</td>
                    <td>{row.exit_from_stage}</td>
                    <td>{row.exit_reason}</td>
                    <td>{number(row.opportunity_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                Cohorte · {range.label}
              </p>
              <h2>Mayor inactividad actual</h2>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th>Stage</th>
                  <th>Owner</th>
                  <th>Días</th>
                </tr>
              </thead>
              <tbody>
                {data.stale.map((row) => (
                  <tr key={row.ghl_opportunity_id}>
                    <td>
                      <strong>{row.opportunity_name}</strong>
                      {row.student_name ? (
                        <span className="secondary-cell">
                          {row.student_name}
                        </span>
                      ) : null}
                    </td>
                    <td>{row.current_stage}</td>
                    <td>{row.operational_owner}</td>
                    <td>{row.days_since_update ?? "—"}</td>
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
