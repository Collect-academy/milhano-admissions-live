import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type EodTourOpportunityCandidate = {
  opportunityId: string;
  contactId: string | null;
  contactName: string | null;
  studentName: string | null;
  opportunityName: string | null;
  phone: string | null;
  currentStage: string | null;
  existingLevel: string | null;
};

export type EodTourRecord = {
  id: string;
  clientKey: string;
  bookingSubmissionId: string;
  bookingEodDate: string;
  advisorAppUserId: string;
  opportunityId: string;
  contactId: string | null;
  contactName: string | null;
  studentName: string | null;
  phone: string | null;
  schoolLevel: "primaria" | "secundaria" | "prepa" | "unknown";
  scheduledFor: string;
  attendanceSubmissionId: string | null;
  attendanceEodDate: string | null;
  attendanceStatus: "pending" | "show" | "no_show";
  closeOutcome: "pending" | "closed" | "not_closed";
  outcomeNote: string | null;
};

function mapTourRecord(row: Record<string, unknown>): EodTourRecord {
  return {
    id: String(row.id),
    clientKey: String(row.client_key),
    bookingSubmissionId: String(row.booking_submission_id),
    bookingEodDate: String(row.booking_eod_date),
    advisorAppUserId: String(row.advisor_app_user_id),
    opportunityId: String(row.ghl_opportunity_id),
    contactId: row.ghl_contact_id ? String(row.ghl_contact_id) : null,
    contactName: row.contact_name ? String(row.contact_name) : null,
    studentName: row.student_name ? String(row.student_name) : null,
    phone: row.phone ? String(row.phone) : null,
    schoolLevel: (["primaria", "secundaria", "prepa"].includes(String(row.school_level))
      ? String(row.school_level)
      : "unknown") as EodTourRecord["schoolLevel"],
    scheduledFor: String(row.scheduled_for),
    attendanceSubmissionId: row.attendance_submission_id ? String(row.attendance_submission_id) : null,
    attendanceEodDate: row.attendance_eod_date ? String(row.attendance_eod_date) : null,
    attendanceStatus: (["show", "no_show"].includes(String(row.attendance_status))
      ? String(row.attendance_status)
      : "pending") as EodTourRecord["attendanceStatus"],
    closeOutcome: (["closed", "not_closed"].includes(String(row.close_outcome))
      ? String(row.close_outcome)
      : "pending") as EodTourRecord["closeOutcome"],
    outcomeNote: row.outcome_note ? String(row.outcome_note) : null,
  };
}

export async function getEodTourOpportunityCandidates(): Promise<EodTourOpportunityCandidate[]> {
  const supabase = createSupabaseAdmin();
  const result = await supabase
    .from("milhano_opportunities")
    .select("ghl_opportunity_id, ghl_contact_id, contact_name, student_name, opportunity_name, phone, current_stage, level, updated_at")
    .order("updated_at", { ascending: false })
    .limit(2000);

  if (result.error) {
    throw new Error(`Unable to load School Tour contact candidates: ${result.error.message}`);
  }

  return (result.data ?? []).map((row: Record<string, any>) => ({
    opportunityId: row.ghl_opportunity_id,
    contactId: row.ghl_contact_id ?? null,
    contactName: row.contact_name ?? null,
    studentName: row.student_name ?? null,
    opportunityName: row.opportunity_name ?? null,
    phone: row.phone ?? null,
    currentStage: row.current_stage ?? null,
    existingLevel: row.level ?? null,
  }));
}

export async function getEodTourRecordsForEditor({
  submissionId,
  advisorAppUserId,
  eodDate,
}: {
  submissionId: string;
  advisorAppUserId: string;
  eodDate: string;
}): Promise<{
  currentBookings: EodTourRecord[];
  availableBookings: EodTourRecord[];
}> {
  const supabase = createSupabaseAdmin();

  const [currentResult, availableResult] = await Promise.all([
    supabase
      .from("milhano_eod_school_tour_records")
      .select("*")
      .eq("is_active", true)
      .or(`booking_submission_id.eq.${submissionId},attendance_submission_id.eq.${submissionId}`)
      .order("scheduled_for"),
    supabase
      .from("milhano_eod_school_tour_records")
      .select("*")
      .eq("is_active", true)
      .eq("advisor_app_user_id", advisorAppUserId)
      .lte("booking_eod_date", eodDate)
      .order("scheduled_for", { ascending: false })
      .limit(500),
  ]);

  if (currentResult.error) {
    throw new Error(`Unable to load this EOD School Tours: ${currentResult.error.message}`);
  }
  if (availableResult.error) {
    throw new Error(`Unable to load booked School Tours: ${availableResult.error.message}`);
  }

  const currentBookings = (currentResult.data ?? []).map((row: Record<string, any>) => mapTourRecord(row as Record<string, unknown>));
  const availableBookings = (availableResult.data ?? [])
    .map((row: Record<string, any>) => mapTourRecord(row as Record<string, unknown>))
    .filter((row: EodTourRecord) => !row.attendanceSubmissionId || row.attendanceSubmissionId === submissionId);

  return { currentBookings, availableBookings };
}

export type ManualLevelTotals = {
  primaria: number;
  secundaria: number;
  prepa: number;
  unknown: number;
};

export async function getManualTourLevelTotals(start: string, end: string): Promise<ManualLevelTotals> {
  const supabase = createSupabaseAdmin();
  const result = await supabase
    .from("milhano_eod_school_tour_records")
    .select("school_level")
    .eq("is_active", true)
    .gte("booking_eod_date", start)
    .lte("booking_eod_date", end)
    .limit(5000);

  if (result.error) {
    // V16.2 can be deployed before the SQL migration during rollout. Keep the
    // summary usable instead of taking the whole dashboard down.
    return { primaria: 0, secundaria: 0, prepa: 0, unknown: 0 };
  }

  return (result.data ?? []).reduce((acc: ManualLevelTotals, row: Record<string, any>) => {
    const key = (["primaria", "secundaria", "prepa"].includes(String(row.school_level))
      ? String(row.school_level)
      : "unknown") as keyof ManualLevelTotals;
    acc[key] += 1;
    return acc;
  }, { primaria: 0, secundaria: 0, prepa: 0, unknown: 0 });
}
