import Link from "next/link";
import { Download, Filter, Search, UsersRound } from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { OperationalCascade } from "@/components/operational-cascade";
import { getOperationalCascade } from "@/lib/cascade";
import {
  dateRangeParams,
  dateRangeQuery,
  resolveDateRange,
} from "@/lib/date-range";
import { getPipelineOperationalData } from "@/lib/data";
import { number } from "@/lib/format";
import {
  ownerLabel,
  stageLabel,
} from "@/lib/terminology";
import type { PipelineFilters } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildFilters(params: SearchParams): PipelineFilters {
  return {
    q: first(params.q),
    stage: first(params.stage),
    owner: first(params.owner),
    source: first(params.source),
    status: first(params.status),
    inactivity: first(params.inactivity),
    range: first(params.range),
    from: first(params.from),
    to: first(params.to),
    page: Number(first(params.page) ?? 1),
  };
}

function queryString(
  filters: PipelineFilters,
  overrides: Partial<PipelineFilters> = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(merged)) {
    const value = String(rawValue ?? "").trim();
    if (value && !(key === "page" && value === "1")) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = buildFilters(params);
  const range = resolveDateRange(params);
  const [data, cascade] = await Promise.all([
    getPipelineOperationalData(filters, range),
    getOperationalCascade(range),
  ]);

  const open = data.rows.filter(
    (row) => row.status.toLowerCase() === "open",
  ).length;
  const stale = data.rows.filter(
    (row) => Number(row.days_since_update ?? 0) >= 8,
  ).length;
  const unassigned = data.rows.filter(
    (row) => row.operational_owner === "Sin asignar",
  ).length;

  const exportUrl =
    `/api/pipeline/export${queryString(filters, { page: undefined })}`;

  return (
    <DashboardLayout
      eyebrow="CRM Operations"
      title="Pipeline Detail"
      subtitle="Search, filter and open lead-level details from the GHL replica."
      statusLabel={`${number(data.totalFiltered)} results · ${range.label}`}
    >
      <DateRangeFilter
        basePath="/pipeline"
        preserve={{
          q: filters.q,
          stage: filters.stage,
          owner: filters.owner,
          source: filters.source,
          status: filters.status,
          inactivity: filters.inactivity,
        }}
        range={range}
      />

      <OperationalCascade metrics={cascade} range={range} />

      <section className="kpi-grid pipeline-kpi-grid">
        <KpiCard
          label="Filtered Results"
          value={number(data.totalFiltered)}
          helper={`${number(data.totalRows)} leads in ${range.label}`}
          icon={Filter}
        />
        <KpiCard
          label="Open on This Page"
          value={number(open)}
          helper="Current operational status"
          icon={UsersRound}
        />
        <KpiCard
          label="8+ Days on This Page"
          value={number(stale)}
          helper="No recent update"
          icon={Search}
        />
        <KpiCard
          label="Unassigned on This Page"
          value={number(unassigned)}
          helper="Owner review required"
          icon={UsersRound}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Find an Opportunity</h2>
          </div>
          <Link className="button-link" href={exportUrl}>
            <Download size={16} />
            Export CSV
          </Link>
        </div>

        <form className="filter-grid" method="get">
          {Object.entries(dateRangeParams(range)).map(([key, value]) => (
            <input key={key} name={key} type="hidden" value={value} />
          ))}

          <label className="filter-field filter-search">
            <span>Search</span>
            <input
              defaultValue={filters.q ?? ""}
              name="q"
              placeholder="Name, phone, email or student"
            />
          </label>

          <label className="filter-field">
            <span>Current Stage</span>
            <select defaultValue={filters.stage ?? ""} name="stage">
              <option value="">All Stages</option>
              {data.stages.map((value) => (
                <option key={value} value={value}>
                  {stageLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Owner</span>
            <select defaultValue={filters.owner ?? ""} name="owner">
              <option value="">All Owners</option>
              {data.owners.map((value) => (
                <option key={value} value={value}>
                  {ownerLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Source</span>
            <select defaultValue={filters.source ?? ""} name="source">
              <option value="">All Sources</option>
              {data.sources.map((value) => (
                <option key={value} value={value}>
                  {value === "Sin fuente" ? "No Source" : value}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Status</span>
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">All Statuses</option>
              {data.statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Inactivity</span>
            <select
              defaultValue={filters.inactivity ?? ""}
              name="inactivity"
            >
              <option value="">All Buckets</option>
              {data.inactivityBuckets.map((value) => (
                <option key={value} value={value}>
                  {value === "Sin fecha" ? "No Date" : value}
                </option>
              ))}
            </select>
          </label>

          <div className="filter-actions">
            <button className="primary-button" type="submit">
              Apply Filters
            </button>
            <Link
              className="secondary-button"
              href={`/pipeline?${dateRangeQuery(range)}`}
            >
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Lead-level view</p>
            <h2>Pipeline Opportunities</h2>
          </div>
          <p className="panel-note">
            Click a lead name to review School Tour attendance,
            objections and notes.
          </p>
        </div>

        {data.rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Current Stage</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Source</th>
                  <th>Grade</th>
                  <th>Phone</th>
                  <th>Days Since Update</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.ghl_opportunity_id}>
                    <td>
                      <Link
                        className="lead-name-link"
                        href={`/leads/${encodeURIComponent(row.ghl_opportunity_id)}`}
                      >
                        {row.student_name ||
                          row.contact_name ||
                          row.opportunity_name}
                      </Link>
                      <span className="secondary-cell">
                        {row.email ?? row.opportunity_name}
                      </span>
                    </td>
                    <td>{stageLabel(row.current_stage)}</td>
                    <td>{row.status}</td>
                    <td>{ownerLabel(row.operational_owner)}</td>
                    <td>{row.source ?? "No Source"}</td>
                    <td>{row.grade_interest ?? "—"}</td>
                    <td>{row.phone ?? "—"}</td>
                    <td>{row.days_since_update ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No opportunities match the selected filters." />
        )}

        <div className="pagination-row">
          <span>
            Page {number(data.page)} of {number(data.totalPages)}
          </span>
          <div>
            {data.page > 1 ? (
              <Link
                className="secondary-button"
                href={queryString(filters, { page: data.page - 1 })}
              >
                Previous
              </Link>
            ) : null}
            {data.page < data.totalPages ? (
              <Link
                className="secondary-button"
                href={queryString(filters, { page: data.page + 1 })}
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
