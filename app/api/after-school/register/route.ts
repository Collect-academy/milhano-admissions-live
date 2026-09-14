import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";

import { as26Admin } from "@/lib/after-school/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { data, error } = await as26Admin().rpc("as26_register_family", {
      p_payload: payload,
    });

    if (error) throw error;

    const hook = process.env.AS26_N8N_SYNC_WEBHOOK;
    if (hook && data?.registration_id) {
      const registrationId = data.registration_id;
      after(async () => {
        try {
          await fetch(hook, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ registration_id: registrationId }),
            cache: "no-store",
          });
        } catch (error) {
          console.error("AS26 n8n sync notification failed", error);
        }
      });
    }

    revalidateTag("as26-summary", "max");
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    const message = error?.message || "Registration failed";
    const status = String(message).includes("WORKSHOP_FULL") ? 409 : 400;
    return NextResponse.json(
      { ok: false, message },
      { status },
    );
  }
}
