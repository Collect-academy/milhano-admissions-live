import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { AdmissionsV2Lead } from "@/lib/admissions-v2";

// This is a *read-only calendar split*, not a replacement for the official
// admissions/Agents SQL. Date and status overrides are applied by the V22 view.
// A GHL contact may have sibling opportunities; use metric_opportunity_id from V22.
export type AdmissionsCalendar = "pasadia" | "retroalimentacion";
export type CalendarEventKind = "booked" | "scheduled" | "attended";
export type AdmissionsCalendarMetricKey =
  | "trial_days_booked" | "trial_days_scheduled" | "trial_days_showed"
  | "feedback_booked" | "feedback_scheduled" | "feedback_attended";

export type CalendarAppointmentRow = {
  metric_row_id: string;
  ghl_opportunity_id: string;
  ghl_contact_id: string | null;
  lead_name: string;
  contact_name: string | null;
  student_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  operational_owner: string | null;
  current_pipeline_role: string | null;
  pipeline_name: string | null;
  current_stage: string | null;
  opportunity_status: string | null;
  lost_reason: string | null;
  lead_at: string;
  appointment_id: string;
  calendar_id: string;
  calendar_key: AdmissionsCalendar;
  appointment_title: string | null;
  appointment_status: string | null;
  date_added: string | null;
  booked_date: string | null;
  start_time: string | null;
  scheduled_date: string | null;
  lead_operational_date: string | null;
  today_local: string;
};

export type CalendarMetricCounts = {
  booked: number;
  scheduled: number;
  attended: number;
  cohort: number;
  external: number;
  today: number;
};

const CALENDAR_METRICS: Record<AdmissionsCalendarMetricKey, {
  calendar: AdmissionsCalendar;
  kind: CalendarEventKind;
}> = {
  trial_days_booked: { calendar: "pasadia", kind: "booked" },
  trial_days_scheduled: { calendar: "pasadia", kind: "scheduled" },
  trial_days_showed: { calendar: "pasadia", kind: "attended" },
  feedback_booked: { calendar: "retroalimentacion", kind: "booked" },
  feedback_scheduled: { calendar: "retroalimentacion", kind: "scheduled" },
  feedback_attended: { calendar: "retroalimentacion", kind: "attended" },
};

const ATTENDED_STATUSES = new Set(["showed", "completed", "show", "attended"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);

export function isCalendarAppointmentMetric(value: string): value is AdmissionsCalendarMetricKey {
  return Object.prototype.hasOwnProperty.call(CALENDAR_METRICS, value);
}

function inRange(date: string | null | undefined, start: string, end: string): boolean {
  return Boolean(date && date >= start && date <= end);
}

function statusOf(row: CalendarAppointmentRow) {
  return (row.appointment_status ?? "").trim().toLowerCase();
}

function isScheduled(row: CalendarAppointmentRow, start: string, end: string) {
  return inRange(row.scheduled_date, start, end) && !CANCELLED_STATUSES.has(statusOf(row));
}

function isAttended(row: CalendarAppointmentRow, start: string, end: string) {
  return inRange(row.scheduled_date, start, end) && ATTENDED_STATUSES.has(statusOf(row));
}

export function calendarMetricRows(
  rows: CalendarAppointmentRow[],
  metricKey: AdmissionsCalendarMetricKey,
  start: string,
  end: string,
): CalendarAppointmentRow[] {
  const { calendar, kind } = CALENDAR_METRICS[metricKey];
  return rows.filter((row) =>
    row.calendar_key === calendar && (
      kind === "booked"
        ? inRange(row.booked_date, start, end)
        : kind === "scheduled"
          ? isScheduled(row, start, end)
          : isAttended(row, start, end)
    ),
  );
}

export function calendarMetricSummary(
  rows: CalendarAppointmentRow[],
  start: string,
  end: string,
): Record<AdmissionsCalendar, CalendarMetricCounts> {
  const make = (calendar: AdmissionsCalendar): CalendarMetricCounts => {
    const matches = rows.filter((row) => row.calendar_key === calendar);
    const booked = matches.filter((row) => inRange(row.booked_date, start, end));
    const today = matches.filter((row) =>
      Boolean(row.today_local && row.scheduled_date === row.today_local) &&
      !CANCELLED_STATUSES.has(statusOf(row))
    );
    const cohort = booked.filter((row) => inRange(row.lead_operational_date, start, end)).length;
    return {
      booked: booked.length,
      scheduled: matches.filter((row) => isScheduled(row, start, end)).length,
      attended: matches.filter((row) => isAttended(row, start, end)).length,
      cohort,
      external: booked.length - cohort,
      today: today.length,
    };
  };
  return { pasadia: make("pasadia"), retroalimentacion: make("retroalimentacion") };
}

// One RPC for all calendar counts and all six drilldowns. Page in chunks instead
// of relying on PostgREST's default 1000-row result cap.
export async function getCalendarAppointmentRows(
  start: string,
  end: string,
): Promise<CalendarAppointmentRow[]> {
  const supabase = createSupabaseAdmin();
  const all: CalendarAppointmentRow[] = [];
  const pageSize = 500;
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const { data, error } = await supabase.rpc("milhano_get_calendar_appointment_rows_v1", {
      p_start: start,
      p_end: end,
      p_scope: "general",
    }).range(offset, offset + pageSize - 1);
    if (error) throw new Error(`No se pudieron leer calendarios de GHL: ${error.message}`);
    const next = (data ?? []) as CalendarAppointmentRow[];
    all.push(...next);
    if (next.length < pageSize) return all;
  }
  throw new Error("La consulta de calendarios superó 20,000 citas; revisar paginación.");
}

export function calendarRowsAsLeads(
  rows: CalendarAppointmentRow[],
  metricKey: AdmissionsCalendarMetricKey,
  start: string,
  end: string,
): AdmissionsV2Lead[] {
  const kind = CALENDAR_METRICS[metricKey].kind;
  return calendarMetricRows(rows, metricKey, start, end).map((row) => ({
    metric_row_id: row.metric_row_id,
    ghl_opportunity_id: row.ghl_opportunity_id,
    ghl_contact_id: row.ghl_contact_id,
    lead_name: row.lead_name,
    contact_name: row.contact_name,
    student_name: row.student_name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    operational_owner: row.operational_owner,
    current_pipeline_role: row.current_pipeline_role,
    pipeline_name: row.pipeline_name,
    current_stage: row.current_stage,
    opportunity_status: row.opportunity_status,
    lost_reason: row.lost_reason,
    lead_at: row.lead_at,
    metric_at: kind === "booked" ? row.date_added : row.start_time,
    metric_event_id: row.appointment_id,
    metric_title: row.appointment_title,
    metric_status: row.appointment_status,
    appointment_booked_at: row.date_added,
    appointment_scheduled_at: row.start_time,
  }));
}
