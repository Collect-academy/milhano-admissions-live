import "server-only";

import { cookies } from "next/headers";

import type { Locale } from "@/lib/locale";

export async function getDashboardLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get("milhano_lang")?.value === "en" ? "en" : "es";
}
