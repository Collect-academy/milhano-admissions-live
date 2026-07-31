import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
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
  PipelineSummary,
  StaleOpportunity,
  SyncRun,
  WhatsAppDaily,
  WhatsAppDashboardData,
  WhatsAppSummary,
} from "@/lib/types";

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

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createSupabaseAdmin();

  const [
    pipelineResult,
    funnelResult,
    dailyResult,
    sourcesResult,
    ownersResult,
    exitsResult,
    staleResult,
    whatsappResult,
    callsResult,
    eodResult,
  ] = await Promise.all([
    supabase
      .from("vw_milhano_pipeline_summary_current")
      .select("*")
      .order("display_order"),
    supabase
      .from("vw_milhano_funnel_summary_standard")
      .select("*")
      .order("stage_order"),
    supabase
      .from("vw_milhano_daily_kpis")
      .select("*")
      .order("metric_date", { ascending: false })
      .limit(90),
    supabase
      .from("vw_milhano_source_performance")
      .select("*")
      .order("leads", { ascending: false })
      .limit(20),
    supabase
      .from("vw_milhano_owner_performance")
      .select("*")
      .order("leads", { ascending: false }),
    supabase
      .from("vw_milhano_exit_summary")
      .select("*")
      .order("opportunity_count", { ascending: false })
      .limit(30),
    supabase
      .from("vw_milhano_pipeline_current")
      .select(
        "ghl_opportunity_id, opportunity_name, student_name, current_stage, operational_owner, days_since_update, source",
      )
      .eq("status", "open")
      .order("days_since_update", { ascending: false, nullsFirst: false })
      .limit(15),
    supabase
      .from("vw_milhano_whatsapp_daily")
      .select("*")
      .order("activity_date", { ascending: false })
      .limit(1),
    supabase
      .from("vw_milhano_calls_daily")
      .select("*")
      .order("activity_date", { ascending: false })
      .limit(1),
    supabase
      .from("milhano_eod_team_snapshots")
      .select("*")
      .order("eod_date", { ascending: false })
      .limit(1),
  ]);

  const namedResults = [
    [pipelineResult, "Pipeline"],
    [funnelResult, "Funnel"],
    [dailyResult, "Actividad diaria"],
    [sourcesResult, "Fuentes"],
    [ownersResult, "Asesoras"],
    [exitsResult, "Salidas"],
    [staleResult, "Inactividad"],
    [whatsappResult, "WhatsApp"],
    [callsResult, "Llamadas"],
    [eodResult, "EOD"],
  ] as const;

  for (const [result, label] of namedResults) {
    assertResult(result, `Error consultando ${label}`);
  }

  return {
    pipeline: normalizeNumbers(
      pipelineResult.data,
    ) as unknown as PipelineSummary[],
    funnel: normalizeNumbers(
      funnelResult.data,
    ) as unknown as FunnelSummary[],
    daily: (
      normalizeNumbers(dailyResult.data) as unknown as DailyKpi[]
    ).reverse(),
    sources: normalizeNumbers(
      sourcesResult.data,
    ) as unknown as PerformanceRow[],
    owners: normalizeNumbers(
      ownersResult.data,
    ) as unknown as PerformanceRow[],
    exits: normalizeNumbers(
      exitsResult.data,
    ) as unknown as ExitSummary[],
    stale: normalizeNumbers(
      staleResult.data,
    ) as unknown as StaleOpportunity[],
    latestWhatsapp:
      (normalizeNumbers(
        whatsappResult.data,
      ) as unknown as WhatsAppDaily[])[0] ?? null,
    latestCalls:
      (normalizeNumbers(callsResult.data) as unknown as CallDaily[])[0] ?? null,
    latestEod: (eodResult.data as EodTeamSnapshot[] | null)?.[0] ?? null,
  };
}

export async function getWhatsAppDashboardData(): Promise<WhatsAppDashboardData> {
  const supabase = createSupabaseAdmin();

  const [dailyResult, summaryResult, eodResult] = await Promise.all([
    supabase
      .from("vw_milhano_whatsapp_daily")
      .select("*")
      .order("activity_date", { ascending: false })
      .limit(90),
    supabase.from("vw_milhano_whatsapp_channel_summary").select("*").limit(1),
    supabase
      .from("milhano_eod_team_snapshots")
      .select("*")
      .order("eod_date", { ascending: false })
      .limit(1),
  ]);

  assertResult(dailyResult, "Error consultando WhatsApp diario");
  assertResult(summaryResult, "Error consultando resumen de WhatsApp");
  assertResult(eodResult, "Error consultando EOD de WhatsApp");

  return {
    daily: (
      normalizeNumbers(dailyResult.data) as unknown as WhatsAppDaily[]
    ).reverse(),
    summary:
      (normalizeNumbers(
        summaryResult.data,
      ) as unknown as WhatsAppSummary[])[0] ?? null,
    latestEod: (eodResult.data as EodTeamSnapshot[] | null)?.[0] ?? null,
  };
}

export async function getCallsDashboardData(): Promise<CallsDashboardData> {
  const supabase = createSupabaseAdmin();

  const [dailyResult, byUserResult, outcomesResult] = await Promise.all([
    supabase
      .from("vw_milhano_calls_daily")
      .select("*")
      .order("activity_date", { ascending: false })
      .limit(90),
    supabase
      .from("vw_milhano_calls_daily_user")
      .select("*")
      .order("activity_date", { ascending: false })
      .limit(180),
    supabase
      .from("vw_milhano_call_outcome_bridge")
      .select("*")
      .order("call_timestamp", { ascending: false })
      .limit(100),
  ]);

  assertResult(dailyResult, "Error consultando llamadas diarias");
  assertResult(byUserResult, "Error consultando llamadas por asesora");
  assertResult(outcomesResult, "Error consultando outcomes de llamadas");

  return {
    daily: (
      normalizeNumbers(dailyResult.data) as unknown as CallDaily[]
    ).reverse(),
    byUser: normalizeNumbers(
      byUserResult.data,
    ) as unknown as CallDailyUser[],
    outcomes: normalizeNumbers(
      outcomesResult.data,
    ) as unknown as CallOutcome[],
  };
}

export async function getEodData(): Promise<EodData> {
  const supabase = createSupabaseAdmin();

  const [rowsResult, snapshotsResult, syncRunsResult] = await Promise.all([
    supabase
      .from("vw_milhano_eod_dashboard")
      .select("*")
      .order("eod_date", { ascending: false })
      .order("display_name")
      .order("display_order")
      .limit(300),
    supabase
      .from("milhano_eod_team_snapshots")
      .select("*")
      .order("eod_date", { ascending: false })
      .limit(30),
    supabase
      .from("milhano_sync_runs")
      .select("*")
      .in("sync_type", [
        "eod_snapshot",
        "message_reconciliation",
        "full_reconciliation",
      ])
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  assertResult(rowsResult, "Error consultando EOD individual");
  assertResult(snapshotsResult, "Error consultando EOD de equipo");
  assertResult(syncRunsResult, "Error consultando sincronizaciones");

  return {
    rows: normalizeNumbers(
      rowsResult.data,
    ) as unknown as EodDashboardRow[],
    snapshots: snapshotsResult.data as EodTeamSnapshot[],
    syncRuns: normalizeNumbers(
      syncRunsResult.data,
    ) as unknown as SyncRun[],
  };
}
