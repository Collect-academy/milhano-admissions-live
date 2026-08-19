import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Clock3,
  GraduationCap,
  MessageCircleMore,
  PhoneCall,
} from "lucide-react";

import { DashboardCharts } from "@/components/dashboard-charts";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { KpiCard } from "@/components/kpi-card";
import { OperationalCascade } from "@/components/operational-cascade";
import { ManualEodSummary } from "@/components/manual-eod-summary";
import { SummarySourceToggle, type SummarySource } from "@/components/summary-source-toggle";
import { getOperationalReconciliation } from "@/lib/cascade";
import {
  dateRangeQuery,
  resolveDateRange,
} from "@/lib/date-range";
import { getDashboardData } from "@/lib/data";
import { dateLabel, number, percent } from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import { HelpTip } from "@/components/help-tip";
import { conceptDefinition, stageConceptDefinition } from "@/lib/concepts";
import { getSystemHealthData } from "@/lib/system-health";
import { getSubmittedManualEodTotals } from "@/lib/eod-manual";
import {
  ownerLabel,
  stageLabel,
} from "@/lib/terminology";

export const dynamic = "force-dynamic";

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const locale = await getDashboardLocale();
  const requestedSource = Array.isArray(params.source) ? params.source[0] : params.source;
  const summarySource: SummarySource = requestedSource === "ghl" ? "ghl" : "manual";

  const [data, health, reconciliation, manualTotals] = await Promise.all([
    getDashboardData(range),
    getSystemHealthData(),
    getOperationalReconciliation(range),
    getSubmittedManualEodTotals(range),
  ]);
  const cascade = reconciliation.filter((metric) => metric.show_in_cascade);

  const leadToClosed =
    data.funnel.find(
      (row) => row.stage_name === "Inscrito",
    )?.conversion_from_lead_pct ?? null;

  const rangeQuery = dateRangeQuery(range);
  const cascadeByKey = new Map(
    reconciliation.map((metric) => [metric.metric_key, metric]),
  );
  const systemValue = (metricKey: string, fallback: number) =>
    cascadeByKey.get(metricKey)?.system_value ?? fallback;

  const sourceHelper = (metricKey: string, fallback: string) => {
    const metric = cascadeByKey.get(metricKey);
    if (!metric || metric.system_value === null) return fallback;
    return `GHL/System ${number(metric.system_value)}`;
  };

  return (
    <DashboardLayout
      eyebrow={tr(locale, "Milhano · Admissions", "Milhano · Admisiones")}
      statusLabel={`${tr(locale, "Period", "Periodo")} ${dateLabel(
        range.start,
      )} – ${dateLabel(range.end)}`}
      subtitle={tr(locale, "Unified admissions performance, activity and operational follow-up.", "Rendimiento unificado de admisiones, actividad y seguimiento operativo.")}
      title={tr(locale, "Admissions Summary", "Resumen de Admisiones")}
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
            ? tr(locale, "System is up to date", "Sistema actualizado")
            : health.overallStatus === "error"
              ? tr(locale, "System has errors", "El sistema tiene errores")
              : tr(locale, "System requires review", "El sistema requiere revisión")}
        </span>
        <strong>{tr(locale, "View monitoring →", "Ver monitoreo →")}</strong>
      </Link>

      <DateRangeFilter
        basePath="/"
        range={range}
        locale={locale}
        preserve={{ source: summarySource }}
      />

      <SummarySourceToggle source={summarySource} range={range} locale={locale} />

      {summarySource === "manual" ? (
        <ManualEodSummary totals={manualTotals} locale={locale} />
      ) : (
        <>
          <OperationalCascade
            metrics={cascade}
            range={range}
            locale={locale}
            mode="system"
          />

          <section
            aria-label="Period indicators"
            className="kpi-grid"
          >
        <KpiCard
          helper={sourceHelper("new_leads", range.label)}
          icon={Activity}
          label={tr(locale, "New Leads", "Leads Totales")}
          definitionKey="new_leads"
          locale={locale}
          value={number(
            systemValue("new_leads", data.period.new_leads),
          )}
        />
        <KpiCard
          helper={sourceHelper(
            "school_tours_booked",
            "School Tour stage entries",
          )}
          icon={Clock3}
          label={tr(locale, "School Tours Booked", "ST Booked")}
          definitionKey="school_tours_booked"
          locale={locale}
          value={number(
            systemValue(
              "school_tours_booked",
              data.period.tours_scheduled,
            ),
          )}
        />
        <KpiCard
          helper={sourceHelper(
            "school_tours_attended",
            `${number(data.period.tours_attended)} attended`,
          )}
          icon={GraduationCap}
          label={tr(locale, "School Tours Attended", "ST Attended")}
          definitionKey="school_tours_attended"
          locale={locale}
          value={number(
            systemValue(
              "school_tours_attended",
              data.period.tours_attended,
            ),
          )}
        />
        <KpiCard
          helper={sourceHelper(
            "closed",
            `${percent(leadToClosed)} lead-to-closed`,
          )}
          icon={GraduationCap}
          label={tr(locale, "Closed", "Inscritos / Closed")}
          definitionKey="closed"
          locale={locale}
          value={number(
            systemValue("closed", data.period.enrolled),
          )}
        />
        <KpiCard
          helper={tr(locale, "Shared institutional channel", "Canal institucional compartido")}
          icon={MessageCircleMore}
          label={tr(locale, "WhatsApp Messages", "Mensajes WhatsApp")}
          definitionKey="whatsapp_messages"
          locale={locale}
          value={number(data.period.whatsapp_messages)}
        />
        <KpiCard
          helper={sourceHelper(
            "number_of_dials",
            `${number(
              data.period.outbound_call_attempts,
            )} outbound attempts`,
          )}
          icon={PhoneCall}
          label={tr(locale, "Number of Dials", "Llamadas GHL")}
          definitionKey="number_of_dials"
          locale={locale}
          value={number(
            systemValue(
              "number_of_dials",
              data.period.call_attempts,
            ),
          )}
        />
          </section>
        </>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              {tr(locale, "Current operational position", "Posición operativa actual")}
            </p>
            <h2>{tr(locale, "Current GHL Stages", "Stages Actuales en GHL")} <HelpTip text={conceptDefinition("current_stage", locale)} /></h2>
          </div>
          <p className="panel-note">
            {tr(locale, "These cards show the current CRM stage. The unified cascade above measures period activity.", "Estas cards muestran el stage actual en CRM. La cascada superior mide actividad del periodo.")}
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
                <span className="stage-chip stage-hito">
                  {tr(locale, "Current Stage", "Stage Actual")}
                </span>
                <strong>
                  {number(stage.opportunity_count)}
                </strong>
              </div>
              <h3>{stageLabel(stage.stage_name, locale)} <HelpTip text={stageConceptDefinition(stage.stage_name, locale)} /></h3>
              <div className="stage-meta">
                <span>
                  {number(stage.open_count)} {tr(locale, "open", "abiertos")}
                </span>
                <span>
                  {number(stage.open_8_plus_days)} {tr(locale, "with 8+ days", "con 8+ días")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <DashboardCharts
        daily={data.daily}
        rangeLabel={range.label}
        locale={locale}
      />

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                Cohort · {range.label}
              </p>
              <h2>{tr(locale, "Performance by Raw Source · GHL Only", "Rendimiento por Source Crudo · Solo GHL")} <HelpTip text={conceptDefinition("raw_source", locale)} /></h2>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr(locale, "Source", "Source")} <HelpTip text={conceptDefinition("raw_source", locale)} /></th>
                  <th>{tr(locale, "New Leads", "Leads Totales")}</th>
                  <th>{tr(locale, "School Tours Booked", "ST Booked")}</th>
                  <th>{tr(locale, "School Tours Attended", "ST Attended")}</th>
                  <th>{tr(locale, "Closed", "Inscritos / Closed")}</th>
                  <th>{tr(locale, "Lead → Closed", "Lead → Closed")}</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((row) => (
                  <tr key={row.source ?? "no-source"}>
                    <td>
                      {row.source ?? tr(locale, "No Source", "Sin Source")}
                      {["facebook", "instagram"].includes((row.source ?? "").trim().toLowerCase()) ? (
                        <span className="source-ambiguity-badge">{tr(locale, "Ads/Organic unknown", "Ads/Orgánico sin definir")}</span>
                      ) : null}
                    </td>
                    <td>{number(row.leads)}</td>
                    <td>
                      {number(row.tours_scheduled)}
                    </td>
                    <td>{number(row.tours_attended)}</td>
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
                Cohort · {range.label}
              </p>
              <h2>{tr(locale, "Performance by Advisor · GHL Only", "Rendimiento por Asesora · Solo GHL")}</h2>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr(locale, "Advisor", "Asesora")}</th>
                  <th>{tr(locale, "New Leads", "Leads Totales")}</th>
                  <th>{tr(locale, "School Tours Booked", "ST Booked")}</th>
                  <th>{tr(locale, "School Tours Attended", "ST Attended")}</th>
                  <th>{tr(locale, "Closed", "Inscritos / Closed")}</th>
                  <th>{tr(locale, "Lead → Closed", "Lead → Closed")}</th>
                </tr>
              </thead>
              <tbody>
                {data.owners.map((row) => (
                  <tr
                    key={
                      row.operational_owner ?? "unassigned"
                    }
                  >
                    <td>
                      {ownerLabel(
                        row.operational_owner, locale,
                      )}
                    </td>
                    <td>{number(row.leads)}</td>
                    <td>
                      {number(row.tours_scheduled)}
                    </td>
                    <td>{number(row.tours_attended)}</td>
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
              <h2>{tr(locale, "Recorded Exits", "Salidas Registradas")}</h2>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr(locale, "Exit", "Salida")}</th>
                  <th>{tr(locale, "Previous Stage", "Stage Anterior")}</th>
                  <th>{tr(locale, "Reason", "Motivo")}</th>
                  <th>Leads</th>
                </tr>
              </thead>
              <tbody>
                {data.exits.map((row, index) => (
                  <tr
                    key={`${row.exit_type}-${row.exit_from_stage}-${index}`}
                  >
                    <td>{stageLabel(row.exit_type, locale)}</td>
                    <td>
                      {stageLabel(row.exit_from_stage, locale)}
                    </td>
                    <td>{row.exit_reason}</td>
                    <td>
                      {number(row.opportunity_count)}
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
                Cohort · {range.label}
              </p>
              <h2>{tr(locale, "Longest Current Inactivity", "Mayor Inactividad Actual")}</h2>
            </div>
            <AlertTriangle size={18} />
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>{tr(locale, "Current Stage", "Stage Actual")}</th>
                  <th>{tr(locale, "Owner", "Asesora")}</th>
                  <th>{tr(locale, "Days", "Días")}</th>
                </tr>
              </thead>
              <tbody>
                {data.stale.map((row) => (
                  <tr key={row.ghl_opportunity_id}>
                    <td>
                      <Link
                        href={`/leads/${encodeURIComponent(
                          row.ghl_opportunity_id,
                        )}`}
                      >
                        {row.opportunity_name}
                      </Link>
                    </td>
                    <td>
                      {stageLabel(row.current_stage, locale)}
                    </td>
                    <td>
                      {ownerLabel(
                        row.operational_owner, locale,
                      )}
                    </td>
                    <td>
                      {row.days_since_update ?? "—"}
                    </td>
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
