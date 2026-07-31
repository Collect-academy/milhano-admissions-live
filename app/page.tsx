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
import { KpiCard } from "@/components/kpi-card";
import { dateLabel, number, percent } from "@/lib/format";
import { getDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

function stageCount(
  pipeline: Awaited<ReturnType<typeof getDashboardData>>["pipeline"],
  name: string,
): number {
  return (
    pipeline.find((row) => row.stage_name === name)?.opportunity_count ?? 0
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  const totalOpportunities = data.pipeline.reduce(
    (sum, row) => sum + row.opportunity_count,
    0,
  );
  const active = data.pipeline.reduce((sum, row) => sum + row.open_count, 0);
  const noFitAndLost =
    stageCount(data.pipeline, "No fit") +
    stageCount(data.pipeline, "Lost / Sin continuidad");
  const enrolledReached =
    data.funnel.find((row) => row.stage_name === "Inscrito")?.reached_count ?? 0;
  const leadToEnrolled =
    data.funnel.find((row) => row.stage_name === "Inscrito")
      ?.conversion_from_lead_pct ?? null;
  const currentFit = stageCount(data.pipeline, "Fit");
  const currentTour = stageCount(data.pipeline, "School Tour agendado");
  const currentPassday = stageCount(data.pipeline, "Pasadía agendada");
  const latestMetricDate =
    data.latestEod?.eod_date ??
    data.latestWhatsapp?.activity_date ??
    data.daily.at(-1)?.metric_date ??
    new Intl.DateTimeFormat("en-CA").format(new Date());

  return (
    <DashboardLayout
      eyebrow="Milhano · Admisiones"
      title="Pipeline & Growth Dashboard"
      subtitle="Estado operativo del pipeline, actividad del equipo y canales institucionales."
      statusLabel={`Datos hasta ${dateLabel(latestMetricDate)}`}
    >
      <section className="kpi-grid" aria-label="Indicadores principales">
        <KpiCard
          label="Opportunities"
          value={number(totalOpportunities)}
          helper="Fotografía actual de GHL"
          icon={Users}
        />
        <KpiCard
          label="Activas"
          value={number(active)}
          helper="Status Open"
          icon={Clock3}
        />
        <KpiCard
          label="En etapas clave"
          value={number(currentFit + currentTour + currentPassday)}
          helper="Fit, tour o pasadía agendada"
          icon={Route}
        />
        <KpiCard
          label="Inscritos históricos"
          value={number(enrolledReached)}
          helper={`${percent(leadToEnrolled)} desde lead`}
          icon={GraduationCap}
        />
        <KpiCard
          label="WhatsApp último día"
          value={number(data.latestWhatsapp?.total_messages)}
          helper={`${number(data.latestWhatsapp?.active_conversations)} conversaciones`}
          icon={MessageCircleMore}
        />
        <KpiCard
          label="Llamadas registradas"
          value={number(data.latestCalls?.total_call_attempts)}
          helper={`${number(data.latestCalls?.outbound_attempts)} intentos outbound`}
          icon={PhoneCall}
        />
      </section>

      <section className="insight-strip">
        <div>
          <span className="insight-label">Salidas actuales</span>
          <strong>{number(noFitAndLost)}</strong>
          <span>No fit + Lost</span>
        </div>
        <div>
          <span className="insight-label">Sincronización</span>
          <strong className="text-success">Activa</strong>
          <span>GHL → n8n → Supabase</span>
        </div>
        <div>
          <span className="insight-label">EOD</span>
          <strong>{data.latestEod ? "Generado" : "Pendiente"}</strong>
          <span>{data.latestEod ? dateLabel(data.latestEod.eod_date) : "Sin snapshot"}</span>
        </div>
        <div>
          <span className="insight-label">Base histórica</span>
          <strong>Validada</strong>
          <span>Snapshot + eventos</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Operación</p>
            <h2>Distribución actual del pipeline</h2>
          </div>
          <p className="panel-note">
            Las columnas muestran cards actuales; no equivalen a historia.
          </p>
        </div>

        <div className="pipeline-grid">
          {data.pipeline.map((stage) => (
            <article className="stage-card" key={stage.stage_name}>
              <div className="stage-topline">
                <span
                  className={`stage-chip stage-${stage.stage_group.toLowerCase()}`}
                >
                  {stage.stage_group}
                </span>
                <strong>{number(stage.opportunity_count)}</strong>
              </div>
              <h3>{stage.stage_name}</h3>
              <div className="stage-meta">
                <span>{number(stage.open_count)} abiertas</span>
                <span>{number(stage.open_8_plus_days)} con 8+ días</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="two-column">
        <DashboardCharts funnel={data.funnel} daily={data.daily} />
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Adquisición</p>
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
                    <td>{percent(row.lead_to_enrolled_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Equipo</p>
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
                  <tr key={row.operational_owner ?? "sin-asignar"}>
                    <td>{row.operational_owner ?? "Sin asignar"}</td>
                    <td>{number(row.leads)}</td>
                    <td>{number(row.fits)}</td>
                    <td>{number(row.enrolled)}</td>
                    <td>{percent(row.lead_to_enrolled_pct)}</td>
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
              <p className="eyebrow">Conversión</p>
              <h2>Salidas por etapa y motivo</h2>
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
              <p className="eyebrow">Seguimiento</p>
              <h2>Opportunities con mayor inactividad</h2>
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
                        <span className="secondary-cell">{row.student_name}</span>
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
