import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentAppUser = {
  id: string;
  authUserId: string;
  displayName: string;
  email: string | null;
  role: "advisor" | "admin" | "viewer";
  ghlUserId: string | null;
};

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function getCurrentAppUser(): Promise<CurrentAppUser | null> {
  if (!isSupabaseAuthConfigured()) {
    return {
      id: "basic-auth-fallback",
      authUserId: "basic-auth-fallback",
      displayName: "Administrador temporal",
      email: null,
      role: "admin",
      ghlUserId: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;

  if (error || !authUserId) {
    return null;
  }

  const admin = createSupabaseAdmin();
  const result = await admin
    .from("milhano_app_users")
    .select("id, auth_user_id, display_name, email, role, ghl_user_id, is_active")
    .eq("auth_user_id", authUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (result.error) {
    throw new Error(
      `No se pudo validar el acceso del usuario: ${result.error.message}`,
    );
  }

  if (!result.data) {
    return null;
  }

  return {
    id: result.data.id,
    authUserId: result.data.auth_user_id,
    displayName: result.data.display_name,
    email: result.data.email,
    role: result.data.role,
    ghlUserId: result.data.ghl_user_id,
  };
}

export async function requireCurrentAppUser(): Promise<CurrentAppUser> {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login?error=access");
    throw new Error("Acceso no autorizado.");
  }

  return user;
}
