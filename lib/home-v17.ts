import "server-only";

import { unstable_cache } from "next/cache";

import type { OperationalCascadeMetric } from "@/lib/cascade";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  DailyKpi,
  ExitSummary,
  PerformanceRow,
  PipelineSummary,
  StaleOpportunity,
} from "@/lib/types";
import type { ManualEodTotals } from "@/lib/eod-manual";
import type { ManualLevelTotals } from "@/lib/eod-tours";
import type { SystemHealthRow, DataQualityRow, SystemHealthData } from "@/lib/system-health";

export type FunnelTransitionRate = {
  from_metric_key: string;
  to_metric_key: string;
  cohort_leads: number;
  from_reached: number;
  to_reached: number;
  conversion_pct: number | null;
};

export type HomeDashboardDataV17 = {
  pipeline: PipelineSummary[];
  daily: DailyKpi[];
  sources: PerformanceRow[];
  owners: PerformanceRow[];
  exits: ExitSummary[];
  stale: StaleOpportunity[];
  period: {
    new_leads: number;
    fits: number;
    tours_scheduled: number;
    tours_attended: number;
    enrolled: number;
    whatsapp_messages: number;
    whatsapp_conversations_daily_sum: number;
    call_attempts: number;
    outbound_call_attempts: number;
  };
};

export type HomePayloadV17 = {
  dashboard: HomeDashboardDataV17;
  reconciliation: OperationalCascadeMetric[];
  manualTotals: ManualEodTotals;
  manualLevelTotals: ManualLevelTotals;
  transitionRates: FunnelTransitionRate[];
  health: SystemHealthRow[];
  quality: DataQualityRow[];
};

function normalizeNumericValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeNumericValues(item));
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      next[key] = normalizeNumericValues(item);
    }
    return next;
  }

  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

async function loadHomePayload(start: string, end: string): Promise<HomePayloadV17> {
  const supabase = createSupabaseAdmin();
  const result = await supabase.rpc("milhano_get_home_payload_v17", {
    p_start: start,
    p_end: end,
  });

  if (result.error) {
    throw new Error(`Unable to load V17 home payload: ${result.error.message}`);
  }

  return normalizeNumericValues(result.data) as HomePayloadV17;
}

const cachedHomePayload = unstable_cache(
  loadHomePayload,
  ["milhano-home-v17"],
  { revalidate: 60 },
);

export async function getHomePayloadV17(start: string, end: string): Promise<HomePayloadV17> {
  return cachedHomePayload(start, end);
}

export function healthFromPayload(payload: HomePayloadV17): SystemHealthData {
  const health = payload.health ?? [];
  const quality = payload.quality ?? [];

  let overallStatus: SystemHealthData["overallStatus"] = "healthy";
  if (
    health.some((row) => row.status === "error") ||
    quality.some((row) => row.status === "error")
  ) {
    overallStatus = "error";
  } else if (
    health.some((row) => ["warning", "unknown"].includes(row.status)) ||
    quality.some((row) => row.status === "warning")
  ) {
    overallStatus = "warning";
  } else if (health.some((row) => row.status === "pending")) {
    overallStatus = "pending";
  }

  return { health, quality, overallStatus };
}
