import Link from "next/link";
import { ArrowLeft, MessageSquareText, Search } from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { getCascadeLeads } from "@/lib/cascade";
import { resolveDateRange } from "@/lib/date-range";
import { dateTimeLabel, number } from "@/lib/format";
import {
  attendanceLabel,
  cascadeMetricLabel,
  stageLabel,
} from "@/lib/terminology";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const metric = first(params.metric) || "school_tours_attended";
  const query = first(params.q).toLowerCase();
  const rows = await getCascadeLeads(metric, range);
  const filtered = query
    ? rows.filter((row) =>
        [
          row.lead_name,
          row.phone,
          row.email,
          row.current_stage,
          row.objection_summary,
          row.school_tour_notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : rows;

  return (
    <DashboardLayout
      eyebrow="Clickable scorecard"
      title={cascadeMetricLabel(metric)}
      subtitle="Lead-level detail for the selected operational metric."
      statusLabel={`${number(filtered.length)} lead rows`}
    >
      <Link className="secondary-button inline-back-link" href="/">
        <ArrowLeft size={16} />
        Back to Summary
      </Link>

      <DateRangeFilter
        basePath="/leads"
        preserve={{ metric, q: first(params.q) }}
        range={range}
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{range.label}</p>
            <h2>{cascadeMetricLabel(metric)}</h2>
          </div>
          <form className="lead-search-form" method="get">
            <input name="metric" type="hidden" value={metric} />
            <input name="range" type="hidden" value={range.key} />
            {range.key === "custom" ? (
              <>
                <input name="from" type="hidden" value={range.start} />
                <input name="to" type="hidden" value={range.end} />
              </>
            ) : null}
            <Search size={16} />
            <input
              defaultValue={first(params.q)}
              name="q"
              placeholder="Search name, phone, notes or objection"
            />
          </form>
        </div>

        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Current Stage</th>
                  <th>Activity</th>
                  <th>School Tour</th>
                  <th>Objection</th>
                  <th>Notes</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => (
                  <tr key={`${row.ghl_opportunity_id ?? row.ghl_contact_id}-${index}`}>
                    <td>
                      {row.ghl_opportunity_id ? (
                        <Link
                          className="lead-name-link"
                          href={`/leads/${encodeURIComponent(row.ghl_opportunity_id)}`}
                        >
                          {row.lead_name}
                        </Link>
                      ) : (
                        <strong>{row.lead_name}</strong>
                      )}
                      <span className="secondary-cell">
                        {row.phone ?? row.email ?? "No contact data"}
                      </span>
                    </td>
                    <td>{stageLabel(row.current_stage)}</td>
                    <td>
                      {dateTimeLabel(row.activity_at)}
                      {row.activity_count > 1 ? (
                        <span className="secondary-cell">
                          {number(row.activity_count)} events
                        </span>
                      ) : null}
                    </td>
                    <td>{attendanceLabel(row.attendance_status)}</td>
                    <td>
                      {row.has_objection
                        ? row.objection_summary ?? "Objection recorded"
                        : "None recorded"}
                    </td>
                    <td>
                      {row.school_tour_notes ? (
                        <span className="notes-preview">
                          <MessageSquareText size={14} />
                          {row.school_tour_notes}
                        </span>
                      ) : (
                        row.historical_comments ?? "—"
                      )}
                    </td>
                    <td>{row.operational_owner ?? "Unassigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No leads match this scorecard and period." />
        )}
      </section>
    </DashboardLayout>
  );
}
