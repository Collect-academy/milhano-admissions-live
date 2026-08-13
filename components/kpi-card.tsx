import type { LucideIcon } from "lucide-react";

import { HelpTip } from "@/components/help-tip";
import { conceptDefinition } from "@/lib/concepts";
import type { Locale } from "@/lib/locale";

type KpiCardProps = {
  label: string;
  value: number | string;
  helper: string;
  icon: LucideIcon;
  definitionKey?: string;
  locale?: Locale;
};

export function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  definitionKey,
  locale = "en",
}: KpiCardProps) {
  const definition = definitionKey
    ? conceptDefinition(definitionKey, locale)
    : null;

  return (
    <article className="kpi-card">
      <div className="kpi-icon">
        <Icon size={19} strokeWidth={1.8} />
      </div>
      <div>
        <p className="kpi-label">
          {label} <HelpTip text={definition} />
        </p>
        <p className="kpi-value">{value}</p>
        <p className="kpi-helper">{helper}</p>
      </div>
    </article>
  );
}
