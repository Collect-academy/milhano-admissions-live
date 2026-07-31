import "server-only";

import { canonicalAdvisorName } from "@/lib/identity";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  dateInRange,
  rangeEndExclusiveTimestamp,
  rangeStartTimestamp,
  type DateRange,
} from "@/lib/date-range";
import type {
  CallDaily,
  CallDailyUser,
  CallOutcome,
  CallsDashboardData,
  DailyKpi,
  DashboardData,
  EodDashboardRow,
  EodData,
  EodTeamSnapshot,
  ExitSummary,
  FunnelSummary,
  PerformanceRow,
  PipelineFilters,
  PipelineOperationalData,
  PipelineOpportunity,
  PipelineSummary,
  StaleOpportunity,
  SyncRun,
  WhatsAppBackfillStatus,
  WhatsAppDaily,
  WhatsAppDashboardData,
  WhatsAppSummary,
} from "@/lib/types";

type OpportunityRow = {
  ghl_opportunity_id: string;
  opportunity_name: string;
  student_name: string | null;
  current_stage: string;
  status: string;
  source: string | null;
  assigned_user: string | null;
  assigned_user_id: string | null;
  historical_advisor: string | null;
  admission_route: string | null;
  no_fit_reason: string | null;
  lost_reason: string | null;
  original_lead_date: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type StageEventRow = {
  event_id: string;
  ghl_opportunity_id: string;
  from_stage: string | null;
  to_stage: string;
  event_timestamp: string;
  is_valid: boolean;
};

type CohortRow = OpportunityRow & {
  operational_owner: string;
  lead_date: string | null;
  reached: Set<string>;
};

const STAGES = [
  ["Cliente potencial", 1, "Entrada"],
  ["No responde / Seguimiento", 2, "Seguimiento"],
  ["No fit", 3, "Salida"],
  ["Lost / Sin continuidad", 4, "Salida"],
  ["Fit", 5, "Hito"],
  ["School Tour agendado", 6, "Hito"],
  ["School Tour atendido", 7, "Hito"],
  ["Pasadía agendada", 8, "Hito"],
  ["Pasadía asistida", 9, "Hito"],
  ["Retroalimentación", 10, "Hito"],
  ["En evaluación", 11, "Hito"],
  ["Inscripción en proceso", 12, "Hito"],
  ["Inscrito", 13, "Resultado"],
] as const;

const FUNNEL_STAGES = [
  "Cliente potencial",
  "Fit",
  "School Tour agendado",
  "School Tour atendido",
  "Pasadía agendada",
  "Pasadía asistida",
  "Retroalimentación",
  "En evaluación",
  "Inscripción en proceso",
  "Inscrito",
] as const;

function normalizeNumbers<T extends Record<string, unknown>>(
  rows: T[] | null,
): T[] {
  if (!rows) return [];

  return rows.map((row) => {
    const normalized = { ...row };

    for (const [key, value] of Object.entries(normalized)) {
      if (
        typeof value === "string" &&
        value.trim() !== "" &&
        /^-?\d+(\.\d+)?$/.test(value)
      ) {
        normalized[key as keyof T] = Number(value) as T[keyof T];
      }
    }

    return normalized;
  });
}

function assertResult(
  result: { error: { message: string } | null },
  label: string,
): void {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
}

function ownerName(row: OpportunityRow): string {
  return canonicalAdvisorName(
    row.assigned_user?.trim() ||
      row.historical_advisor?.trim() ||
      "Sin asignar",
  );
}

function dateOnly(
  value: string | null | undefined,
): string | null {
  return value ? value.slice(0, 10) : null;
}

function opportunityLeadDate(
  opportunity: OpportunityRow,
  events: StageEventRow[],
): string | null {
  const leadEvent = events
    .filter((event) => event.to_stage === "Cliente potencial")
    .sort((a, b) =>
      a.event_timestamp.localeCompare(b.event_timestamp),
    )[0];

  return (
    dateOnly(leadEvent?.event_timestamp) ??
    dateOnly(opportunity.original_lead_date) ??
    dateOnly(opportunity.created_at)
  );
}

function daysSince(
  value: string | null,
): number | null {
  if (!value) return null;

  const current = new Date();
  const target = new Date(value);
  const difference = current.getTime() - target.getTime();

  if (Number.isNaN(difference)) return null;

  return Math.max(0, Math.floor(difference / 86_400_000));
}

function buildPipelineSummary(
  rows: OpportunityRow[],
): PipelineSummary[] {
  return STAGES.map(([stageName, displayOrder, stageGroup]) => {
    const stageRows = rows.filter(
      (row) => row.current_stage === stageName,
    );

    return {
      display_order: displayOrder,
      stage_name: stageName,
      stage_group: stageGroup,
      opportunity_count: stageRows.length,
      open_count: stageRows.filter(
        (row) => row.status.toLowerCase() === "open",
      ).length,
      won_count: stageRows.filter(
        (row) => row.status.toLowerCase() === "won",
      ).length,
      lost_count: stageRows.filter(
        (row) => row.status.toLowerCase() === "lost",
      ).length,
      open_8_plus_days: stageRows.filter((row) => {
        const days = daysSince(row.updated_at);
        return (
          row.status.toLowerCase() === "open" &&
          days !== null &&
          days >= 8
        );
      }).length,
    };
  });
}

function buildFunnelSummary(
  rows: CohortRow[],
): FunnelSummary[] {
  const standard = rows.filter(
    (row) => row.admission_route !== "Ingreso directo",
  );

  const counts = FUNNEL_STAGES.map((stage) =>
    standard.filter((row) => row.reached.has(stage)).length,
  );
  const leadCount = counts[0] ?? 0;

  return FUNNEL_STAGES.map((stage, index) => {
    const reached = counts[index] ?? 0;
    const previous = index > 0 ? counts[index - 1] ?? 0 : null;

    return {
      stage_order: index + 1,
      stage_name: stage,
      reached_count: reached,
      previous_stage_reached_count: previous,
      conversion_from_previous_pct:
        previous === null
          ? 100
          : previous === 0
            ? null
            : (reached / previous) * 100,
      conversion_from_lead_pct:
        leadCount === 0
          ? null
          : (reached / leadCount) * 100,
    };
  });
}

function buildPerformance(
  rows: CohortRow[],
  groupKey: "source" | "owner",
): PerformanceRow[] {
  const standard = rows.filter(
    (row) => row.admission_route !== "Ingreso directo",
  );
  const groups = new Map<string, CohortRow[]>();

  for (const row of standard) {
    const key =
      groupKey === "source"
        ? row.source?.trim() || "Sin fuente"
        : row.operational_owner;

    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const count = (stage: string) =>
        group.filter((row) => row.reached.has(stage)).length;
      const leads = count("Cliente potencial");
      const fits = count("Fit");
      const enrolled = count("Inscrito");

      return {
        ...(groupKey === "source"
          ? { source: key }
          : { operational_owner: key }),
        leads,
        fits,
        tours_scheduled: count("School Tour agendado"),
        tours_attended: count("School Tour atendido"),
        passdays_scheduled: count("Pasadía agendada"),
        passdays_attended: count("Pasadía asistida"),
        enrollment_process_started: count(
          "Inscripción en proceso",
        ),
        enrolled,
        lead_to_fit_pct:
          leads > 0 ? (fits / leads) * 100 : null,
        lead_to_enrolled_pct:
          leads > 0 ? (enrolled / leads) * 100 : null,
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

function buildExitSummary(
  opportunities: OpportunityRow[],
  events: StageEventRow[],
  range: DateRange,
): ExitSummary[] {
  const byOpportunity = new Map(
    opportunities.map((row) => [
      row.ghl_opportunity_id,
      row,
    ]),
  );
  const groups = new Map<string, ExitSummary>();

  const exitEvents = events.filter(
    (event) =>
      ["No fit", "Lost / Sin continuidad"].includes(
        event.to_stage,
      ) &&
      dateInRange(event.event_timestamp, range),
  );

  for (const event of exitEvents) {
    const opportunity = byOpportunity.get(
      event.ghl_opportunity_id,
    );
    const reason =
      event.to_stage === "No fit"
        ? opportunity?.no_fit_reason
        : opportunity?.lost_reason;
    const exitFrom = event.from_stage || "Etapa no reconstruida";
    const exitReason = reason?.trim() || "Sin motivo especificado";
    const key = `${event.to_stage}|${exitFrom}|${exitReason}`;
    const existing = groups.get(key);

    groups.set(key, {
      exit_type: event.to_stage,
      exit_from_stage: exitFrom,
      exit_reason: exitReason,
      opportunity_count:
        (existing?.opportunity_count ?? 0) + 1,
    });
  }

  return [...groups.values()].sort(
    (a, b) => b.opportunity_count - a.opportunity_count,
  );
}

function sumDaily<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): number {
  return rows.reduce(
    (total, row) => total + Number(row[key] ?? 0),
    0,
  );
}

export async function getDashboardData(
  range: DateRange,
): Promise<DashboardData> {
  const supabase = createSupabaseAdmin();

  const [
    opportunitiesResult,
    eventsResult,
    dailyResult,
    whatsappResult,
    callsResult,
    eodResult,
  ] = await Promise.all([
    supabase
      .from("milhano_opportunities")
      .select(
        "ghl_opportunity_id, opportunity_name, student_name, current_stage, status, source, assigned_user, assigned_user_id, historical_advisor, admission_route, no_fit_reason, lost_reason, original_lead_date, created_at, updated_at",
      )
      .limit(2000),
    supabase
      .from("milhano_stage_events")
      .select(
        "event_id, ghl_opportunity_id, from_stage, to_stage, event_timestamp, is_valid",
      )
      .eq("is_valid", true)
      .limit(5000),
    supabase
      .from("vw_milhano_daily_kpis")
      .select("*")
      .gte("metric_date", range.start)
      .lte("metric_date", range.end)
      .order("metric_date"),
    supabase
      .from("vw_milhano_whatsapp_daily")
      .select("*")
      .gte("activity_date", range.start)
      .lte("activity_date", range.end)
      .order("activity_date"),
    supabase
      .from("vw_milhano_calls_daily")
      .select("*")
      .gte("activity_date", range.start)
      .lte("activity_date", range.end)
      .order("activity_date"),
    supabase
      .from("milhano_eod_team_snapshots")
      .select("*")
      .order("eod_date", { ascending: false })
      .limit(1),
  ]);

  const results = [
    [opportunitiesResult, "Opportunities"],
    [eventsResult, "Eventos de stage"],
    [dailyResult, "Actividad diaria"],
    [whatsappResult, "WhatsApp"],
    [callsResult, "Llamadas"],
    [eodResult, "EOD"],
  ] as const;

  for (const [result, label] of results) {
    assertResult(result, `Error consultando ${label}`);
  }

  const opportunities =
    opportunitiesResult.data as OpportunityRow[];
  const events = eventsResult.data as StageEventRow[];
  const eventsByOpportunity = new Map<string, StageEventRow[]>();

  for (const event of events) {
    const current =
      eventsByOpportunity.get(event.ghl_opportunity_id) ?? [];
    current.push(event);
    eventsByOpportunity.set(event.ghl_opportunity_id, current);
  }

  const cohortRows: CohortRow[] = opportunities
    .map((opportunity) => {
      const opportunityEvents =
        eventsByOpportunity.get(
          opportunity.ghl_opportunity_id,
        ) ?? [];

      return {
        ...opportunity,
        operational_owner: ownerName(opportunity),
        lead_date: opportunityLeadDate(
          opportunity,
          opportunityEvents,
        ),
        reached: new Set(
          opportunityEvents.map((event) => event.to_stage),
        ),
      };
    })
    .filter((row) => dateInRange(row.lead_date, range));

  const cohortOpportunities: OpportunityRow[] = cohortRows;
  const daily = normalizeNumbers(
    dailyResult.data,
  ) as unknown as DailyKpi[];
  const whatsapp = normalizeNumbers(
    whatsappResult.data,
  ) as unknown as WhatsAppDaily[];
  const calls = normalizeNumbers(
    callsResult.data,
  ) as unknown as CallDaily[];

  const stale: StaleOpportunity[] = cohortRows
    .filter((row) => row.status.toLowerCase() === "open")
    .map((row) => ({
      ghl_opportunity_id: row.ghl_opportunity_id,
      opportunity_name: row.opportunity_name,
      student_name: row.student_name,
      current_stage: row.current_stage,
      operational_owner: row.operational_owner,
      days_since_update: daysSince(row.updated_at),
      source: row.source,
    }))
    .sort(
      (a, b) =>
        (b.days_since_update ?? -1) -
        (a.days_since_update ?? -1),
    )
    .slice(0, 15);

  return {
    pipeline: buildPipelineSummary(cohortOpportunities),
    funnel: buildFunnelSummary(cohortRows),
    daily,
    sources: buildPerformance(cohortRows, "source"),
    owners: buildPerformance(cohortRows, "owner"),
    exits: buildExitSummary(opportunities, events, range),
    stale,
    latestWhatsapp: whatsapp.at(-1) ?? null,
    latestCalls: calls.at(-1) ?? null,
    latestEod:
      (eodResult.data as EodTeamSnapshot[] | null)?.[0] ?? null,
    period: {
      new_leads: sumDaily(daily, "new_leads"),
      fits: sumDaily(daily, "fits"),
      tours_scheduled: sumDaily(daily, "tours_scheduled"),
      tours_attended: sumDaily(daily, "tours_attended"),
      enrolled: sumDaily(daily, "enrolled"),
      whatsapp_messages: sumDaily(
        whatsapp,
        "total_messages",
      ),
      whatsapp_conversations_daily_sum: sumDaily(
        whatsapp,
        "active_conversations",
      ),
      call_attempts: sumDaily(
        calls,
        "total_call_attempts",
      ),
      outbound_call_attempts: sumDaily(
        calls,
        "outbound_attempts",
      ),
    },
  };
}

export async function getWhatsAppDashboardData(
  range: DateRange,
): Promise<WhatsAppDashboardData> {
  const supabase = createSupabaseAdmin();

  const [dailyResult, summaryResult, eodResult, backfillResult] =
    await Promise.all([
      supabase
        .from("vw_milhano_whatsapp_daily")
        .select("*")
        .gte("activity_date", range.start)
        .lte("activity_date", range.end)
        .order("activity_date"),
      supabase
        .from("vw_milhano_whatsapp_channel_summary")
        .select("*")
        .limit(1),
      supabase
        .from("milhano_eod_team_snapshots")
        .select("*")
        .order("eod_date", { ascending: false })
        .limit(1),
      supabase
        .from("vw_milhano_whatsapp_backfill_status")
        .select("*")
        .limit(1),
    ]);

  assertResult(dailyResult, "Error consultando WhatsApp diario");
  assertResult(summaryResult, "Error consultando resumen de WhatsApp");
  assertResult(eodResult, "Error consultando EOD de WhatsApp");
  assertResult(backfillResult, "Error consultando backfill de WhatsApp");

  return {
    daily: normalizeNumbers(
      dailyResult.data,
    ) as unknown as WhatsAppDaily[],
    summary:
      (normalizeNumbers(
        summaryResult.data,
      ) as unknown as WhatsAppSummary[])[0] ?? null,
    latestEod:
      (eodResult.data as EodTeamSnapshot[] | null)?.[0] ?? null,
    backfill:
      (normalizeNumbers(
        backfillResult.data,
      ) as unknown as WhatsAppBackfillStatus[])[0] ?? null,
  };
}

export async function getCallsDashboardData(
  range: DateRange,
): Promise<CallsDashboardData> {
  const supabase = createSupabaseAdmin();

  const [dailyResult, byUserResult, outcomesResult] =
    await Promise.all([
      supabase
        .from("vw_milhano_calls_daily")
        .select("*")
        .gte("activity_date", range.start)
        .lte("activity_date", range.end)
        .order("activity_date"),
      supabase
        .from("vw_milhano_calls_daily_user")
        .select("*")
        .gte("activity_date", range.start)
        .lte("activity_date", range.end)
        .order("activity_date"),
      supabase
        .from("vw_milhano_call_outcome_bridge")
        .select("*")
        .gte("call_timestamp", rangeStartTimestamp(range))
        .lt(
          "call_timestamp",
          rangeEndExclusiveTimestamp(range),
        )
        .order("call_timestamp", { ascending: false })
        .limit(1000),
    ]);

  assertResult(dailyResult, "Error consultando llamadas diarias");
  assertResult(byUserResult, "Error consultando llamadas por asesora");
  assertResult(outcomesResult, "Error consultando outcomes de llamadas");

  return {
    daily: normalizeNumbers(
      dailyResult.data,
    ) as unknown as CallDaily[],
    byUser: (
      normalizeNumbers(
        byUserResult.data,
      ) as unknown as CallDailyUser[]
    ).map((row) => ({
      ...row,
      advisor_name: canonicalAdvisorName(
        row.advisor_name,
      ),
    })),
    outcomes: normalizeNumbers(
      outcomesResult.data,
    ) as unknown as CallOutcome[],
  };
}

export async function getEodData(
  range: DateRange,
): Promise<EodData> {
  const supabase = createSupabaseAdmin();

  const [rowsResult, snapshotsResult, syncRunsResult] =
    await Promise.all([
      supabase
        .from("vw_milhano_eod_dashboard")
        .select("*")
        .gte("eod_date", range.start)
        .lte("eod_date", range.end)
        .order("eod_date", { ascending: false })
        .order("display_name")
        .order("display_order")
        .limit(2000),
      supabase
        .from("milhano_eod_team_snapshots")
        .select("*")
        .gte("eod_date", range.start)
        .lte("eod_date", range.end)
        .order("eod_date", { ascending: false })
        .limit(400),
      supabase
        .from("milhano_sync_runs")
        .select("*")
        .in("sync_type", [
          "eod_snapshot",
          "message_reconciliation",
          "full_reconciliation",
        ])
        .gte("started_at", rangeStartTimestamp(range))
        .lt(
          "started_at",
          rangeEndExclusiveTimestamp(range),
        )
        .order("started_at", { ascending: false })
        .limit(200),
    ]);

  assertResult(rowsResult, "Error consultando EOD individual");
  assertResult(snapshotsResult, "Error consultando EOD de equipo");
  assertResult(syncRunsResult, "Error consultando sincronizaciones");

  return {
    rows: normalizeNumbers(
      rowsResult.data,
    ) as unknown as EodDashboardRow[],
    snapshots:
      snapshotsResult.data as EodTeamSnapshot[],
    syncRuns: normalizeNumbers(
      syncRunsResult.data,
    ) as unknown as SyncRun[],
  };
}

const PIPELINE_PAGE_SIZE = 50;

function uniqueSorted(
  values: Array<string | null | undefined>,
): string[] {
  return [
    ...new Set(
      values.filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));
}

function normalizeFilter(
  value: string | undefined,
): string {
  return value?.trim().toLocaleLowerCase("es") ?? "";
}

export async function getPipelineOperationalData(
  filters: PipelineFilters,
  range: DateRange,
  paginate = true,
): Promise<PipelineOperationalData> {
  const supabase = createSupabaseAdmin();

  const result = await supabase
    .from("vw_milhano_pipeline_current")
    .select(
      "ghl_opportunity_id, opportunity_name, contact_name, student_name, phone, email, source, current_stage, status, operational_owner, created_at, original_lead_date, updated_at, days_since_update, inactivity_bucket, grade_interest, level, school_cycle, priority",
    )
    .order("stage_display_order")
    .order("days_since_update", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(2000);

  assertResult(result, "Error consultando detalle del pipeline");

  const allRows = (
    normalizeNumbers(
      result.data,
    ) as unknown as PipelineOpportunity[]
  )
    .filter((row) =>
      dateInRange(
        row.original_lead_date || row.created_at,
        range,
      ),
    )
    .map((row) => ({
      ...row,
      operational_owner: canonicalAdvisorName(
        row.operational_owner,
      ),
    }));

  const query = normalizeFilter(filters.q);
  const stage = normalizeFilter(filters.stage);
  const owner = normalizeFilter(filters.owner);
  const source = normalizeFilter(filters.source);
  const status = normalizeFilter(filters.status);
  const inactivity = normalizeFilter(filters.inactivity);

  const filteredRows = allRows.filter((row) => {
    if (
      stage &&
      normalizeFilter(row.current_stage) !== stage
    ) {
      return false;
    }

    if (
      owner &&
      normalizeFilter(row.operational_owner) !== owner
    ) {
      return false;
    }

    if (
      source &&
      normalizeFilter(row.source ?? "Sin fuente") !== source
    ) {
      return false;
    }

    if (
      status &&
      normalizeFilter(row.status) !== status
    ) {
      return false;
    }

    if (
      inactivity &&
      normalizeFilter(
        row.inactivity_bucket ?? "Sin fecha",
      ) !== inactivity
    ) {
      return false;
    }

    if (query) {
      const searchable = [
        row.opportunity_name,
        row.contact_name,
        row.student_name,
        row.phone,
        row.email,
        row.source,
        row.current_stage,
        row.operational_owner,
        row.grade_interest,
        row.level,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");

      if (!searchable.includes(query)) {
        return false;
      }
    }

    return true;
  });

  const requestedPage = Math.max(
    1,
    Number(filters.page ?? 1) || 1,
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / PIPELINE_PAGE_SIZE),
  );
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * PIPELINE_PAGE_SIZE;

  return {
    rows: paginate
      ? filteredRows.slice(
          start,
          start + PIPELINE_PAGE_SIZE,
        )
      : filteredRows,
    totalFiltered: filteredRows.length,
    totalRows: allRows.length,
    page,
    pageSize: paginate
      ? PIPELINE_PAGE_SIZE
      : filteredRows.length,
    totalPages,
    stages: uniqueSorted(
      allRows.map((row) => row.current_stage),
    ),
    owners: uniqueSorted(
      allRows.map((row) => row.operational_owner),
    ),
    sources: uniqueSorted(
      allRows.map((row) => row.source ?? "Sin fuente"),
    ),
    statuses: uniqueSorted(
      allRows.map((row) => row.status),
    ),
    inactivityBuckets: uniqueSorted(
      allRows.map(
        (row) => row.inactivity_bucket ?? "Sin fecha",
      ),
    ),
  };
}
