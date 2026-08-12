import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock4,
  FileCheck2,
  MessageCircleMore,
  PhoneCall,
  Save,
  Send,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import {
  saveEodSubmission,
  validateEodSubmission,
} from "@/app/eod/actions";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { OperationalCascade } from "@/components/operational-cascade";
import { requireCurrentAppUser } from "@/lib/auth";
import {
  dateRangeParams,
  resolveDateRange,
} from "@/lib/date-range";
import { getOperationalCascade } from "@/lib/cascade";
import { getEodData } from "@/lib/data";
import {
  dateLabel,
  dateTimeLabel,
  number,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const callOutsideGhlMetricKeys = new Set([
  "calls_made",
  "ghl_connected_calls",
  "meaningful_conversations",
]);

const teamMetricLabels: Record<string, string> = {
  whatsapp_total_messages: "WhatsApp Messages",
  whatsapp_inbound_messages: "Inbound WhatsApp",
  whatsapp_outbound_messages: "Outbound WhatsApp",
  whatsapp_manual_outbound_messages: "Manual Outbound WhatsApp",
  whatsapp_automated_outbound_messages: "Automated WhatsApp",
  whatsapp_active_conversations: "Active Conversations",
  whatsapp_manually_attended_conversations: "Handled Conversations",
  whatsapp_unique_contacts: "Unique Contacts",
  whatsapp_admissions_related_messages: "Messages with Opportunity",
  whatsapp_general_or_unclassified_messages: "General / Unclassified",
  team_outbound_call_attempts: "Number of Dials",
  team_inbound_calls: "Inbound Calls",
  team_meaningful_calls_3min: "Meaningful Conversations",
  trial_day_plus_closed_leads: "Trial Day+ / Closed",
};

const statusLabels: Record<string, string> = {
  system: "System",
  pending: "Not Reported",
  matched: "Matched",
  reconciled: "Reconciled",
  mixed_reconciled: "Mixed · Reconciled",
  mixed_gap: "Mixed · Gap",
  reported_gap: "Reported Gap",
  awaiting_confirmation: "Awaiting Confirmation",
  mismatch: "Mismatch",
  draft: "Draft",
  review: "Under Review",
  blocked: "Blocked",
  validated: "Validated",
  submitted: "Submitted",
  missed: "Not Submitted",
};

function statusClass(status: string): string {
  if (
    [
      "matched",
      "reconciled",
      "system",
      "validated",
      "submitted",
    ].includes(status)
  ) {
    return "status-good";
  }

  if (["mismatch", "blocked", "missed"].includes(status)) {
    return "status-bad";
  }

  return "status-pending";
}

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

function first(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function noticeMessage(
  notice: string,
  missing: string,
  mismatches: string,
): {
  tone: "good" | "warning" | "error";
  title: string;
  description: string;
} | null {
  if (notice === "saved") {
    return {
      tone: "good",
      title: "Draft Saved",
      description:
        "Declared values and notes were saved.",
    };
  }

  if (notice === "submitted") {
    return {
      tone: "good",
      title: "EOD Submitted",
      description:
        "The EOD was saved even if the reported values differ from GHL. Any remaining gap stays visible for reconciliation.",
    };
  }

  if (notice === "incomplete") {
    return {
      tone: "warning",
      title: "Legacy Draft Status",
      description: `${missing || "One or more"} values were incomplete under the previous EOD policy. V11 no longer blocks submission for a mismatch.`,
    };
  }

  if (notice === "blocked") {
    return {
      tone: "error",
      title: "Legacy Blocked EOD",
      description: `${mismatches || "One or more"} gaps were blocked under the previous policy. New EOD submissions are non-blocking.`,
    };
  }

  if (notice === "validated") {
    return {
      tone: "good",
      title: "Mismatch Validated",
      description:
        "The admin account accepted the discrepancy with an audit comment.",
    };
  }

  return null;
}

export default async function EodPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const currentUser = await requireCurrentAppUser();
  const params = await searchParams;
  const range = resolveDateRange(params);
  const [data, cascade] = await Promise.all([
    getEodData(range),
    getOperationalCascade(range),
  ]);

  const latestSnapshot = data.snapshots[0] ?? null;
  const latestDate =
    latestSnapshot?.eod_date ?? data.rows[0]?.eod_date ?? null;
  const latestRows = latestDate
    ? data.rows.filter((row) => row.eod_date === latestDate)
    : [];

  const advisorGroups = new Map<
    string,
    {
      appUserId: string;
      submissionId: string;
      status: string;
      comments: string | null;
      submittedAt: string | null;
      validatedAt: string | null;
      rows: typeof latestRows;
    }
  >();

  for (const row of latestRows) {
    const current = advisorGroups.get(row.display_name) ?? {
      appUserId: row.app_user_id,
      submissionId: row.submission_id,
      status: row.submission_status,
      comments: row.submission_comments,
      submittedAt: row.submitted_at,
      validatedAt: row.validated_at,
      rows: [],
    };

    current.rows.push(row);
    advisorGroups.set(row.display_name, current);
  }

  const metrics = latestSnapshot?.metrics ?? {};
  const latestSync = data.syncRuns.find(
    (run) => run.sync_type === "eod_snapshot",
  );

  const notice = noticeMessage(
    first(params.notice),
    first(params.missing),
    first(params.mismatches),
  );
  const error = first(params.error);
  const preservedRange = dateRangeParams(range);

  return (
    <DashboardLayout
      eyebrow="Operational Close"
      title="End of Day"
      subtitle="System values, advisor-reported totals and known activity outside GHL are stored side by side."
      statusLabel={`Period ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <DateRangeFilter basePath="/eod" range={range} />

      <OperationalCascade metrics={cascade} range={range} />

      {error ? (
        <section className="eod-feedback eod-feedback-error">
          <AlertTriangle size={19} />
          <div>
            <strong>Unable to Process EOD</strong>
            <span>{error}</span>
          </div>
        </section>
      ) : null}

      {notice ? (
        <section
          className={`eod-feedback eod-feedback-${notice.tone}`}
        >
          {notice.tone === "good" ? (
            <CheckCircle2 size={19} />
          ) : (
            <AlertTriangle size={19} />
          )}
          <div>
            <strong>{notice.title}</strong>
            <span>{notice.description}</span>
          </div>
        </section>
      ) : null}

      <section className="scope-banner">
        <Clock4 size={19} />
        <div>
          <strong>
            Window: daily cutoff at 2:50 PM Mérida time
          </strong>
          <span>
            Monday includes activity from the previous Friday.
            The automatic snapshot runs at 2:52 PM.
          </span>
        </div>
      </section>

      <section className="scope-banner">
        <ShieldCheck size={19} />
        <div>
          <strong>How to report a mismatch</strong>
          <span>
            Reported Total is what you observed. Known Outside GHL
            is only the portion you know is missing from GHL. You
            can submit even when a gap remains.
          </span>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Advisors in Snapshot"
          value={number(advisorGroups.size)}
          helper="Pathi and Cinthia active"
          icon={UsersRound}
        />
        <KpiCard
          label="WhatsApp Messages"
          value={number(metrics.whatsapp_total_messages)}
          helper="Shared channel metric"
          icon={MessageCircleMore}
        />
        <KpiCard
          label="Handled Conversations"
          value={number(
            metrics.whatsapp_manually_attended_conversations,
          )}
          helper="With at least one manual outbound message"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Number of Dials"
          value={number(metrics.team_outbound_call_attempts)}
          helper="Registered in GHL"
          icon={PhoneCall}
        />
        <KpiCard
          label="Snapshot Generated"
          value={latestSnapshot ? "Yes" : "No"}
          helper={dateTimeLabel(latestSnapshot?.generated_at)}
          icon={CalendarCheck2}
        />
        <KpiCard
          label="Trial Day+ / Closed"
          value={number(
            metrics.trial_day_plus_closed_leads,
          )}
          helper="Distinct leads entering Trial Day Booked or any later stage"
          icon={CheckCircle2}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Team / Channel</p>
            <h2>Shared EOD Metrics</h2>
          </div>
          <p className="panel-note">
            WhatsApp is not artificially split between advisors
            when GHL does not provide a userId.
          </p>
        </div>

        {latestSnapshot ? (
          <div className="metric-tile-grid">
            {Object.entries(metrics).map(([key, value]) => (
              <article className="metric-tile" key={key}>
                <span>{teamMetricLabels[key] ?? key}</span>
                <strong>{number(value)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="No team snapshot is available yet." />
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Operational Confirmation</p>
            <h2>Individual Snapshot</h2>
          </div>
          <p className="panel-note">
            Each advisor can report the real total and, separately, only the activity she knows is outside GHL. A mismatch no longer blocks submission.
          </p>
        </div>

        {advisorGroups.size ? (
          <div className="advisor-grid advisor-grid-editable">
            {[...advisorGroups.entries()].map(
              ([advisor, group]) => {
                const canEdit =
                  currentUser.role === "admin" ||
                  currentUser.id === group.appUserId;
                const locked = [
                  "submitted",
                  "validated",
                ].includes(group.status);
                const editable = canEdit && !locked;

                return (
                  <article
                    className="advisor-card eod-advisor-card"
                    key={advisor}
                  >
                    <div className="advisor-heading">
                      <div>
                        <p className="eyebrow">Advisor</p>
                        <h3>{advisor}</h3>
                        <span className="eod-timestamp">
                          {group.validatedAt
                            ? `Validated ${dateTimeLabel(
                                group.validatedAt,
                              )}`
                            : group.submittedAt
                              ? `Submitted ${dateTimeLabel(
                                  group.submittedAt,
                                )}`
                              : "Pending EOD"}
                        </span>
                      </div>
                      <span
                        className={`status-pill ${statusClass(
                          group.status,
                        )}`}
                      >
                        {statusLabels[group.status] ??
                          group.status}
                      </span>
                    </div>

                    <form
                      action={saveEodSubmission}
                      className="eod-form"
                    >
                      <input
                        name="submission_id"
                        type="hidden"
                        value={group.submissionId}
                      />
                      {Object.entries(preservedRange).map(
                        ([key, value]) => (
                          <input
                            key={key}
                            name={key}
                            type="hidden"
                            value={value}
                          />
                        ),
                      )}

                      <div className="eod-metric-list">
                        {group.rows.map((row) => {
                          const manual = !row.is_system_only;

                          return (
                            <section
                              className="eod-metric-row"
                              key={`${row.submission_id}-${row.metric_key}`}
                            >
                              <input
                                name="metric_key"
                                type="hidden"
                                value={row.metric_key}
                              />

                              <div className="eod-metric-copy">
                                <strong>{row.label}</strong>
                                <span>
                                  {row.description ??
                                    "Daily EOD metric."}
                                </span>
                              </div>

                              <div className="eod-system-value">
                                <span>System</span>
                                <strong>
                                  {number(row.system_value)}
                                </strong>
                              </div>

                              {manual ? (
                                <>
                                  <label className="eod-number-field">
                                    <span>Reported Total</span>
                                    <input
                                      defaultValue={
                                        row.declared_value ?? ""
                                      }
                                      disabled={!editable}
                                      min="0"
                                      name={`declared__${row.metric_key}`}
                                      placeholder="0"
                                      step="1"
                                      type="number"
                                    />
                                  </label>

                                  <label className="eod-number-field eod-extra-field">
                                    <span>
                                      {callOutsideGhlMetricKeys.has(
                                        row.metric_key,
                                      )
                                        ? "WhatsApp / External"
                                        : "Known Outside GHL"}
                                    </span>
                                    <input
                                      defaultValue={
                                        row.manual_extra_value ?? 0
                                      }
                                      disabled={!editable}
                                      min="0"
                                      name={`manual_extra__${row.metric_key}`}
                                      placeholder="0"
                                      step="1"
                                      type="number"
                                    />
                                  </label>

                                  <label className="eod-note-field">
                                    <span>Context / Reason</span>
                                    <input
                                      defaultValue={
                                        row.discrepancy_note ?? ""
                                      }
                                      disabled={!editable}
                                      name={`note__${row.metric_key}`}
                                      placeholder="Example: 4 WhatsApp calls outside GHL"
                                      type="text"
                                    />
                                  </label>
                                </>
                              ) : (
                                <div className="eod-system-only">
                                  <ShieldCheck size={15} />
                                  <span>Automatic</span>
                                </div>
                              )}

                              <div className="eod-row-status">
                                <span
                                  className={`status-pill ${statusClass(
                                    row.reconciliation_status,
                                  )}`}
                                >
                                  {statusLabels[
                                    row.reconciliation_status
                                  ] ??
                                    row.reconciliation_status}
                                </span>
                                {row.operational_difference !== null &&
                                row.operational_difference !== 0 ? (
                                  <small>
                                    Gap:{" "}
                                    {row.operational_difference > 0
                                      ? "+"
                                      : ""}
                                    {number(
                                      row.operational_difference,
                                    )}
                                  </small>
                                ) : manual ? (
                                  <small>
                                    Operational: {number(
                                      row.operational_total,
                                    )}
                                  </small>
                                ) : null}
                              </div>
                            </section>
                          );
                        })}
                      </div>

                      <label className="eod-comments-field">
                        <span>General EOD Comment</span>
                        <textarea
                          defaultValue={group.comments ?? ""}
                          disabled={!editable}
                          name="comments"
                          placeholder="General context, pending items or a brief explanation."
                          rows={3}
                        />
                      </label>

                      <div className="eod-form-actions">
                        {editable ? (
                          <>
                            <button
                              className="secondary-button"
                              name="intent"
                              type="submit"
                              value="save"
                            >
                              <Save size={16} />
                              Save Draft
                            </button>
                            <button
                              className="primary-button"
                              name="intent"
                              type="submit"
                              value="submit"
                            >
                              <Send size={16} />
                              Submit EOD
                            </button>
                          </>
                        ) : (
                          <span className="eod-readonly-note">
                            {locked
                              ? "This EOD is no longer open for editing."
                              : "You can review this EOD but cannot edit it."}
                          </span>
                        )}
                      </div>
                    </form>

                    {group.status === "blocked" &&
                    currentUser.role === "admin" ? (
                      <form
                        action={validateEodSubmission}
                        className="eod-admin-validation"
                      >
                        <input
                          name="submission_id"
                          type="hidden"
                          value={group.submissionId}
                        />
                        {Object.entries(preservedRange).map(
                          ([key, value]) => (
                            <input
                              key={key}
                              name={key}
                              type="hidden"
                              value={value}
                            />
                          ),
                        )}
                        <label>
                          <span>Admin Validation</span>
                          <textarea
                            name="validation_comment"
                            placeholder="Explain why the mismatch is accepted."
                            required
                            rows={2}
                          />
                        </label>
                        <button
                          className="eod-validate-button"
                          type="submit"
                        >
                          <FileCheck2 size={16} />
                          Validate Mismatch
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              },
            )}
          </div>
        ) : (
          <EmptyState message="No individual snapshots are available for this date." />
        )}
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">History</p>
              <h2>EOD Snapshots within {range.label}</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>WhatsApp</th>
                  <th>Manual Outbound</th>
                  <th>Conversations</th>
                  <th>Calls</th>
                </tr>
              </thead>
              <tbody>
                {data.snapshots.map((snapshot) => (
                  <tr key={snapshot.eod_date}>
                    <td>{dateLabel(snapshot.eod_date)}</td>
                    <td>
                      {number(
                        snapshot.metrics
                          .whatsapp_total_messages,
                      )}
                    </td>
                    <td>
                      {number(
                        snapshot.metrics
                          .whatsapp_manual_outbound_messages,
                      )}
                    </td>
                    <td>
                      {number(
                        snapshot.metrics
                          .whatsapp_manually_attended_conversations,
                      )}
                    </td>
                    <td>
                      {number(
                        snapshot.metrics
                          .team_outbound_call_attempts,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">System Health</p>
              <h2>Latest Synchronizations</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Process</th>
                  <th>Status</th>
                  <th>Read</th>
                  <th>Failed</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.syncRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{run.sync_type}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          run.status === "success"
                            ? "status-good"
                            : run.status === "failed"
                              ? "status-bad"
                              : "status-pending"
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td>{number(run.records_read)}</td>
                    <td>{number(run.records_failed)}</td>
                    <td>
                      {dateTimeLabel(
                        run.finished_at ?? run.started_at,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
