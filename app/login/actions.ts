"use server";

import { redirect } from "next/navigation";

import { isSupabaseAuthConfigured } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  return value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export async function login(formData: FormData) {
  if (!isSupabaseAuthConfigured()) {
    redirect("/login?error=not-configured");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    redirect(`/login?error=missing&next=${encodeURIComponent(next)}`);
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
