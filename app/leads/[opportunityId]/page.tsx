import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  MessageSquareText,
  PhoneCall,
  Save,
} from "lucide-react";

import { saveSchoolTourDetails } from "@/app/leads/[opportunityId]/actions";
import { DashboardLayout } from "@/components/dashboard-layout";
import { requireCurrentAppUser } from "@/lib/auth";
import { getLeadDetail } from "@/lib/cascade";
import {
  dateLabel,
  dateTimeInputValue,
  dateTimeLabel,
  duration,
} from "@/lib/format";
import {
  attendanceLabel,
  stageLabel,
} from "@/lib/terminology";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string; error?: string }>;

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ opportunityId: string }>;
  searchParams: SearchParams;
}) {
  const currentUser = await requireCurrentAppUser();
  const canEdit = currentUser.role !== "viewer";
  const { opportunityId } = await params;
  const notices = await searchParams;
  const data = await getLeadDetail(
    decodeURIComponent(opportunityId),
  );

  if (!data) notFound();

  const opportunity = data.opportunity;
  const tour = data.schoolTour;
  const leadName =
    opportunity.student_name ||
    opportunity.contact_name ||
    opportunity.opportunity_name ||
    "Lead Detail";

  return (
    <DashboardLayout
      eyebrow="Lead Details"
      title={leadName}
      subtitle="School Tour attendance, objections, notes and stage history."
      statusLabel={stageLabel(opportunity.current_stage)}
    >
      <Link className="secondary-button inline-back-link" href="/leads?metric=school_tours_attended">
        <ArrowLeft size={16} />
        Back to Lead List
      </Link>

      {notices.saved ? (
        <section className="eod-feedback eod-feedback-good">
          <CheckCircle2 size={18} />
          <div>
            <strong>School Tour details saved</strong>
            <span>The scorecards and lead list now use the updated information.</span>
          </div>
        </section>
      ) : null}

      {notices.error ? (
        <section className="eod-feedback eod-feedback-error">
          <MessageSquareText size={18} />
          <div>
            <strong>Unable to save</strong>
            <span>{notices.error}</span>
          </div>
        </section>
      ) : null}

      <section className="lead-profile-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Contact</p>
              <h2>Lead Profile</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div><dt>Contact</dt><dd>{opportunity.contact_name ?? "—"}</dd></div>
            <div><dt>Student</dt><dd>{opportunity.student_name ?? "—"}</dd></div>
            <div><dt>Phone</dt><dd>{opportunity.phone ?? "—"}</dd></div>
            <div><dt>Email</dt><dd>{opportunity.email ?? "—"}</dd></div>
            <div><dt>Current Stage</dt><dd>{stageLabel(opportunity.current_stage)}</dd></div>
            <div><dt>Owner</dt><dd>{opportunity.assigned_user ?? opportunity.historical_advisor ?? "Unassigned"}</dd></div>
            <div><dt>Source</dt><dd>{opportunity.source ?? "—"}</dd></div>
            <div><dt>Grade</dt><dd>{opportunity.grade_interest ?? "—"}</dd></div>
            <div><dt>Priority</dt><dd>{opportunity.priority ?? "—"}</dd></div>
            <div><dt>Lead Date</dt><dd>{dateLabel(opportunity.original_lead_date ?? opportunity.created_at)}</dd></div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Structured layer</p>
              <h2>School Tour Details</h2>
            </div>
            <CalendarClock size={19} />
          </div>

          <form action={saveSchoolTourDetails} className="school-tour-form">
            <input
              name="ghl_opportunity_id"
              type="hidden"
              value={opportunity.ghl_opportunity_id}
            />

            <div className="tour-form-grid">
              <label>
                <span>Scheduled For</span>
                <input
                  defaultValue={dateTimeInputValue(tour.scheduled_for)}
                  disabled={!canEdit}
                  name="scheduled_for"
                  type="datetime-local"
                />
              </label>

              <label>
                <span>Attendance</span>
                <select
                  defaultValue={tour.attendance_status}
                  disabled={!canEdit}
                  name="attendance_status"
                >
                  <option value="unknown">Unknown</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="showed">Showed</option>
                  <option value="no_show">No-show</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              <label>
                <span>Attended At</span>
                <input
                  defaultValue={dateTimeInputValue(tour.attended_at)}
                  disabled={!canEdit}
                  name="attended_at"
                  type="datetime-local"
                />
              </label>

              <label className="tour-checkbox">
                <input
                  defaultChecked={tour.has_objection}
                  disabled={!canEdit}
                  name="has_objection"
                  type="checkbox"
                />
                <span>Has Objection</span>
              </label>
            </div>

            <label>
              <span>Objection Summary</span>
              <textarea
                defaultValue={tour.objection_summary ?? ""}
                disabled={!canEdit}
                name="objection_summary"
                placeholder="Budget, distance, schedule, grade availability, decision-maker, etc."
                rows={3}
              />
            </label>

            <label>
              <span>No-show Reason</span>
              <textarea
                defaultValue={tour.no_show_reason ?? ""}
                disabled={!canEdit}
                name="no_show_reason"
                placeholder="Required when Attendance = No-show"
                rows={2}
              />
            </label>

            <label>
              <span>School Tour Notes</span>
              <textarea
                defaultValue={tour.school_tour_notes ?? ""}
                disabled={!canEdit}
                name="school_tour_notes"
                placeholder="What happened during the visit, family reactions and next action."
                rows={5}
              />
            </label>

            {canEdit ? (
              <button
                className="primary-button tour-save-button"
                type="submit"
              >
                <Save size={16} />
                Save School Tour Details
              </button>
            ) : (
              <p className="eod-readonly-note">
                Leadership accounts can review these details but
                cannot edit them.
              </p>
            )}
          </form>

          <p className="panel-note lead-detail-updated">
            Current status: {attendanceLabel(tour.attendance_status)}
            {tour.school_tour_updated_at
              ? ` · Updated ${dateTimeLabel(tour.school_tour_updated_at)}`
              : ""}
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Legacy context</p>
            <h2>Historical Comments</h2>
          </div>
        </div>
        <p className="legacy-comments">
          {opportunity.historical_comments ??
            "No historical comments were imported for this lead."}
        </p>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CRM history</p>
              <h2>Stage Timeline</h2>
            </div>
          </div>
          <div className="timeline-list">
            {data.stageEvents.map((event) => (
              <article key={event.event_id}>
                <span>{dateTimeLabel(event.event_timestamp)}</span>
                <strong>{stageLabel(event.to_stage)}</strong>
                <p>
                  {stageLabel(event.from_stage)} → {stageLabel(event.to_stage)}
                  {event.note ? ` · ${event.note}` : ""}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">GHL activity</p>
              <h2>Recent Calls</h2>
            </div>
            <PhoneCall size={19} />
          </div>
          <div className="timeline-list">
            {data.calls.length ? (
              data.calls.map((call) => (
                <article key={call.event_id}>
                  <span>{dateTimeLabel(call.event_timestamp)}</span>
                  <strong>
                    {call.direction === "outbound" ? "Outbound" : "Inbound"} ·{" "}
                    {duration(call.call_duration_seconds)}
                  </strong>
                  <p>
                    {call.is_meaningful_conversation
                      ? "Meaningful Conversation"
                      : call.is_connected_raw
                        ? "Connected Call"
                        : call.call_status ?? "Call Attempt"}
                  </p>
                </article>
              ))
            ) : (
              <p>No GHL calls are linked to this opportunity.</p>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
