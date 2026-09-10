"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardRefreshButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function refresh() {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/v2/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "No se pudo actualizar.");
      }
      setState("ok");
      setMessage("Datos actualizados");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  }

  return (
    <div className="refresh-control">
      <button className="secondary-button refresh-button" disabled={state === "loading"} onClick={refresh} type="button">
        <RefreshCw className={state === "loading" ? "refresh-spin" : ""} size={16} />
        {state === "loading" ? "Actualizando…" : "Actualizar datos"}
      </button>
      {message ? <small className={state === "error" ? "refresh-message refresh-error" : "refresh-message"}>{message}</small> : null}
    </div>
  );
}
