import {
  Activity,
  CheckCircle2,
  MessageCircleReply,
  MessageSquareText,
  MousePointerClick,
  Route,
  School,
} from "lucide-react";

import { KpiCard } from "@/components/kpi-card";
import { HelpTip } from "@/components/help-tip";
import { conceptDefinition } from "@/lib/concepts";
import type { ManualEodTotals } from "@/lib/eod-manual";
import { number } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

export function ManualEodSummary({
  totals,
  locale,
}: {
  totals: ManualEodTotals;
  locale: Locale;
}) {
  return (
    <>
      <section className="panel manual-summary-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Advisor-reported", "Reportado por asesora")}</p>
            <h2>{tr(locale, "Manual EOD Summary", "Resumen Manual EOD")}</h2>
          </div>
          <p className="panel-note">
            {tr(
              locale,
              `Submitted/validated EODs only · ${totals.reportedDays} reported day(s). Values are summed exactly as entered by the advisors.`,
              `Solo EOD enviados/validados · ${totals.reportedDays} día(s) reportado(s). Los valores se suman exactamente como los capturaron las asesoras.`,
            )}
          </p>
        </div>

        <div className="manual-summary-flow">
          <KpiCard icon={Activity} label={tr(locale, "Total Leads", "Leads Totales")} value={number(totals.new_leads_received)} helper={tr(locale, "Manual EOD", "EOD manual")} definitionKey="new_leads" locale={locale} />
          <KpiCard icon={MousePointerClick} label={tr(locale, "Contacted", "Contactados")} value={number(totals.contacted_reported)} helper={tr(locale, "Reported contact attempts", "Intentos reportados")} definitionKey="contacted_reported" locale={locale} />
          <KpiCard icon={MessageCircleReply} label={tr(locale, "Responded", "Respondieron")} value={number(totals.responses_reported)} helper={tr(locale, "Unique reported responders", "Respondieron según EOD")} definitionKey="responses_reported" locale={locale} />
          <KpiCard icon={MessageSquareText} label={tr(locale, "Meaningful", "Meaningful")} value={number(totals.meaningful_conversations_reported)} helper={tr(locale, "Manual by design", "Manual por diseño")} definitionKey="meaningful_conversations" locale={locale} />
          <KpiCard icon={CheckCircle2} label="Qualified / Fit" value={number(totals.qualified_leads)} helper={tr(locale, "Advisor-reported", "Reportado por asesora")} definitionKey="qualified_leads" locale={locale} />
          <KpiCard icon={Route} label="ST Booked" value={number(totals.school_tours_scheduled)} helper={tr(locale, "Advisor-reported", "Reportado por asesora")} definitionKey="school_tours_booked" locale={locale} />
          <KpiCard icon={School} label="ST Attended" value={number(totals.school_tours_attended)} helper={tr(locale, "Advisor-reported", "Reportado por asesora")} definitionKey="school_tours_attended" locale={locale} />
        </div>
      </section>

      <section className="panel manual-acquisition-panel">
        <div className="panel-heading compact-panel-heading">
          <div>
            <p className="eyebrow">{tr(locale, "Manual acquisition", "Adquisición manual")}</p>
            <h2>{tr(locale, "Ads vs Organic", "Ads vs Orgánico")}</h2>
          </div>
          <p className="panel-note">
            {tr(locale, "Reported attribution; Facebook/Instagram Source is not assumed to be paid.", "Atribución reportada; Facebook/Instagram no se asume automáticamente como Ads.")}
          </p>
        </div>
        <div className="manual-acquisition-grid">
          <div><strong>{number(totals.ads_leads_reported)}</strong><span>{tr(locale, "Ads Leads", "Leads Ads")} <HelpTip text={conceptDefinition("ads_leads", locale) ?? ""} /></span></div>
          <div><strong>{number(totals.organic_leads_reported)}</strong><span>{tr(locale, "Organic Leads", "Orgánico")} <HelpTip text={conceptDefinition("organic_leads", locale) ?? ""} /></span></div>
          <div><strong>{number(totals.new_leads_received)}</strong><span>{tr(locale, "Reported Total", "Total Reportado")}</span></div>
        </div>
      </section>
    </>
  );
}
