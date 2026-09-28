import { CalendarCheck2, RefreshCw, School, UserPlus, UsersRound } from "lucide-react";

import { AdmissionsV2Cascade } from "@/components/admissions-v2-cascade";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ConversionRates } from "@/components/conversion-rates";
import { DateRangeFilter } from "@/components/date-range-filter";
import { KpiCard } from "@/components/kpi-card";
import { V2CurrentStages } from "@/components/v2-current-stages";
import { clampV2Range, getAdmissionsV2Payload } from "@/lib/admissions-v2";
import { resolveDateRange, type DateRange } from "@/lib/date-range";
import { dateLabel, number } from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { getLeadershipKpis, requireLeadershipViewAccess } from "@/lib/leadership";
import { tr } from "@/lib/locale";

export const dynamic = "force-dynamic";
type SearchParams = Record<string, string | string[] | undefined>;
const icons = [UserPlus, RefreshCw, UsersRound, School];

export default async function LeadershipPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireLeadershipViewAccess();
  const params = await searchParams;
  const requested = resolveDateRange(params);
  const effective = clampV2Range(requested.start, requested.end);
  const range: DateRange = { ...requested, start: effective.start, end: effective.end };
  const [locale, kpis, payload] = await Promise.all([
    getDashboardLocale(), getLeadershipKpis(), getAdmissionsV2Payload(range.start, range.end),
  ]);

  return (
    <DashboardLayout
      eyebrow="Milhano · Dirección"
      title={tr(locale, "Leadership", "Dirección")}
      subtitle={tr(locale, "Enrollment KPIs and Cinthia's Closer funnel in one view.", "KPIs de matrícula y funnel Closer de Cinthia en una sola vista.")}
      statusLabel={`${tr(locale, "Period", "Periodo")} ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <section className="panel leadership-kpi-panel">
        <div className="panel-heading compact-panel-heading"><div><p className="eyebrow">MATRÍCULA</p><h2>Indicadores escolares</h2></div></div>
        <div className="kpi-grid leadership-kpi-grid">
          {kpis.map((kpi, index) => {
            const Icon = icons[index] ?? CalendarCheck2;
            return <KpiCard key={kpi.kpi_key} icon={Icon} label={kpi.label_es} locale={locale} value={number(kpi.value)} helper={kpi.school_cycle ?? undefined} />;
          })}
        </div>
      </section>

      <DateRangeFilter basePath="/direccion" range={range} locale={locale} />

      <AdmissionsV2Cascade
        eyebrow="CLOSER · CINTHIA"
        title={tr(locale, "Closer conversion", "Conversión Closer")}
        scope="closer"
        metrics={payload.closer.funnel}
        range={range}
        note={tr(locale, "Each step shows the real GHL events in the selected period.", "Cada paso muestra eventos reales de GHL dentro del periodo seleccionado.")}
      />
      <ConversionRates metrics={payload.closer.funnel} />
      <V2CurrentStages title="Closer Pipeline" owner={payload.closer.owner} stages={payload.closer.current_stages} />
    </DashboardLayout>
  );
}
