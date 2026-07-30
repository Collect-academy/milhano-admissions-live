import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  DailyKpi,
  DashboardData,
  ExitSummary,
  FunnelSummary,
  PerformanceRow,
  PipelineSummary,
  StaleOpportunity,
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
  ]);

  const results = [
    pipelineResult,
    funnelResult,
    dailyResult,
    sourcesResult,
    ownersResult,
    exitsResult,
    staleResult,
  ];

  const failed = results.find((result) => result.error);

  if (failed?.error) {
    throw new Error(`Error consultando Supabase: ${failed.error.message}`);
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
  };
}
