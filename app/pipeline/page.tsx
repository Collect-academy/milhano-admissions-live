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
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import { HelpTip } from "@/components/help-tip";
import { conceptDefinition, stageConceptDefinition } from "@/lib/concepts";
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
  const locale = await getDashboardLocale();
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
      eyebrow={tr(locale, "CRM Operations", "Operación CRM")}
      title={tr(locale, "Pipeline Detail", "Detalle del Pipeline")}
      subtitle={tr(locale, "Search, filter and open lead-level details from the GHL replica.", "Busca, filtra y abre detalles de leads desde la réplica de GHL.")}
      statusLabel={`${number(data.totalFiltered)} ${tr(locale, "results", "resultados")} · ${range.label}`}
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
        locale={locale}
      />

      <OperationalCascade metrics={cascade} range={range} locale={locale} />

      <section className="kpi-grid pipeline-kpi-grid">
        <KpiCard
          label="Filtered Results"
          value={number(data.totalFiltered)}
          helper={`${number(data.totalRows)} leads in ${range.label}`}
          icon={Filter}
          locale={locale}
        />
        <KpiCard
          label="Open on This Page"
          value={number(open)}
          helper="Current operational status"
          icon={UsersRound}
          locale={locale}
        />
        <KpiCard
          label="8+ Days on This Page"
          value={number(stale)}
          helper="No recent update"
          icon={Search}
          locale={locale}
        />
        <KpiCard
          label="Unassigned on This Page"
          value={number(unassigned)}
          helper="Owner review required"
          icon={UsersRound}
          locale={locale}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>{tr(locale, "Find an Opportunity", "Buscar una Opportunity")}</h2>
          </div>
          <Link className="button-link" href={exportUrl}>
            <Download size={16} />
            {tr(locale, "Export CSV", "Exportar CSV")}
          </Link>
        </div>

        <form className="filter-grid" method="get">
          {Object.entries(dateRangeParams(range)).map(([key, value]) => (
            <input key={key} name={key} type="hidden" value={value} />
          ))}

          <label className="filter-field filter-search">
            <span>{tr(locale, "Search", "Buscar")}</span>
            <input
              defaultValue={filters.q ?? ""}
              name="q"
              placeholder="Name, phone, email or student"
            />
          </label>

          <label className="filter-field">
            <span>{tr(locale, "Current Stage", "Stage Actual")}</span>
            <select defaultValue={filters.stage ?? ""} name="stage">
              <option value="">{tr(locale, "All Stages", "Todos los Stages")}</option>
              {data.stages.map((value) => (
                <option key={value} value={value}>
                  {stageLabel(value, locale)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>{tr(locale, "Owner", "Responsable")}</span>
            <select defaultValue={filters.owner ?? ""} name="owner">
              <option value="">{tr(locale, "All Owners", "Todas")}</option>
              {data.owners.map((value) => (
                <option key={value} value={value}>
                  {ownerLabel(value, locale)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Source <HelpTip text={conceptDefinition("raw_source", locale)} /></span>
            <select defaultValue={filters.source ?? ""} name="source">
              <option value="">{tr(locale, "All Sources", "Todos los Sources")}</option>
              {data.sources.map((value) => (
                <option key={value} value={value}>
                  {value === "Sin fuente" ? tr(locale, "No Source", "Sin Source") : value}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>{tr(locale, "Status", "Estatus")}</span>
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">{tr(locale, "All Statuses", "Todos")}</option>
              {data.statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>{tr(locale, "Inactivity", "Inactividad")}</span>
            <select
              defaultValue={filters.inactivity ?? ""}
              name="inactivity"
            >
              <option value="">{tr(locale, "All Buckets", "Todos")}</option>
              {data.inactivityBuckets.map((value) => (
                <option key={value} value={value}>
                  {value === "Sin fecha" ? tr(locale, "No Date", "Sin fecha") : value}
                </option>
              ))}
            </select>
          </label>

          <div className="filter-actions">
            <button className="primary-button" type="submit">
              {tr(locale, "Apply Filters", "Aplicar Filtros")}
            </button>
            <Link
              className="secondary-button"
              href={`/pipeline?${dateRangeQuery(range)}`}
            >
              {tr(locale, "Clear", "Limpiar")}
            </Link>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Lead-level view", "Vista por lead")}</p>
            <h2>{tr(locale, "Pipeline Opportunities", "Opportunities del Pipeline")}</h2>
          </div>
          <p className="panel-note">
            {tr(locale, "Click a lead name to review School Tour attendance, objections and notes.", "Haz clic en el nombre del lead para revisar asistencia a School Tour, objeciones y notas.")}
          </p>
        </div>

        {data.rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>{tr(locale, "Current Stage", "Stage Actual")}</th>
                  <th>{tr(locale, "Status", "Estatus")}</th>
                  <th>{tr(locale, "Owner", "Asesora")}</th>
                  <th>Source <HelpTip text={conceptDefinition("raw_source", locale)} /></th>
                  <th>{tr(locale, "Grade", "Grado")}</th>
                  <th>{tr(locale, "Phone", "Teléfono")}</th>
                  <th>{tr(locale, "Days Since Update", "Días Sin Actualizar")}</th>
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
                    <td>{stageLabel(row.current_stage, locale)} <HelpTip text={stageConceptDefinition(row.current_stage, locale)} /></td>
                    <td>{row.status}</td>
                    <td>{ownerLabel(row.operational_owner, locale)}</td>
                    <td>
                      {row.source ?? tr(locale, "No Source", "Sin Source")}
                      {["facebook", "instagram"].includes((row.source ?? "").trim().toLowerCase()) ? (
                        <span className="source-ambiguity-badge">{tr(locale, "Ads/Organic unknown", "Ads/Orgánico sin definir")}</span>
                      ) : null}
                    </td>
                    <td>{row.grade_interest ?? "—"}</td>
                    <td>{row.phone ?? "—"}</td>
                    <td>{row.days_since_update ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message={tr(locale, "No opportunities match the selected filters.", "No hay opportunities que coincidan con los filtros seleccionados.")} />
        )}

        <div className="pagination-row">
          <span>
            {tr(locale, "Page", "Página")} {number(data.page)} {tr(locale, "of", "de")} {number(data.totalPages)}
          </span>
          <div>
            {data.page > 1 ? (
              <Link
                className="secondary-button"
                href={queryString(filters, { page: data.page - 1 })}
              >
                {tr(locale, "Previous", "Anterior")}
              </Link>
            ) : null}
            {data.page < data.totalPages ? (
              <Link
                className="secondary-button"
                href={queryString(filters, { page: data.page + 1 })}
              >
                {tr(locale, "Next", "Siguiente")}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
