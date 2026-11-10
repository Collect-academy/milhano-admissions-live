import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const SETTER_PIPELINE_ID = "GYqHbZyWUxxc3K03efVT";
export const CLOSER_PIPELINE_ID = "z1FEJfbtOHusjdwe40Ko";
export const ELIGIBLE_STAGES = [
  "New Lead",
  "No answer - Day 1",
  "No answer - Day 2",
  "No answer - Day 3",
  "Never Answered / Nurturing A",
] as const;

export type SofiaCandidate = {
  opportunityId: string;
  contactId: string;
  name: string;
  phoneLast4: string;
  stage: string;
  stageId: string | null;
  createdAt: string;
  origin: string | null;
  eligible: boolean;
  exclusion: string | null;
};

export type SofiaCampaign = {
  id: string;
  name: string;
  status: string;
  dry_run: boolean;
  concurrency_limit: number;
  created_at: string;
  selected: number;
  queued: number;
  in_flight: number;
  completed: number;
  review_needed: number;
  excluded: number;
  pilotVerified?: boolean;
  released?: number;
};

type DailyRow = {
  local_date: string;
  campaign_id: string | null;
  agent_version: string | null;
  calls_captured: number;
  human_answers: number;
  confirmed_no_answers: number;
  unresolved_connections: number;
  meaningful_conversations: number;
  qualified: number;
  booked_verified: number;
  disqualified: number;
  callback_requested: number;
  conversation_seconds: number | null;
  credits_consumed: number | null;
};
type HourlyRow = {
  local_weekday: number;
  local_hour: number;
  campaign_id: string | null;
  calls_captured: number;
  human_answers: number;
  meaningful_conversations: number;
  booked_verified: number;
};
export type SofiaCallRow = {
  conversation_id: string;
  campaign_id: string | null;
  started_at: string | null;
  connection_outcome: string;
  duration_seconds: number | null;
  meaningful_conversation: boolean | null;
  qualified: boolean | null;
  school_tour_booked_verified: boolean | null;
  disqualified: boolean | null;
  disqualified_reason: string | null;
  call_outcome: string | null;
  transcript_summary: string | null;
  credits_consumed: number | null;
  collected_variables: Record<string, unknown> | null;
  objections: unknown;
};
export type SofiaAnalytics = {
  daily: DailyRow[];
  hourly: HourlyRow[];
  calls: SofiaCallRow[];
  disqualificationReasons: { reason: string; cases: number }[];
  campaigns: SofiaCampaign[];
  firstCallLatencies: number[];
  objections: { category: string; cases: number }[];
  dispatchEnabled: boolean;
};

function ensure<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error("Sofía · " + label + ": " + result.error.message);
  return (result.data ?? []) as T;
}

