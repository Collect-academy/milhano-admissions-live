import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";

let cached: any = null;

export function as26Admin(): any {
  if (!cached) cached = createSupabaseAdmin();
  return cached;
}
