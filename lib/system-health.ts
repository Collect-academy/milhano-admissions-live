import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type SystemHealthRow = {
  component_key: string;
  component_label: string;
  status:
    | "healthy"
    | "warning"
    | "error"
    | "pending"
    | "unknown";
  last_success_at: string | null;
  age_minutes: number | null;
  details: Record<string, unknown>;
  last_checked_at: string;
};

export type DataQualityRow = {
  check_key: string;
  check_label: string;
  status: "pass" | "warning" | "error" | "info";
  issue_count: number;
  details: Record<string, unknown>;
  last_checked_at: string;
};

export type SystemHealthData = {
  health: SystemHealthRow[];
  quality: DataQualityRow[];
  overallStatus:
    | "healthy"
    | "warning"
    | "error"
    | "pending";
};

function overallStatus(
  health: SystemHealthRow[],
  quality: DataQualityRow[],
): SystemHealthData["overallStatus"] {
  if (
    health.some((row) => row.status === "error") ||
    quality.some((row) => row.status === "error")
  ) {
    return "error";
  }

  if (
    health.some(
      (row) =>
        row.status === "warning" ||
        row.status === "unknown",
    ) ||
    quality.some((row) => row.status === "warning")
  ) {
    return "warning";
  }

  if (health.some((row) => row.status === "pending")) {
    return "pending";
  }

  return "healthy";
}

export async function getSystemHealthData(): Promise<SystemHealthData> {
  const supabase = createSupabaseAdmin();

  const [healthResult, qualityResult] = await Promise.all([
    supabase.from("vw_milhano_system_health").select("*"),
    supabase.from("vw_milhano_data_quality").select("*"),
  ]);

  if (healthResult.error) {
    throw new Error(
      `Unable to read system health: ${healthResult.error.message}`,
    );
  }

  if (qualityResult.error) {
    throw new Error(
      `Unable to read data quality: ${qualityResult.error.message}`,
    );
  }

  const health = (healthResult.data ?? []) as SystemHealthRow[];
  const quality = (qualityResult.data ?? []) as DataQualityRow[];

  return {
    health,
    quality,
    overallStatus: overallStatus(health, quality),
  };
}
