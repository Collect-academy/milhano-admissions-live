import type { LucideIcon } from "lucide-react";

type KpiCardProps = {
  label: string;
  value: number | string;
  helper: string;
  icon: LucideIcon;
};

export function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
}: KpiCardProps) {
  return (
    <article className="kpi-card">
      <div className="kpi-icon">
        <Icon size={19} strokeWidth={1.8} />
      </div>
      <div>
        <p className="kpi-label">{label}</p>
        <p className="kpi-value">{value}</p>
        <p className="kpi-helper">{helper}</p>
      </div>
    </article>
  );
}
