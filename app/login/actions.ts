"use server";

import { redirect } from "next/navigation";

import { isSupabaseAuthConfigured } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  return value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

async function resolveEmail(identifier: string): Promise<string | null> {
  const normalized = identifier.trim();

  if (normalized.includes("@")) {
    return normalized.toLowerCase();
  }

  const admin = createSupabaseAdmin();
  const result = await admin
    .from("milhano_app_users")
    .select("email")
    .eq("username", normalized)
    .eq("is_active", true)
    .maybeSingle();

  if (result.error || !result.data?.email) {
    return null;
  }

  return result.data.email;
}

export async function login(formData: FormData) {
  if (!isSupabaseAuthConfigured()) {
    redirect("/login?error=not-configured");
  }

  const identifier = String(
    formData.get("identifier") ?? "",
  ).trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!identifier || !password) {
    redirect(`/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  const email = await resolveEmail(identifier);

  if (!email) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export async function logout() {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
