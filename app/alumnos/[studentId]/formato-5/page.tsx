import Link from "next/link";
import { ArrowLeft, MessageCircleQuestion } from "lucide-react";

import { CreateRecordButton } from "@/components/create-record-button";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { StudentStatusIcon } from "@/components/student-status";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import { getStudent, getStudentFormRecords, requireStudentModuleContext } from "@/lib/student-records";

export const dynamic = "force-dynamic";

function dateLabel(value: string | null, locale: "en" | "es") {
  if (!value) return tr(locale, "No date", "Sin fecha");
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-MX", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
}

export default async function StudentForm5Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const [context, student, records, locale] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentFormRecords(studentId, "form_5_interview", null),
    getDashboardLocale(),
  ]);
  const permission = context.permissions.form_5;

  return (
    <StudentModuleLayout
      eyebrow={tr(locale, "Form 5 · Open", "Formato 5 · Abierto")}
      title={tr(locale, "Student Interview", "Entrevista del Alumno")}
      subtitle={tr(
        locale,
        `${student.full_name} · Open-ended interview records are kept separately over time.`,
        `${student.full_name} · Cada entrevista de respuesta libre se conserva como un registro independiente.`,
      )}
      statusLabel={tr(locale, `${records.length} interview(s)`, `${records.length} entrevista(s)`)}
    >
      <Link className="secondary-button inline-back-link" href={`/alumnos/${studentId}`}>
        <ArrowLeft size={15} /> {tr(locale, "Back to record", "Volver al expediente")}
      </Link>

      <section className="panel">
        <div className="panel-heading student-history-heading">
          <div>
            <p className="eyebrow">{tr(locale, "History", "Historial")}</p>
            <h2>{tr(locale, "Student interviews", "Entrevistas del alumno")}</h2>
            <p className="panel-note student-panel-note">
              {tr(locale, "All questions use open-ended answers.", "Todas las preguntas se responden de forma libre.")}
            </p>
          </div>
          {permission.can_edit ? (
            <CreateRecordButton
              definitionCode="form_5_interview"
              hrefPrefix={`/alumnos/${studentId}/formato-5`}
              label={tr(locale, "New interview", "Nueva entrevista")}
              studentId={studentId}
            />
          ) : null}
        </div>

        {records.length ? (
          <div className="student-record-list">
            {records.map((record) => (
              <Link className="student-record-row" href={`/alumnos/${studentId}/formato-5/${record.id}`} key={record.id}>
                <span className="student-record-icon"><MessageCircleQuestion size={17} /></span>
                <span className="student-record-main">
                  <strong>{record.title || tr(locale, "Student interview", "Entrevista del alumno")}</strong>
                  <small>
                    {dateLabel(record.occurred_on, locale)} · {tr(locale, "Updated", "Actualizado")} {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-MX", { dateStyle: "medium" }).format(new Date(record.updated_at))}
                  </small>
                </span>
                <StudentStatusIcon status={record.completion_status === "complete" ? "complete" : record.completion_status === "incomplete" ? "incomplete" : "none"} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="student-empty-state">
            <MessageCircleQuestion size={28} />
            <strong>{tr(locale, "No interviews", "Sin entrevistas")}</strong>
            <span>{tr(locale, "Create the first interview to start the history.", "Crea la primera entrevista para iniciar el historial.")}</span>
          </div>
        )}
      </section>
    </StudentModuleLayout>
  );
}
