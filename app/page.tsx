import Link from "next/link";
import { cookies } from "next/headers";
import {
  CalendarDays,
  CircleCheckBig,
  DatabaseZap,
  Layers3,
  Route,
  UsersRound,
} from "lucide-react";

import { AdmissionsV2Cascade } from "@/components/admissions-v2-cascade";
import { AdmissionsVersionSwitcher } from "@/components/admissions-version-switcher";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardRefreshButton } from "@/components/dashboard-refresh-button";
import { DateRangeFilter } from "@/components/date-range-filter";
import { KpiCard } from "@/components/kpi-card";
import { SummarySourceSwitcher, type SummarySource } from "@/components/summary-source-switcher";
import { V2CurrentStages } from "@/components/v2-current-stages";
import {
  ADMISSIONS_V2_CUTOVER,
  clampV2Range,
  getAdmissionsV2Payload,
  type V2CascadeMetric,
} from "@/lib/admissions-v2";
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
  const cookieStore = await cookies();
  const requestedSource = Array.isArray(params.source) ? params.source[0] : params.source;
  const savedSource = cookieStore.get("milhano_summary_source")?.value;
  const summarySource: SummarySource = requestedSource === "ghl" || requestedSource === "manual"
    ? requestedSource
    : savedSource === "manual" || savedSource === "ghl"
      ? savedSource
      : "ghl";

  const payload = await getAdmissionsV2Payload(range.start, range.end);
  const stageMapReady = payload.stage_map.resolved_stage_ids >= payload.stage_map.expected_stage_rows;

  const manualGeneral: V2CascadeMetric[] = [
    { metric_key: "new_leads", label: "New Leads", value: payload.manual.new_leads },
    { metric_key: "unique_contacted_leads", label: "Contacted", value: payload.manual.contacted ?? 0 },
    { metric_key: "responded_leads", label: "Responded", value: payload.manual.responded },
    { metric_key: "meaningful_conversations", label: "Meaningful", value: payload.manual.meaningful },
    { metric_key: "qualified_leads", label: "Qualified", value: payload.manual.qualified },
    { metric_key: "school_tours_booked", label: "Tour Booked", value: payload.manual.tour_booked },
    { metric_key: "school_tours_attended", label: "Tour Attended", value: payload.manual.tour_attended },
    { metric_key: "trial_days_booked", label: "Pasadía Booked", value: payload.manual.trial_booked },
    { metric_key: "trial_days_showed", label: "Pasadía Attended", value: payload.manual.trial_attended },
    { metric_key: "closed", label: "Closed", value: payload.manual.closed },
  ];
  const manualSetter = manualGeneral.slice(0, 5);
  const manualCloser = manualGeneral.slice(5);

  const responseTooltip = tr(
    locale,
    `${payload.response_breakdown.total} from the selected cohort have responded: ${payload.response_breakdown.in_period} during the selected period and ${payload.response_breakdown.after_period} after it.`,
    `${payload.response_breakdown.total} de la cohorte seleccionada ya respondieron: ${payload.response_breakdown.in_period} dentro del periodo y ${payload.response_breakdown.after_period} después del periodo.`,
  );
  const tourBookingTooltip = tr(
    locale,
    `${payload.booking_breakdown.school_tours.total} School Tour appointments scheduled inside the selected period. Each appointment counts separately, including siblings sharing one contact.`,
    `${payload.booking_breakdown.school_tours.total} citas de School Tour programadas dentro del periodo seleccionado. Cada cita cuenta por separado, incluso entre hermanos que comparten contacto.`,
  );
  const trialBookingTooltip = tr(
    locale,
    `${payload.booking_breakdown.trial_days.total} Trial Day appointments scheduled inside the selected period. Each appointment counts separately, including siblings sharing one contact.`,
    `${payload.booking_breakdown.trial_days.total} citas de Pasadía programadas dentro del periodo seleccionado. Cada cita cuenta por separado, incluso entre hermanos que comparten contacto.`,
  );
  const cascadeTooltips = {
    responded_leads: responseTooltip,
    school_tours_booked: tourBookingTooltip,
    trial_days_booked: trialBookingTooltip,
  };

  const automaticCascades = (
    <>
      <AdmissionsV2Cascade
        eyebrow="GENERAL · AUTO"
        title={tr(locale, "General Cascade", "Cascada General")}
        scope="general"
        metrics={payload.general}
        metricTooltips={cascadeTooltips}
        range={range}
        note={tr(locale, "Setter = 2:30 PM Mérida operational cohort · Closer = real events in the selected period", "Setter = cohorte operativa con corte 2:30 p. m. Mérida · Closer = eventos reales del periodo")}
      />
      <div className="v2-two-cascades">
        <AdmissionsV2Cascade
          compact
          eyebrow="SETTER · PATY"
          title={tr(locale, "Setter Cascade", "Cascada Setter")}
          scope="setter"
          metrics={payload.setter.funnel}
          metricTooltips={{ responded_leads: responseTooltip }}
          range={range}
          infoMetrics={[
            {
              metric_key: "no_answer",
              label: "No Answer",
              value: payload.informational.no_answer,
              helper: tr(locale, "Contacted cohort currently in a No Answer stage", "Cohorte contactada actualmente en un stage de No Answer"),
              tone: "warning",
            },
            {
              metric_key: "disqualified",
              label: tr(locale, "Disqualified", "Descalificados"),
              value: payload.informational.disqualified,
              helper: tr(locale, "Moved to Disqualified during the period", "Movidos a Disqualified en el periodo"),
              tone: "danger",
            },
          ]}
        />
        <AdmissionsV2Cascade
          compact
          eyebrow="CLOSER · CINTHIA"
          title={tr(locale, "Closer Cascade", "Cascada Closer")}
          scope="closer"
          metrics={payload.closer.funnel}
          metricTooltips={{
            school_tours_booked: tourBookingTooltip,
            trial_days_booked: trialBookingTooltip,
          }}
          range={range}
          note={tr(locale, "Booked / Attended = scheduled appointment date · Closed = real close-event date", "Booked / Attended = fecha programada de la cita · Closed = fecha real del cierre")}
        />
      </div>
    </>
  );

  const manualCascades = (
    <>
      <AdmissionsV2Cascade
        clickable={false}
        scope="general"
        eyebrow="GENERAL · MANUAL EOD"
        title="Cascada General"
        metrics={manualGeneral}
        range={range}
      />
      <div className="v2-two-cascades">
        <AdmissionsV2Cascade
          clickable={false}
          compact
          scope="setter"
          eyebrow="SETTER · MANUAL EOD"
          title="Cascada Setter"
          metrics={manualSetter}
          range={range}
        />
        <AdmissionsV2Cascade
          clickable={false}
          compact
          scope="closer"
          eyebrow="CLOSER · MANUAL EOD"
          title="Cascada Closer"
          metrics={manualCloser}
          range={range}
        />
      </div>
      <p className="v2-manual-period-note">EOD enviados/validados en el periodo: <strong>{number(payload.manual.reported_days)}</strong></p>
    </>
  );

  return (
    <DashboardLayout
      eyebrow="Milhano · Admissions V2"
      statusLabel={`${tr(locale, "Period", "Periodo")} ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
      subtitle={tr(locale,
        "GHL truth across the Legacy, Setter and Closer admissions pipelines.",
        "Verdad de GHL en los pipelines Legacy, Setter y Closer de admisiones.")}
      title={tr(locale, "Admissions V2", "Admisiones V2")}
    >
      <div className="v2-toolbar">
        <AdmissionsVersionSwitcher current="v2" />
        <DashboardRefreshButton />
      </div>

      <div className="v2-cutover-note">
        <strong>{tr(locale, "GHL truth · 2:30 PM operational cutoff", "Verdad GHL · corte operativo 2:30 p. m.")}</strong>
        <span>{tr(locale, "Setter/New Lead cohorts use the opportunity creation timestamp in Mérida with a 2:30 PM cutoff. Friday after 2:30 PM, Saturday, Sunday and Monday before 2:30 PM report as Monday. Appointments and Closer events keep their real calendar date.", "Las cohortes Setter/New Lead usan el timestamp de creación en Mérida con corte a las 2:30 p. m. Viernes después de 2:30 p. m., sábado, domingo y lunes antes de 2:30 p. m. reportan como lunes. Las citas y eventos de Closer conservan su fecha calendario real.")}</span>
      </div>

      <DateRangeFilter basePath="/" range={range} locale={locale} />

      <section className="panel v2-inventory-panel">
        <div className="panel-heading compact-panel-heading">
          <div>
            <p className="eyebrow">INVENTARIO ACTUAL · GHL</p>
            <h2>Opportunities del periodo en los 3 pipelines</h2>
          </div>
          {payload.inventory.unmapped_stage_opportunities > 0 ? (
            <p className="panel-note">{number(payload.inventory.unmapped_stage_opportunities)} opportunity(s) en stage sin mapear.</p>
          ) : null}
        </div>
        <div className="kpi-grid v2-inventory-grid">
          <KpiCard
            helper="Legacy + Setter + Closer"
            icon={Layers3}
            label="Total Opportunities"
            locale={locale}
            value={number(payload.inventory.total_opportunities)}
          />
          <KpiCard
            helper="Pipeline anterior · Leads Milhano"
            icon={Layers3}
            label="Legacy Pipeline"
            locale={locale}
            value={number(payload.inventory.legacy_opportunities)}
          />
          <KpiCard
            helper="Leads Milhano (Setter Pipeline)"
            icon={UsersRound}
            label="Setter Pipeline"
            locale={locale}
            value={number(payload.inventory.setter_opportunities)}
          />
          <KpiCard
            helper="Leads Milhano (Closer Pipeline)"
            icon={Route}
            label="Closer Pipeline"
            locale={locale}
            value={number(payload.inventory.closer_opportunities)}
          />
        </div>
      </section>

      <SummarySourceSwitcher
        initialSource={summarySource}
        locale={locale}
        manual={manualCascades}
        ghl={automaticCascades}
        automaticLabel="Auto (GHL)"
      />

      <section className="panel ghl-support-panel">
        <div className="panel-heading compact-panel-heading">
          <div>
            <p className="eyebrow">AGENDA · GHL</p>
            <h2>Agenda de hoy</h2>
          </div>
        </div>
        <div className="kpi-grid ghl-support-grid">
          <KpiCard icon={CalendarDays} label="School Tours Hoy" locale={locale} value={number(payload.today.school_tours_today)} helper="Citas GHL no canceladas" />
          <KpiCard icon={CalendarDays} label="Pasadías Hoy" locale={locale} value={number(payload.today.trial_days_today)} helper="Calendario Pasadía" />
          <KpiCard icon={stageMapReady ? CircleCheckBig : DatabaseZap} label="Stage IDs V2" locale={locale} value={`${payload.stage_map.resolved_stage_ids}/${payload.stage_map.expected_stage_rows}`} helper={stageMapReady ? "Mapeo resuelto" : "Ejecuta Full Reconciliation"} />
        </div>
      </section>

      <div className="v2-two-cascades">
        <V2CurrentStages title="Setter Pipeline" owner={payload.setter.owner} stages={payload.setter.current_stages} />
        <V2CurrentStages title="Closer Pipeline" owner={payload.closer.owner} stages={payload.closer.current_stages} />
      </div>
    </DashboardLayout>
  );
}
