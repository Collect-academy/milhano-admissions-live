import {
  Bot,
  ContactRound,
  Inbox,
  MessageCircleMore,
  MessagesSquare,
  Send,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import {
  WhatsAppActivityChart,
  WhatsAppClassificationChart,
} from "@/components/whatsapp-charts";
import { resolveDateRange } from "@/lib/date-range";
import { getWhatsAppDashboardData } from "@/lib/data";
import {
  dateLabel,
  decimal,
  number,
  percent,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

function sum(
  rows: Awaited<
    ReturnType<typeof getWhatsAppDashboardData>
  >["daily"],
  key: keyof Awaited<
    ReturnType<typeof getWhatsAppDashboardData>
  >["daily"][number],
): number {
  return rows.reduce(
    (total, row) => total + Number(row[key] ?? 0),
    0,
  );
}

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const data = await getWhatsAppDashboardData(range);
  const selected = data.daily;
  const latest = selected.at(-1) ?? null;
  const selectedTotal = sum(selected, "total_messages");
  const selectedGeneral = sum(
    selected,
    "general_or_unclassified_messages",
  );
  const selectedAdmissions = sum(
    selected,
    "admissions_related_messages",
  );
  const generalShare =
    selectedTotal > 0
      ? (selectedGeneral / selectedTotal) * 100
      : null;
  const backfill = data.backfill;
  const backfillRunning = backfill?.status === "running";
  const backfillCompleted =
    backfill?.status === "completed";

  return (
    <DashboardLayout
      eyebrow="Institutional Channel"
      title="WhatsApp Operations"
      subtitle="Institutional number volume: general service, admissions and automations."
      statusLabel={`Period ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <DateRangeFilter
        basePath="/whatsapp"
        range={range}
      />

      {backfill ? (
        <section
          className={
            backfillCompleted
              ? "scope-banner scope-banner-success"
              : "scope-banner"
          }
        >
          <MessageCircleMore size={19} />
          <div>
            <strong>
              WhatsApp History:{" "}
              {backfillCompleted
                ? "completed"
                : backfillRunning
                  ? `${percent(
                      backfill.progress_pct,
                    )} loaded`
                  : backfill.status}
            </strong>
            <span>
              {number(backfill.records_seen)} de{" "}
              {number(backfill.total_reported)} messages ·{" "}
              {number(backfill.pages_processed)} pages
            </span>
          </div>
        </section>
      ) : null}

      <section className="kpi-grid">
        <KpiCard
          label={`Messages · ${range.label}`}
          value={number(selectedTotal)}
          helper="Inbound + outbound"
          icon={MessageCircleMore}
        />
        <KpiCard
          label="Inbound"
          value={number(sum(selected, "inbound_messages"))}
          helper="Received demand"
          icon={Inbox}
        />
        <KpiCard
          label="Manual Outbound"
          value={number(
            sum(selected, "manual_outbound_messages"),
          )}
          helper="Shared channel"
          icon={Send}
        />
        <KpiCard
          label="Automated"
          value={number(
            sum(selected, "automated_outbound_messages"),
          )}
          helper="Sent by workflows"
          icon={Bot}
        />
        <KpiCard
          label="Conversations"
          value={number(
            sum(selected, "active_conversations"),
          )}
          helper="Daily sum; contacts may repeat across days"
          icon={MessagesSquare}
        />
        <KpiCard
          label="Contacts"
          value={number(sum(selected, "unique_contacts"))}
          helper="Daily sum; contacts may repeat across days"
          icon={ContactRound}
        />
      </section>

      <section className="decision-banner">
        <div>
          <p className="eyebrow">
            Operational Signal · {range.label}
          </p>
          <h2>
            The institutional number handles service beyond
            admissions
          </h2>
          <p>
            {percent(generalShare)} of period messages
            are classified as general service or have no
            opportunity.
          </p>
        </div>
        <div className="decision-stats">
          <div>
            <strong>{number(selectedAdmissions)}</strong>
            <span>With Opportunity</span>
          </div>
          <div>
            <strong>{number(selectedGeneral)}</strong>
            <span>General / Unclassified</span>
          </div>
        </div>
      </section>

      {selected.length ? (
        <div className="two-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{range.label}</p>
                <h2>Messages and Conversations</h2>
              </div>
              <p className="panel-note">
                Manual activity reflects human work on the channel, not
                a specific advisor.
              </p>
            </div>
            <WhatsAppActivityChart data={selected} />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{range.label}</p>
                <h2>Admissions vs General Service</h2>
              </div>
              <p className="panel-note">
                “With Opportunity” is an operational relationship,
                not a semantic classification.
              </p>
            </div>
            <WhatsAppClassificationChart data={selected} />
          </section>
        </div>
      ) : (
        <EmptyState message="No WhatsApp activity exists in the selected period." />
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Daily Detail</p>
            <h2>{range.label}</h2>
          </div>
          <p className="panel-note">
            Each Message ID is counted once.
          </p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Total</th>
                <th>Inbound</th>
                <th>Manual Outbound</th>
                <th>Automated</th>
                <th>Conversations</th>
                <th>Handled</th>
                <th>Messages / Conversation</th>
              </tr>
            </thead>
            <tbody>
              {[...selected].reverse().map((row) => (
                <tr key={row.activity_date}>
                  <td>{dateLabel(row.activity_date)}</td>
                  <td>{number(row.total_messages)}</td>
                  <td>{number(row.inbound_messages)}</td>
                  <td>
                    {number(row.manual_outbound_messages)}
                  </td>
                  <td>
                    {number(row.automated_outbound_messages)}
                  </td>
                  <td>{number(row.active_conversations)}</td>
                  <td>
                    {number(
                      row.manually_attended_conversations,
                    )}
                  </td>
                  <td>
                    {decimal(
                      row.messages_per_active_conversation,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel compact-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Loaded Historical Coverage</p>
            <h2>Available Total in Supabase</h2>
          </div>
        </div>
        <div className="summary-row">
          <div>
            <strong>
              {number(data.summary?.total_messages)}
            </strong>
            <span>messages</span>
          </div>
          <div>
            <strong>
              {number(data.summary?.active_conversations)}
            </strong>
            <span>conversaciones</span>
          </div>
          <div>
            <strong>
              {number(data.summary?.unique_contacts)}
            </strong>
            <span>contactos</span>
          </div>
          <div>
            <strong>
              {dateLabel(data.summary?.first_message_at)}
            </strong>
            <span>first record</span>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
