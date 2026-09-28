import "server-only";

import { redirect } from "next/navigation";
import { requireAdmissionsAppUser, type CurrentAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export function hasLeadershipViewAccess(user: CurrentAppUser): boolean {
  if (user.role === "admin") return true;
  return /thierry|cinthia/i.test(`${user.username ?? ""} ${user.email ?? ""} ${user.displayName}`);
}

export async function requireLeadershipViewAccess(): Promise<CurrentAppUser> {
  const user = await requireAdmissionsAppUser();
  if (!hasLeadershipViewAccess(user)) redirect("/?error=leadership-access");
  return user;
}

export type LeadershipKpi = { kpi_key: string; label_es: string; school_cycle: string | null; value: number; sort_order: number; source: string };

export async function getLeadershipKpis(): Promise<LeadershipKpi[]> {
  await requireLeadershipViewAccess();
  const admin = createSupabaseAdmin();
  const result = await admin
    .from("milhano_leadership_kpis")
    .select("kpi_key,label_es,school_cycle,value,sort_order,source")
    .order("sort_order", { ascending: true });
  if (result.error) throw new Error(`No se pudieron cargar los KPIs de Dirección: ${result.error.message}`);
  return (result.data ?? []) as LeadershipKpi[];
}
