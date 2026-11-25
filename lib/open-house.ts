import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentAppUser, isSupabaseAuthConfigured } from "@/lib/auth";
import { createHmac } from "node:crypto";

export async function oh(action: string, payload: Record<string, unknown> = {}, actor: string | null = null) {
  const { data, error } = await createSupabaseAdmin().rpc("milhano_oh_v1", { p_action: action, p_payload: payload, p_actor: actor });
  if (error) throw new Error("No se pudo completar la operación de Open House.");
  return data;
}
export async function openHouseActor() {
  if (!isSupabaseAuthConfigured()) return null;
  return getCurrentAppUser();
}
export function rateBucket(request: Request) {
  // Vercel overwrites x-vercel-forwarded-for; shared fallback is intentionally rate-limited.
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Configuración incompleta");
  return createHmac("sha256", key).update("open-house:" + ip).digest("hex");
}
