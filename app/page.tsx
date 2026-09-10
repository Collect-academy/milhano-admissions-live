import Link from "next/link";
import { CalendarDays, CircleCheckBig, DatabaseZap } from "lucide-react";

import { AdmissionsV2Cascade } from "@/components/admissions-v2-cascade";
import { AdmissionsVersionSwitcher } from "@/components/admissions-version-switcher";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardRefreshButton } from "@/components/dashboard-refresh-button";
import { DateRangeFilter } from "@/components/date-range-filter";
import { KpiCard } from "@/components/kpi-card";
import { V2CurrentStages } from "@/components/v2-current-stages";
import { ADMISSIONS_V2_CUTOVER, clampV2Range, getAdmissionsV2Payload } from "@/lib/admissions-v2";
import { resolveDateRange, type DateRange } from "@/lib/date-range";
import { dateLabel, number } from "@/lib/format";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdmissionsV2Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const requestedRange = resolveDateRange(params);
  const effective = clampV2Range(requestedRange.start, requestedRange.end);
  const range: DateRange = {
    ...requestedRange,
    start: effective.start,
    end: effective.end,
    label: requestedRange.start < ADMISSIONS_V2_CUTOVER
      ? `${dateLabel(effective.start)} – ${dateLabel(effective.end)}`
      : requestedRange.label,
  };
  const locale = await getDashboardLocale();
  const payload = await getAdmissionsV2Payload(range.start, range.end);
  const stageMapReady = payload.stage_map.resolved_stage_ids >= payload.stage_map.expected_stage_rows;

  return (
    <DashboardLayout
      eyebrow="Milhano · Admissions V2"
      statusLabel={`${tr(locale, "Period", "Periodo")} ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
      subtitle={tr(locale,
        "Setter + Closer + unified admissions funnel from the September 8 operational cutover.",
        "Setter + Closer + cascada general desde el corte operativo del 8 de septiembre.")}
      title={tr(locale, "Admissions V2", "Admisiones V2")}
    >
      <div className="v2-toolbar">
        <AdmissionsVersionSwitcher current="v2" />
        <DashboardRefreshButton />
      </div>

      <div className="v2-cutover-note">
        <strong>V2 inicia el 8 Sep 2026.</strong>
        <span>Los periodos anteriores se consultan en <Link href="/legacy">V1 · Legacy</Link>. Si eliges un rango que cruza el corte, V2 empieza automáticamente el 08/09.</span>
      </div>

      <DateRangeFilter basePath="/" range={range} locale={locale} />

      <AdmissionsV2Cascade
        eyebrow="CASCADE · GENERAL"
        title="Cascada General"
        note="Una sola cohorte: Setter → School Tour → Pasadía → Closed/Enrolled. Los avances posteriores implican los hitos previos para evitar conversiones imposibles."
        metrics={payload.general}
        range={range}
      />

      <div className="v2-two-cascades">
        <AdmissionsV2Cascade
          compact
          eyebrow="SETTER · PATHI"
          title="Cascada Setter"
          note="New Lead → Contacted → Responded → Meaningful Conversation → Qualified. D1/D2/D3, Callback y Nurturing se muestran en la cola operativa, no como conversiones."
          metrics={payload.setter.funnel}
          range={range}
        />
        <AdmissionsV2Cascade
          compact
          eyebrow="CLOSER · CINTHIA"
          title="Cascada Closer"
          note="Tour Booked → Tour Attended → Pasadía Booked → Pasadía Attended → Closed/Enrolled. Cancelled/No-show sigue visible como Nurturing B."
          metrics={payload.closer.funnel}
          range={range}
        />
      </div>

      <section className="panel ghl-support-panel">
        <div className="panel-heading compact-panel-heading">
          <div>
            <p className="eyebrow">AGENDA · GHL</p>
            <h2>Agenda de hoy y estado V2</h2>
          </div>
          <p className="panel-note">Pasadía usa el Calendar ID {payload.meta.pasadia_calendar_id}; no depende del texto del nombre del calendario.</p>
        </div>
        <div className="kpi-grid ghl-support-grid">
          <KpiCard icon={CalendarDays} label="School Tours Hoy" locale={locale} value={number(payload.today.school_tours_today)} helper="Citas GHL no canceladas" />
          <KpiCard icon={CalendarDays} label="Pasadías Hoy" locale={locale} value={number(payload.today.trial_days_today)} helper="Calendario Pasadía" />
          <KpiCard icon={stageMapReady ? CircleCheckBig : DatabaseZap} label="Stage IDs V2" locale={locale} value={`${payload.stage_map.resolved_stage_ids}/${payload.stage_map.expected_stage_rows}`} helper={stageMapReady ? "Mapeo resuelto" : "Ejecuta Full Reconciliation V3"} />
        </div>
      </section>

      <div className="v2-two-cascades">
        <V2CurrentStages title="Setter Pipeline" owner={payload.setter.owner} stages={payload.setter.current_stages} />
        <V2CurrentStages title="Closer Pipeline" owner={payload.closer.owner} stages={payload.closer.current_stages} />
      </div>

      <section className="panel v2-manual-check">
        <div className="panel-heading compact-panel-heading">
          <div>
            <p className="eyebrow">RECONCILIACIÓN HUMANA</p>
            <h2>Referencia EOD del periodo</h2>
          </div>
          <p className="panel-note">No se suma ciegamente al sistema. Sirve para detectar rápidamente si una Pasadía/Closed fue reportada manualmente pero aún no llegó por GHL.</p>
        </div>
        <div className="v2-manual-grid">
          <div><span>Tour Booked</span><strong>{number(payload.manual.tour_booked)}</strong></div>
          <div><span>Tour Attended</span><strong>{number(payload.manual.tour_attended)}</strong></div>
          <div><span>Pasadía Booked</span><strong>{number(payload.manual.trial_booked)}</strong></div>
          <div><span>Pasadía Attended</span><strong>{number(payload.manual.trial_attended)}</strong></div>
          <div><span>Closed</span><strong>{number(payload.manual.closed)}</strong></div>
          <div><span>Días EOD</span><strong>{number(payload.manual.reported_days)}</strong></div>
        </div>
      </section>
    </DashboardLayout>
  );
}
