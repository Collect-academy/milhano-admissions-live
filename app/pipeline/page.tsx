import Link from "next/link";
import {
  Download,
  Filter,
  Search,
  UsersRound,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import {
  dateRangeParams,
  dateRangeQuery,
  resolveDateRange,
} from "@/lib/date-range";
import { getPipelineOperationalData } from "@/lib/data";
import { dateLabel, number } from "@/lib/format";
import type { PipelineFilters } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

function first(
  value: string | string[] | undefined,
): string | undefined {
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

    if (
      value &&
      !(key === "page" && value === "1")
    ) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function statusLabel(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === "won") return "Won";
  if (normalized === "lost") return "Lost";
  if (normalized === "open") return "Open";

  return status;
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = buildFilters(params);
  const range = resolveDateRange(params);
  const data = await getPipelineOperationalData(
    filters,
    range,
  );

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
      eyebrow="Operación"
      title="Pipeline Detail"
      subtitle="Búsqueda, filtros y exportación de las opportunities sincronizadas desde GHL."
      statusLabel={`${number(data.totalFiltered)} resultados · ${range.label}`}
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

      <section className="kpi-grid pipeline-kpi-grid">
        <KpiCard
          label="Resultados filtrados"
          value={number(data.totalFiltered)}
          helper={`${number(data.totalRows)} captadas en ${range.label}`}
          icon={Filter}
        />
        <KpiCard
          label="Open en esta página"
          value={number(open)}
          helper="Status operativo actual"
          icon={UsersRound}
        />
        <KpiCard
          label="8+ días en esta página"
          value={number(stale)}
          helper="Sin actualización reciente"
          icon={Search}
        />
        <KpiCard
          label="Sin asignar en esta página"
          value={number(unassigned)}
          helper="Requieren revisión de owner"
          icon={UsersRound}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Filtros</p>
            <h2>Encontrar una opportunity</h2>
          </div>
          <Link className="button-link" href={exportUrl}>
            <Download size={16} />
            Exportar CSV
          </Link>
        </div>

        <form className="filter-grid" method="get">
          {Object.entries(dateRangeParams(range)).map(
            ([key, value]) => (
              <input
                key={key}
                name={key}
                type="hidden"
                value={value}
              />
            ),
          )}
          <label className="filter-field filter-search">
            <span>Buscar</span>
            <input
              defaultValue={filters.q ?? ""}
              name="q"
              placeholder="Nombre, teléfono, correo, alumno…"
              type="search"
            />
          </label>

          <label className="filter-field">
            <span>Etapa</span>
            <select defaultValue={filters.stage ?? ""} name="stage">
              <option value="">Todas</option>
              {data.stages.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Asesora</span>
            <select defaultValue={filters.owner ?? ""} name="owner">
              <option value="">Todas</option>
              {data.owners.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Fuente</span>
            <select defaultValue={filters.source ?? ""} name="source">
              <option value="">Todas</option>
              {data.sources.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Status</span>
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">Todos</option>
              {data.statuses.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Inactividad</span>
            <select
              defaultValue={filters.inactivity ?? ""}
              name="inactivity"
            >
              <option value="">Todas</option>
              {data.inactivityBuckets.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <div className="filter-actions">
            <button className="primary-button" type="submit">
              Aplicar
            </button>
            <Link
              className="secondary-button"
              href={`/pipeline?${dateRangeQuery(range)}`}
            >
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Resultados</p>
            <h2>
              Página {number(data.page)} de {number(data.totalPages)}
            </h2>
          </div>
          <p className="panel-note">
            El periodo usa la fecha original del lead o, si falta, la fecha de creación.
          </p>
        </div>

        {data.rows.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Opportunity</th>
                    <th>Etapa</th>
                    <th>Status</th>
                    <th>Asesora</th>
                    <th>Fuente</th>
                    <th>Interés</th>
                    <th>Contacto</th>
                    <th>Actualización</th>
                    <th>Días</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.ghl_opportunity_id}>
                      <td>
                        <strong>{row.opportunity_name}</strong>
                        <span className="secondary-cell">
                          {row.student_name ??
                            row.contact_name ??
                            "Sin nombre adicional"}
                        </span>
                      </td>
                      <td>{row.current_stage}</td>
                      <td>
                        <span
                          className={
                            row.status.toLowerCase() === "won"
                              ? "status-pill status-good"
                              : row.status.toLowerCase() === "lost"
                                ? "status-pill status-bad"
                                : "status-pill status-pending"
                          }
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.operational_owner}</td>
                      <td>{row.source ?? "Sin fuente"}</td>
                      <td>
                        {row.grade_interest ??
                          row.level ??
                          "—"}
                      </td>
                      <td>
                        {row.phone ?? "—"}
                        {row.email ? (
                          <span className="secondary-cell">
                            {row.email}
                          </span>
                        ) : null}
                      </td>
                      <td>{dateLabel(row.updated_at)}</td>
                      <td>{row.days_since_update ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination-row">
              {data.page > 1 ? (
                <Link
                  className="secondary-button"
                  href={`/pipeline${queryString(filters, {
                    page: data.page - 1,
                  })}`}
                >
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}

              <span>
                {number((data.page - 1) * data.pageSize + 1)}–
                {number(
                  Math.min(
                    data.page * data.pageSize,
                    data.totalFiltered,
                  ),
                )}{" "}
                de {number(data.totalFiltered)}
              </span>

              {data.page < data.totalPages ? (
                <Link
                  className="secondary-button"
                  href={`/pipeline${queryString(filters, {
                    page: data.page + 1,
                  })}`}
                >
                  Siguiente →
                </Link>
              ) : (
                <span />
              )}
            </div>
          </>
        ) : (
          <EmptyState message="No hay opportunities que coincidan con los filtros." />
        )}
      </section>
    </DashboardLayout>
  );
}