export async function getSofiaAnalytics(): Promise<SofiaAnalytics> {
  const admin = createSupabaseAdmin();
  const [daily, hourly, calls, disqualified, campaigns, latencies, objections, campaignSettings, runtimeControl] = await Promise.all([
    admin.from("milhano_ai_dashboard_daily").select("*").order("local_date", { ascending: true }).limit(2000),
    admin.from("milhano_ai_dashboard_hourly").select("*").limit(2000),
    admin.from("milhano_ai_call_insights")
      .select("conversation_id,campaign_id,started_at,connection_outcome,duration_seconds,meaningful_conversation,qualified,school_tour_booked_verified,disqualified,disqualified_reason,call_outcome,transcript_summary,credits_consumed,collected_variables,objections")
      .order("started_at", { ascending: false, nullsFirst: false }).limit(70),
    admin.from("milhano_ai_dashboard_disqualification_reasons").select("*").order("cases", { ascending: false }).limit(100),
    admin.from("milhano_ai_dashboard_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("milhano_ai_dashboard_first_call_latency").select("hours_from_creation_to_first_ai_call").limit(2000),
    admin.from("milhano_ai_dashboard_objections").select("category,cases").limit(2000),
    admin.from("milhano_ai_campaigns").select("id,settings").limit(200),
    admin.from("milhano_ai_runtime_control").select("live_dispatch_enabled").eq("singleton",true).maybeSingle(),
  ]);

  return {
    daily: ensure(daily, "indicadores diarios") as DailyRow[],
    hourly: ensure(hourly, "indicadores por hora") as HourlyRow[],
    calls: ensure(calls, "llamadas") as SofiaCallRow[],
    disqualificationReasons: ensure(disqualified, "motivos de descalificación") as { reason: string; cases: number }[],
    campaigns: (ensure(campaigns, "campañas") as SofiaCampaign[]).map(c=> {
      const setting = (ensure(campaignSettings, "configuración de campañas") as {id:string;settings:Record<string,unknown>}[])
        .find(s=>s.id===c.id)?.settings;
      return {...c,pilotVerified:setting?.one_call_pilot_verified===true,
        released:Number(setting?.release_limit??0)};
    }),
    firstCallLatencies: (ensure(latencies, "tiempos") as {hours_from_creation_to_first_ai_call: number}[])
      .map(x=>Number(x.hours_from_creation_to_first_ai_call)).filter(x=>Number.isFinite(x)),
    objections: ensure(objections, "objeciones") as {category:string;cases:number}[],
    dispatchEnabled: (runtimeControl.data?.live_dispatch_enabled===true),
  };
}

export async function getSofiaCandidates(): Promise<SofiaCandidate[]> {
  const admin = createSupabaseAdmin();
  const [opportunities, assigned, closer, allSetter] = await Promise.all([
    admin.from("milhano_opportunities")
      .select("ghl_opportunity_id,ghl_contact_id,opportunity_name,contact_name,phone,current_stage,pipeline_stage_id,created_at,source,status")
      .eq("pipeline_id", SETTER_PIPELINE_ID)
      .eq("status", "open")
      .in("current_stage", [...ELIGIBLE_STAGES])
      .order("created_at", { ascending: true }).limit(2000),
    admin.from("milhano_ai_campaign_members")
      .select("ghl_contact_id,campaign_id,milhano_ai_campaigns!inner(status)")
      .in("status", ["queued", "claimed", "dispatched"])
      .in("milhano_ai_campaigns.status", ["draft", "scheduled", "running", "paused"])
      .limit(5000),
    admin.from("milhano_opportunities")
      .select("ghl_contact_id")
      .eq("pipeline_id", CLOSER_PIPELINE_ID)
      .eq("status", "open").limit(5000),
    admin.from("milhano_opportunities").select("ghl_contact_id")
      .eq("pipeline_id", SETTER_PIPELINE_ID).eq("status","open").limit(5000),
  ]);
  const opportunitiesData = ensure(opportunities, "candidatos") as Record<string, unknown>[];
  const assignedData = ensure(assigned, "reservados") as Record<string, unknown>[];
  const closerData = ensure(closer, "Closer") as Record<string, unknown>[];
  const setterData = ensure(allSetter, "duplicados Setter") as Record<string, unknown>[];

  const reserved = new Set(assignedData.map(x => String(x.ghl_contact_id ?? "")));
  const withCloser = new Set(closerData.map(x => String(x.ghl_contact_id ?? "")));
  const contactCount = new Map<string, number>();
  for (const o of setterData) {
    const contact = String(o.ghl_contact_id ?? "");
    contactCount.set(contact, (contactCount.get(contact) ?? 0) + 1);
  }
  return opportunitiesData.map(o => {
    const opportunityId = String(o.ghl_opportunity_id ?? "");
    const contactId = String(o.ghl_contact_id ?? "");
    const phone = String(o.phone ?? "");
    const stage = String(o.current_stage ?? "");
    // The explicitly requested QA opportunity shares a legacy test contact with
    // older Closer/Setter records. Do not relax duplicate checks for real leads.
    const verifiedTest = opportunityId === "4DAoiAeCm5WBc1VtkJFD" &&
      contactId === "FBZaamMSEDYI15g7LAjR";
    const exclusion = verifiedTest ? null : !contactId || !opportunityId || !phone.trim()
      ? "Datos de contacto incompletos"
      : (contactCount.get(contactId) ?? 0) > 1
        ? "Contacto con varias oportunidades abiertas"
        : withCloser.has(contactId) ? "Tiene oportunidad abierta en Closer"
          : reserved.has(contactId) ? "Ya pertenece a una campaña activa" : null;
    return {
      opportunityId,
      contactId,
      name: String(verifiedTest ? o.opportunity_name : (o.contact_name ?? o.opportunity_name ?? "Sin nombre")),
      phoneLast4: phone.slice(-4),
      stage,
      stageId: o.pipeline_stage_id ? String(o.pipeline_stage_id) : null,
      createdAt: String(o.created_at ?? ""),
      origin: o.source == null ? null : String(o.source),
      eligible: exclusion === null,
      exclusion,
    };
  });
}
