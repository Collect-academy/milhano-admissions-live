import {
  Activity,
  CheckCircle2,
  GraduationCap,
  MessageCircleReply,
  MessageSquareText,
  Route,
  School,
  UserRoundCheck,
} from "lucide-react";

import { HelpTip } from "@/components/help-tip";
import { KpiCard } from "@/components/kpi-card";
import { conceptDefinition } from "@/lib/concepts";
import type { ManualEodTotals } from "@/lib/eod-manual";
import type { ManualLevelTotals } from "@/lib/eod-tours";
import { number } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

function flowPercent(from: number, to: number): string {
  if (from <= 0) return "—";
  return `${((to / from) * 100).toFixed(to > from ? 0 : 1)}%`;
}

function FlowArrow({
  from,
  to,
}: {
  from: number;
  to: number;
}) {
  return (
    <div className="flow-arrow" aria-label={`${to} / ${from}`}>
      <strong>{flowPercent(from, to)}</strong>
    </div>
  );
}

export function ManualEodSummary({
  totals,
  levelTotals,
  locale,
}: {
  totals: ManualEodTotals;
  levelTotals: ManualLevelTotals;
  locale: Locale;
}) {
  const funnel = [
    {
      key: "leads",
      label: tr(locale, "Total Leads", "Leads Totales"),
      value: totals.new_leads_received,
      helper: tr(locale, "Manual EOD", "EOD manual"),
      definitionKey: "new_leads",
      icon: Activity,
    },
    {
      key: "responded",
      label: tr(locale, "Responded", "Respondieron"),
      value: totals.responses_reported,
      helper: tr(locale, "Unique reported responders", "Leads que respondieron"),
      definitionKey: "responses_reported",
      icon: MessageCircleReply,
    },
    {
      key: "meaningful",
      label: "Meaningful",
      value: totals.meaningful_conversations_reported,
      helper: tr(locale, "Advisor-reported", "Reportado por asesora"),
      definitionKey: "meaningful_conversations",
      icon: MessageSquareText,
    },
    {
      key: "fit",
      label: "Qualified / Fit",
      value: totals.qualified_leads,
      helper: tr(locale, "Advisor-reported", "Reportado por asesora"),
      definitionKey: "qualified_leads",
      icon: CheckCircle2,
    },
    {
      key: "booked",
      label: "ST Booked",
      value: totals.school_tours_scheduled,
      helper: tr(locale, "Scheduled visits", "Visitas agendadas"),
      definitionKey: "school_tours_booked",
      icon: Route,
    },
    {
      key: "attended",
      label: "ST Attended",
      value: totals.school_tours_attended,
      helper: tr(locale, "Visits that happened", "Visitas realizadas"),
      definitionKey: "school_tours_attended",
      icon: School,
    },
    {
      key: "trial_booked",
      label: tr(locale, "Trial Day Booked", "Pasadía Agendada"),
      value: totals.trial_days_booked,
      helper: tr(locale, "Scheduled trial days", "Pasadías agendadas"),
      definitionKey: "trial_days_booked",
      icon: Route,
    },
    {
      key: "trial_attended",
      label: tr(locale, "Trial Day Attended", "Pasadía Asistida"),
      value: totals.trial_days_showed,
      helper: tr(locale, "Trial days that happened", "Pasadías realizadas"),
      definitionKey: "trial_days_showed",
      icon: School,
    },
    {
      key: "closed",
      label: tr(locale, "Closed", "Closed / Inscrito"),
      value: totals.closed_leads,
      helper: tr(locale, "Final enrolled / closed", "Cierre final / inscrito"),
      definitionKey: "closed",
      icon: UserRoundCheck,
    },
  ] as const;

  return (
    <>
      <section className="panel manual-summary-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Advisor-reported", "Reportado por asesora")}</p>
            <h2>{tr(locale, "Manual Admissions Funnel", "Cascada Manual de Admisiones")}</h2>
          </div>
          <p className="panel-note">
            {tr(
              locale,
              `Submitted/validated EODs only · ${totals.reportedDays} reported day(s). Contact attempts are intentionally separated because they are actions, not unique leads.`,
              `Solo EOD enviados/validados · ${totals.reportedDays} día(s) reportado(s). Contactados se separa porque son acciones, no leads únicos.`,
            )}
          </p>
        </div>

        <div className="manual-funnel-flow">
          {funnel.map((metric, index) => (
            <div className="manual-funnel-step" key={metric.key}>
              <KpiCard
                definitionKey={metric.definitionKey}
                helper={metric.helper}
                icon={metric.icon}
                label={metric.label}
                locale={locale}
                value={number(metric.value)}
              />
              {index < funnel.length - 1 ? (
                <FlowArrow from={metric.value} to={funnel[index + 1].value} />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="panel manual-activity-panel">
        <div className="panel-heading compact-panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Activity + acquisition", "Actividad + adquisición")}</p>
            <h2>{tr(locale, "Supporting Manual Metrics", "Métricas Manuales de Apoyo")}</h2>
          </div>
          <p className="panel-note">
            {tr(
              locale,
              "Contacted counts contact attempts across new leads and follow-ups. One lead can contribute more than once, so it does not belong inside the unique-lead funnel.",
              "Contactados cuenta intentos de contacto entre leads nuevos y seguimientos. Un mismo lead puede contar más de una vez, por eso no pertenece dentro de la cascada de leads únicos.",
            )}
          </p>
        </div>

        <div className="manual-support-grid">
          <div className="manual-support-card manual-support-card-emphasis">
            <GraduationCap size={18} />
            <strong>{number(totals.contacted_reported)}</strong>
            <span>{tr(locale, "Contact attempts", "Contactados / intentos")} <HelpTip text={conceptDefinition("contacted_reported", locale)} /></span>
            <small>{tr(locale, "Calls + WhatsApp + follow-up attempts reported by the advisor.", "Llamadas + WhatsApp + intentos de seguimiento reportados por la asesora.")}</small>
          </div>
          <div className="manual-support-card"><strong>{number(totals.ads_leads_reported)}</strong><span>{tr(locale, "Ads Leads", "Leads Ads")} <HelpTip text={conceptDefinition("ads_leads", locale)} /></span></div>
          <div className="manual-support-card"><strong>{number(totals.organic_leads_reported)}</strong><span>{tr(locale, "Organic Leads", "Orgánico")} <HelpTip text={conceptDefinition("organic_leads", locale)} /></span></div>
          <div className="manual-support-card"><strong>{number(levelTotals.primaria)}</strong><span>Primaria</span></div>
          <div className="manual-support-card"><strong>{number(levelTotals.secundaria)}</strong><span>Secundaria</span></div>
          <div className="manual-support-card"><strong>{number(levelTotals.prepa)}</strong><span>Prepa</span></div>
        </div>
      </section>
    </>
  );
}
