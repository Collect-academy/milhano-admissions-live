"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Database, FilePenLine } from "lucide-react";

import { HelpTip } from "@/components/help-tip";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

export type SummarySource = "manual" | "ghl";

export function SummarySourceSwitcher({
  initialSource,
  locale,
  manual,
  ghl,
}: {
  initialSource: SummarySource;
  locale: Locale;
  manual: ReactNode;
  ghl: ReactNode;
}) {
  const [source, setSource] = useState<SummarySource>(initialSource);

  const choose = (next: SummarySource) => {
    setSource(next);
    document.cookie = `milhano_summary_source=${next}; path=/; max-age=31536000; samesite=lax`;

    const url = new URL(window.location.href);
    url.searchParams.set("source", next);
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
  };

  return (
    <>
      <section className="summary-source-shell">
        <div className="summary-source-copy">
          <strong>
            {tr(locale, "Summary source", "Fuente del resumen")} {" "}
            <HelpTip
              text={tr(
                locale,
                "Manual shows submitted/validated advisor EOD totals. GHL shows only automated CRM/System evidence. Switching here is instant and does not change stored data.",
                "Manual muestra EOD enviados/validados. GHL muestra solo evidencia automática CRM/System. Cambiar aquí es instantáneo y no modifica datos guardados.",
              )}
            />
          </strong>
          <span>
            {source === "manual"
              ? tr(locale, "Showing advisor-reported EOD totals.", "Mostrando totales reportados por la asesora en EOD.")
              : tr(locale, "Showing automated GHL/System counts.", "Mostrando conteos automáticos GHL/System.")}
          </span>
        </div>

        <div className="summary-source-toggle" role="group" aria-label={tr(locale, "Summary source", "Fuente del resumen")}>
          <button
            className={source === "manual" ? "summary-source-option summary-source-option-active" : "summary-source-option"}
            onClick={() => choose("manual")}
            type="button"
          >
            <FilePenLine size={16} /> {tr(locale, "Manual (EOD)", "Manual (EOD)")}
          </button>
          <button
            className={source === "ghl" ? "summary-source-option summary-source-option-active" : "summary-source-option"}
            onClick={() => choose("ghl")}
            type="button"
          >
            <Database size={16} /> GHL
          </button>
        </div>
      </section>

      <div hidden={source !== "manual"}>{manual}</div>
      <div hidden={source !== "ghl"}>{ghl}</div>
    </>
  );
}
