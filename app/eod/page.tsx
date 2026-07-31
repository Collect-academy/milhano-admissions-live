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
import { requireCurrentAppUser } from "@/lib/auth";
import {
  dateRangeParams,
  resolveDateRange,
} from "@/lib/date-range";
import { getEodData } from "@/lib/data";
import {
  dateLabel,
  dateTimeLabel,
  number,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const teamMetricLabels: Record<string, string> = {
  whatsapp_total_messages: "WhatsApp totales",
  whatsapp_inbound_messages: "WhatsApp entrantes",
  whatsapp_outbound_messages: "WhatsApp salientes",
  whatsapp_manual_outbound_messages: "WhatsApp manuales",
  whatsapp_automated_outbound_messages:
    "WhatsApp automáticos",
  whatsapp_active_conversations: "Conversaciones activas",
  whatsapp_manually_attended_conversations:
    "Conversaciones atendidas",
  whatsapp_unique_contacts: "Contactos únicos",
  whatsapp_admissions_related_messages:
    "Mensajes con opportunity",
  whatsapp_general_or_unclassified_messages:
    "General / sin clasificar",
  team_outbound_call_attempts: "Intentos outbound",
  team_inbound_calls: "Llamadas inbound",
  team_meaningful_calls_3min: "Llamadas 3+ minutos",
};

const statusLabels: Record<string, string> = {
  system: "Sistema",
  pending: "Pendiente",
  matched: "Coincide",
  awaiting_confirmation: "Falta confirmar",
  mismatch: "Diferencia",
  draft: "Borrador",
  review: "En revisión",
  blocked: "Bloqueado",
  validated: "Validado",
  submitted: "Enviado",
  missed: "No enviado",
};

function statusClass(status: string): string {
  if (
    ["matched", "system", "validated", "submitted"].includes(
      status,
    )
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
      title: "Borrador guardado",
      description:
        "Los valores declarados y las notas quedaron registrados.",
    };
  }

  if (notice === "submitted") {
    return {
      tone: "good",
      title: "Cierre enviado",
      description:
        "Todas las métricas requeridas fueron confirmadas y coinciden.",
    };
  }

  if (notice === "incomplete") {
    return {
      tone: "warning",
      title: "El cierre sigue como borrador",
      description: `${missing || "Una o más"} métricas están vacías o sin confirmar.`,
    };
  }

  if (notice === "blocked") {
    return {
      tone: "error",
      title: "Cierre bloqueado por diferencia",
      description: `${mismatches || "Una o más"} métricas críticas no coinciden. Guarda una explicación y corrige o solicita validación admin.`,
    };
  }

  if (notice === "validated") {
    return {
      tone: "good",
      title: "Diferencia validada",
      description:
        "La cuenta admin aceptó la discrepancia con comentario de auditoría.",
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
  const data = await getEodData(range);

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
      eyebrow="Cierre operativo"
      title="End of Day"
      subtitle="Confirmación de resultados calculados y registro de diferencias."
      statusLabel={`Periodo ${dateLabel(range.start)} – ${dateLabel(range.end)}`}
    >
      <DateRangeFilter basePath="/eod" range={range} />

      {error ? (
        <section className="eod-feedback eod-feedback-error">
          <AlertTriangle size={19} />
          <div>
            <strong>No se pudo procesar el cierre</strong>
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
            Ventana: corte diario a las 14:50 de Mérida
          </strong>
          <span>
            El lunes incluye actividad desde el viernes anterior.
            El snapshot automático corre a las 14:52.
          </span>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Asesoras en snapshot"
          value={number(advisorGroups.size)}
          helper="Pathi y Cinthia activas"
          icon={UsersRound}
        />
        <KpiCard
          label="WhatsApp totales"
          value={number(metrics.whatsapp_total_messages)}
          helper="Métrica compartida del canal"
          icon={MessageCircleMore}
        />
        <KpiCard
          label="Conversaciones atendidas"
          value={number(
            metrics.whatsapp_manually_attended_conversations,
          )}
          helper="Con al menos una salida manual"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Intentos de llamada"
          value={number(metrics.team_outbound_call_attempts)}
          helper="Registrados dentro de GHL"
          icon={PhoneCall}
        />
        <KpiCard
          label="Cierre generado"
          value={latestSnapshot ? "Sí" : "No"}
          helper={dateTimeLabel(latestSnapshot?.generated_at)}
          icon={CalendarCheck2}
        />
        <KpiCard
          label="Última sincronización"
          value={
            latestSync?.status === "success"
              ? "OK"
              : latestSync?.status ?? "—"
          }
          helper={dateTimeLabel(
            latestSync?.finished_at ??
              latestSync?.started_at,
          )}
          icon={CheckCircle2}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Equipo / canal</p>
            <h2>Métricas compartidas del cierre</h2>
          </div>
          <p className="panel-note">
            WhatsApp no se reparte artificialmente entre asesoras
            cuando GHL no entrega userId.
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
          <EmptyState message="Todavía no existe un snapshot de equipo." />
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Confirmación operativa</p>
            <h2>Snapshot individual</h2>
          </div>
          <p className="panel-note">
            Cada asesora puede editar su cierre. La cuenta admin
            puede apoyar y validar diferencias.
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
                        <p className="eyebrow">Asesora</p>
                        <h3>{advisor}</h3>
                        <span className="eod-timestamp">
                          {group.validatedAt
                            ? `Validado ${dateTimeLabel(
                                group.validatedAt,
                              )}`
                            : group.submittedAt
                              ? `Enviado ${dateTimeLabel(
                                  group.submittedAt,
                                )}`
                              : "Pendiente de cierre"}
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
                          const manual =
                            row.requires_user_confirmation &&
                            !row.is_system_only;

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
                                    "Métrica del cierre diario."}
                                </span>
                              </div>

                              <div className="eod-system-value">
                                <span>Sistema</span>
                                <strong>
                                  {number(row.system_value)}
                                </strong>
                              </div>

                              {manual ? (
                                <>
                                  <label className="eod-number-field">
                                    <span>Declarado</span>
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

                                  <label className="eod-confirm-field">
                                    <input
                                      defaultChecked={
                                        row.user_confirmed
                                      }
                                      disabled={!editable}
                                      name={`confirmed__${row.metric_key}`}
                                      type="checkbox"
                                    />
                                    <span>Confirmo</span>
                                  </label>

                                  <label className="eod-note-field">
                                    <span>
                                      Nota de diferencia
                                    </span>
                                    <input
                                      defaultValue={
                                        row.discrepancy_note ?? ""
                                      }
                                      disabled={!editable}
                                      name={`note__${row.metric_key}`}
                                      placeholder={
                                        row.blocks_submission_on_mismatch
                                          ? "Obligatoria cuando no coincide"
                                          : "Opcional"
                                      }
                                      type="text"
                                    />
                                  </label>
                                </>
                              ) : (
                                <div className="eod-system-only">
                                  <ShieldCheck size={15} />
                                  <span>Automático</span>
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
                                {row.difference !== null &&
                                row.difference !== 0 ? (
                                  <small>
                                    Diferencia:{" "}
                                    {row.difference > 0
                                      ? "+"
                                      : ""}
                                    {number(row.difference)}
                                  </small>
                                ) : null}
                              </div>
                            </section>
                          );
                        })}
                      </div>

                      <label className="eod-comments-field">
                        <span>Comentario general del cierre</span>
                        <textarea
                          defaultValue={group.comments ?? ""}
                          disabled={!editable}
                          name="comments"
                          placeholder="Contexto general, pendientes o explicación breve."
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
                              Guardar borrador
                            </button>
                            <button
                              className="primary-button"
                              name="intent"
                              type="submit"
                              value="submit"
                            >
                              <Send size={16} />
                              Enviar cierre
                            </button>
                          </>
                        ) : (
                          <span className="eod-readonly-note">
                            {locked
                              ? "Este cierre ya no está abierto para edición."
                              : "Puedes consultar este cierre, pero no editarlo."}
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
                          <span>Validación administrativa</span>
                          <textarea
                            name="validation_comment"
                            placeholder="Explica por qué se acepta la diferencia."
                            required
                            rows={2}
                          />
                        </label>
                        <button
                          className="eod-validate-button"
                          type="submit"
                        >
                          <FileCheck2 size={16} />
                          Validar con diferencia
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              },
            )}
          </div>
        ) : (
          <EmptyState message="Todavía no hay snapshots individuales para esta fecha." />
        )}
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Histórico</p>
              <h2>Cierres dentro de {range.label}</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>WhatsApp</th>
                  <th>Manual outbound</th>
                  <th>Conversaciones</th>
                  <th>Llamadas</th>
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
              <p className="eyebrow">Salud del sistema</p>
              <h2>Últimas sincronizaciones</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Proceso</th>
                  <th>Status</th>
                  <th>Leídos</th>
                  <th>Fallidos</th>
                  <th>Fecha</th>
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
