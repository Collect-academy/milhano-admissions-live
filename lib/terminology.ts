export const CASCADE_METRICS = [
  {
    key: "new_leads",
    label: "New Leads",
  },
  {
    key: "number_of_dials",
    label: "Number of Dials",
  },
  {
    key: "unique_contacted_leads",
    label: "Unique Contacted Leads",
  },
  {
    key: "meaningful_conversations",
    label: "Meaningful Conversations",
  },
  {
    key: "qualified_leads",
    label: "Qualified Leads",
  },
  {
    key: "school_tours_booked",
    label: "School Tours Booked",
  },
  {
    key: "school_tours_today",
    label: "School Tours Today",
  },
  {
    key: "school_tours_attended",
    label: "School Tours Attended",
  },
  {
    key: "trial_days_booked",
    label: "Trial Days Booked",
  },
  {
    key: "trial_days_showed",
    label: "Trial Days Showed",
  },
  {
    key: "closed",
    label: "Closed",
  },
] as const;

export type CascadeMetricKey =
  (typeof CASCADE_METRICS)[number]["key"];

const STAGE_LABELS: Record<string, string> = {
  "Cliente potencial": "New Lead",
  "No responde / Seguimiento": "No Response / Follow-up",
  "No fit": "No Fit",
  "Lost / Sin continuidad": "Lost / No Continuity",
  Fit: "Fit",
  "School Tour agendado": "School Tour Booked",
  "School Tour atendido": "School Tour Attended",
  "Pasadía agendada": "Trial Day Booked",
  "Pasadía asistida": "Trial Day Showed",
  Retroalimentación: "Feedback",
  "En evaluación": "Under Evaluation",
  "Inscripción en proceso": "Enrollment in Progress",
  Inscrito: "Closed",
};

export function stageLabel(
  value: string | null | undefined,
): string {
  if (!value) return "Unknown";
  return STAGE_LABELS[value] ?? value;
}

const SUPPORT_METRIC_LABELS: Record<string, string> = {
  answered_calls: "Answered / Connected Calls",
  new_leads_handled: "New Leads Handled",
  stage_advancements: "Stage Advancements",
  ads_leads: "Ads Leads",
  organic_leads: "Organic Leads",
  messages_answered: "Messages Answered",
};

export function cascadeMetricLabel(
  key: string | null | undefined,
): string {
  if (!key) return "Operational Metric";

  return (
    CASCADE_METRICS.find((metric) => metric.key === key)
      ?.label ?? SUPPORT_METRIC_LABELS[key] ?? key
  );
}

export function ownerLabel(
  value: string | null | undefined,
): string {
  if (!value || value === "Sin asignar") {
    return "Unassigned";
  }

  return value;
}

export function attendanceLabel(
  value: string | null | undefined,
): string {
  const labels: Record<string, string> = {
    unknown: "Unknown",
    scheduled: "Scheduled",
    showed: "Showed",
    no_show: "No-show",
    cancelled: "Cancelled",
  };

  return labels[value ?? "unknown"] ?? value ?? "Unknown";
}
