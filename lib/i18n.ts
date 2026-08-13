import "server-only";

import { cookies } from "next/headers";

import { getCurrentAppUser } from "@/lib/auth";
import type { Locale } from "@/lib/locale";

export async function getDashboardLocale(): Promise<Locale> {
  const user = await getCurrentAppUser();

  if (
    user?.username?.toLowerCase() === "monacashflow" ||
    user?.email?.toLowerCase() === "mona@coldem.edu.mx"
  ) {
    return "en";
  }

  const store = await cookies();
  return store.get("milhano_lang")?.value === "en" ? "en" : "es";
}
