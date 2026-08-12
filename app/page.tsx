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
import { getOperationalCascade } from "@/lib/cascade";
import {
  dateRangeQuery,
  resolveDateRange,
} from "@/lib/date-range";
import { getDashboardData } from "@/lib/data";
import { dateLabel, number, percent } from "@/lib/format";
import { getSystemHealthData } from "@/lib/system-health";
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

  const [data, health, cascade] = await Promise.all([
    getDashboardData(range),
    getSystemHealthData(),
    getOperationalCascade(range),
  ]);

  const leadToClosed =
    data.funnel.find(
      (row) => row.stage_name === "Inscrito",
    )?.conversion_from_lead_pct ?? null;

  const rangeQuery = dateRangeQuery(range);
  const cascadeByKey = new Map(
    cascade.map((metric) => [metric.metric_key, metric]),
  );

  const reconciled = (metricKey: string, fallback: number) =>
    cascadeByKey.get(metricKey)?.metric_value ?? fallback;

  const sourceHelper = (metricKey: string, fallback: string) => {
    const metric = cascadeByKey.get(metricKey);
    if (!metric) return fallback;

    const parts = [`GHL ${number(metric.system_value)}`];
    if (metric.manual_extra_value > 0) {
      parts.push(`+${number(metric.manual_extra_value)} manual`);
    }
    if (metric.gap !== null && metric.gap !== 0) {
      parts.push(`gap ${metric.gap > 0 ? "+" : ""}${number(metric.gap)}`);
    }
    return parts.join(" · ");
  };

  return (
    <DashboardLayout
      eyebrow="Milhano · Admissions"
      statusLabel={`Period ${dateLabel(
        range.start,
      )} – ${dateLabel(range.end)}`}
      subtitle="Unified admissions performance, activity and operational follow-up."
      title="Admissions Summary"
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
            ? "System is up to date"
            : health.overallStatus === "error"
              ? "System has errors"
              : "System requires review"}
        </span>
        <strong>View monitoring →</strong>
      </Link>

      <DateRangeFilter basePath="/" range={range} />

      <OperationalCascade
        metrics={cascade}
        range={range}
      />

      <section
        aria-label="Period indicators"
        className="kpi-grid"
      >
        <KpiCard
          helper={sourceHelper("new_leads", range.label)}
          icon={Activity}
          label="New Leads"
          value={number(
            reconciled("new_leads", data.period.new_leads),
          )}
        />
        <KpiCard
          helper={sourceHelper(
            "school_tours_booked",
            "School Tour stage entries",
          )}
          icon={Clock3}
          label="School Tours Booked"
          value={number(
            reconciled(
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
          label="School Tours Attended"
          value={number(
            reconciled(
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
          label="Closed"
          value={number(
            reconciled("closed", data.period.enrolled),
          )}
        />
        <KpiCard
          helper="Shared institutional channel"
          icon={MessageCircleMore}
          label="WhatsApp Messages"
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
          label="Number of Dials"
          value={number(
            reconciled(
              "number_of_dials",
              data.period.call_attempts,
            ),
          )}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              Current operational position
            </p>
            <h2>Current GHL Stages</h2>
          </div>
          <p className="panel-note">
            These cards show the current CRM stage. The unified
            cascade above measures period activity.
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
                  Current Stage
                </span>
                <strong>
                  {number(stage.opportunity_count)}
                </strong>
              </div>
              <h3>{stageLabel(stage.stage_name)}</h3>
              <div className="stage-meta">
                <span>
                  {number(stage.open_count)} open
                </span>
                <span>
                  {number(stage.open_8_plus_days)} with 8+
                  days
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <DashboardCharts
        daily={data.daily}
        rangeLabel={range.label}
      />

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                Cohort · {range.label}
              </p>
              <h2>Performance by Source · GHL Only</h2>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>New Leads</th>
                  <th>School Tours Booked</th>
                  <th>School Tours Attended</th>
                  <th>Closed</th>
                  <th>Lead → Closed</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((row) => (
                  <tr key={row.source ?? "no-source"}>
                    <td>{row.source ?? "No Source"}</td>
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
              <h2>Performance by Advisor · GHL Only</h2>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Advisor</th>
                  <th>New Leads</th>
                  <th>School Tours Booked</th>
                  <th>School Tours Attended</th>
                  <th>Closed</th>
                  <th>Lead → Closed</th>
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
                        row.operational_owner,
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
              <h2>Recorded Exits</h2>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Exit</th>
                  <th>Previous Stage</th>
                  <th>Reason</th>
                  <th>Leads</th>
                </tr>
              </thead>
              <tbody>
                {data.exits.map((row, index) => (
                  <tr
                    key={`${row.exit_type}-${row.exit_from_stage}-${index}`}
                  >
                    <td>{stageLabel(row.exit_type)}</td>
                    <td>
                      {stageLabel(row.exit_from_stage)}
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
              <h2>Longest Current Inactivity</h2>
            </div>
            <AlertTriangle size={18} />
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Current Stage</th>
                  <th>Owner</th>
                  <th>Days</th>
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
                      {stageLabel(row.current_stage)}
                    </td>
                    <td>
                      {ownerLabel(
                        row.operational_owner,
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
