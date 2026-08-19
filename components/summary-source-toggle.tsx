import Link from "next/link";
import { Database, FilePenLine } from "lucide-react";

import { HelpTip } from "@/components/help-tip";
import { dateRangeParams, type DateRange } from "@/lib/date-range";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

export type SummarySource = "manual" | "ghl";

export function SummarySourceToggle({
  source,
  range,
  locale,
}: {
  source: SummarySource;
  range: DateRange;
  locale: Locale;
}) {
  const href = (next: SummarySource) => {
    const params = new URLSearchParams({
      ...dateRangeParams(range),
      source: next,
    });
    return `/?${params.toString()}`;
  };

  return (
    <section className="summary-source-shell">
      <div className="summary-source-copy">
        <strong>
          {tr(locale, "Summary source", "Fuente del resumen")} {" "}
          <HelpTip
            text={tr(
              locale,
              "Manual shows totals entered in submitted/validated EODs. GHL shows only what the automated CRM data layer can prove. Switching views does not change stored data.",
              "Manual muestra los totales capturados en EOD enviados/validados. GHL muestra solo lo que la capa automática del CRM puede demostrar. Cambiar la vista no modifica ningún dato guardado.",
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
        <Link className={source === "manual" ? "summary-source-option summary-source-option-active" : "summary-source-option"} href={href("manual")}>
          <FilePenLine size={16} /> {tr(locale, "Manual (EOD)", "Manual (EOD)")}
        </Link>
        <Link className={source === "ghl" ? "summary-source-option summary-source-option-active" : "summary-source-option"} href={href("ghl")}>
          <Database size={16} /> GHL
        </Link>
      </div>
    </section>
  );
}
