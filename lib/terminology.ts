import type { Locale } from "@/lib/locale";

export const CASCADE_METRICS = [
  { key: "new_leads", label: "New Leads" },
  { key: "number_of_dials", label: "Number of Dials" },
  { key: "unique_contacted_leads", label: "Unique Contacted Leads" },
  { key: "responded_leads", label: "Responded" },
  { key: "meaningful_conversations", label: "Meaningful Conversations" },
  { key: "qualified_leads", label: "Qualified / Fit" },
  { key: "school_tours_booked", label: "School Tours Booked" },
  { key: "school_tours_today", label: "School Tours Today" },
  { key: "school_tours_attended", label: "School Tours Attended" },
  { key: "trial_days_booked", label: "Trial Days Booked" },
  { key: "trial_days_showed", label: "Trial Days Showed" },
  { key: "closed", label: "Closed" },
] as const;

export type CascadeMetricKey = (typeof CASCADE_METRICS)[number]["key"];

const STAGE_LABELS_EN: Record<string, string> = {
  "Cliente potencial": "New Lead",
  "No responde": "No Response",
  Seguimiento: "Follow-up",
  "No responde / Seguimiento": "No Response / Follow-up (Legacy)",
  "No fit": "No Fit",
  "Lost / Sin continuidad": "Lost / No Continuity",
  Fit: "Qualified / Fit",
  Qualified: "Qualified / Fit (Alias legacy)",
  "School Tour agendado": "School Tour Booked",
  "School Tour atendido": "School Tour Attended",
  "Pasadía agendada": "Trial Day Booked",
  "Pasadía asistida": "Trial Day Showed",
  Retroalimentación: "Feedback",
  "En evaluación": "Under Evaluation",
  "Inscripción en proceso": "Enrollment in Progress",
  Inscrito: "Closed",
};

const STAGE_LABELS_ES: Record<string, string> = {
  "Cliente potencial": "Lead nuevo",
  "No responde": "No responde",
  Seguimiento: "Seguimiento",
  "No responde / Seguimiento": "No responde / Seguimiento (Legacy)",
  "No fit": "No Fit",
  "Lost / Sin continuidad": "Lost / Sin continuidad",
  Fit: "Qualified / Fit",
  Qualified: "Qualified / Fit (Legacy alias)",
  "School Tour agendado": "School Tour agendado",
  "School Tour atendido": "School Tour atendido",
  "Pasadía agendada": "Pasadía agendada",
  "Pasadía asistida": "Pasadía asistida",
  Retroalimentación: "Retroalimentación",
  "En evaluación": "En evaluación",
  "Inscripción en proceso": "Inscripción en proceso",
  Inscrito: "Inscrito / Closed",
};

export function stageLabel(
  value: string | null | undefined,
  locale: Locale = "en",
): string {
  if (!value) return locale === "es" ? "Desconocido" : "Unknown";
  return (locale === "es" ? STAGE_LABELS_ES : STAGE_LABELS_EN)[value] ?? value;
}

const SUPPORT_METRIC_LABELS: Record<string, { en: string; es: string }> = {
  answered_calls: { en: "Answered / Connected Calls", es: "Llamadas Contestadas" },
  new_leads_handled: { en: "New Leads Handled", es: "Leads Nuevos Atendidos" },
  stage_advancements: { en: "Stage Advancements", es: "Avances de Stage" },
  ads_leads: { en: "Ads Leads", es: "Leads Ads" },
  organic_leads: { en: "Organic Leads", es: "Leads Orgánicos" },
  messages_answered: { en: "Messages Answered", es: "Mensajes Contestados" },
  contacted_reported: { en: "Contact Attempts", es: "Contactados" },
  responses_reported: { en: "Responses", es: "Respuestas" },
  meaningful_conversations_reported: { en: "Meaningful Conversations", es: "Conversaciones Significativas" },
};

const CASCADE_METRIC_LABELS_ES: Record<string, string> = {
  new_leads: "Leads Totales",
  number_of_dials: "Llamadas",
  unique_contacted_leads: "Leads Únicos Contactados",
  responded_leads: "Respondieron",
  meaningful_conversations: "Conversaciones Significativas",
  qualified_leads: "Qualified / Fit",
  school_tours_booked: "ST Booked",
  school_tours_today: "School Tours Hoy",
  school_tours_attended: "ST Attended",
  trial_days_booked: "Pasadías Agendadas",
  trial_days_showed: "Pasadías Asistidas",
  closed: "Inscritos / Closed",
};

export function cascadeMetricLabel(
  key: string | null | undefined,
  locale: Locale = "en",
): string {
  if (!key) return locale === "es" ? "Métrica Operativa" : "Operational Metric";
  const cascade = CASCADE_METRICS.find((metric) => metric.key === key);
  if (cascade) {
    return locale === "es" ? (CASCADE_METRIC_LABELS_ES[key] ?? cascade.label) : cascade.label;
  }
  const support = SUPPORT_METRIC_LABELS[key];
  return support ? support[locale] : key;
}

export function ownerLabel(value: string | null | undefined, locale: Locale = "en"): string {
  if (!value || value === "Sin asignar") {
    return locale === "es" ? "Sin asignar" : "Unassigned";
  }
  return value;
}

export function attendanceLabel(value: string | null | undefined, locale: Locale = "en"): string {
  const en: Record<string, string> = {
    unknown: "Unknown",
    scheduled: "Scheduled",
    showed: "Showed",
    no_show: "No-show",
    cancelled: "Cancelled",
  };
  const es: Record<string, string> = {
    unknown: "Desconocido",
    scheduled: "Agendado",
    showed: "Asistió",
    no_show: "No-show",
    cancelled: "Cancelado",
  };
  const labels = locale === "es" ? es : en;
  return labels[value ?? "unknown"] ?? value ?? labels.unknown;
}
