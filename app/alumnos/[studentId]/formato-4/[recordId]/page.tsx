import Link from "next/link";
import { ArrowLeft, CalendarCheck2 } from "lucide-react";

import { CreateRecordButton } from "@/components/create-record-button";
import { StudentFormEditor } from "@/components/student-form-editor";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { StudentStatusIcon } from "@/components/student-status";
import { getStudent, getStudentFormRecord, getStudentFormRecords, requireStudentModuleContext } from "@/lib/student-records";
import { studentFormDefinitions } from "@/lib/student-forms";

export const dynamic = "force-dynamic";

export default async function PiapEditorPage({ params }: { params: Promise<{ studentId: string; recordId: string }> }) {
  const { studentId, recordId } = await params;
  const [context, student, record, reviews] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentFormRecord(studentId, recordId),
    getStudentFormRecords(studentId, "form_4_review", recordId),
  ]);
  if (record.definition_code !== "form_4_piap") throw new Error("El registro no corresponde a un PIAP.");

  return (
    <StudentModuleLayout eyebrow="Formato 4" title={record.title || "PIAP"} subtitle={`${student.full_name} · Plan de Intervención y Acompañamiento Psicopedagógico`} statusLabel={record.completion_status === "complete" ? "Completo" : "Incompleto"}>
      <Link className="secondary-button inline-back-link no-print" href={`/alumnos/${studentId}/formato-4`}><ArrowLeft size={15} /> Volver a PIAP</Link>
      <StudentFormEditor canEdit={context.permissions.form_4.can_edit} definition={studentFormDefinitions.form_4_piap} initialPayload={record.payload} initialSavedAt={record.updated_at} initialStatus={record.completion_status} recordId={record.id} studentId={studentId} />

      <section className="panel student-reviews-panel no-print">
        <div className="panel-heading student-history-heading">
          <div><p className="eyebrow">Seguimiento</p><h2>Revisiones periódicas</h2><p className="panel-note student-panel-note">Las revisiones se numeran automáticamente y permanecen ligadas a este PIAP.</p></div>
          {context.permissions.form_4.can_edit ? <CreateRecordButton definitionCode="form_4_review" hrefPrefix={`/alumnos/${studentId}/formato-4/${recordId}/revision`} label="Nueva revisión" parentRecordId={recordId} studentId={studentId} /> : null}
        </div>
        {reviews.length ? (
          <div className="student-record-list">
            {reviews.map((review) => (
              <Link className="student-record-row" href={`/alumnos/${studentId}/formato-4/${recordId}/revision/${review.id}`} key={review.id}>
                <span className="student-record-icon"><CalendarCheck2 size={17} /></span>
                <span className="student-record-main"><strong>{review.title}</strong><small>Actualizado {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(review.updated_at))}</small></span>
                <StudentStatusIcon status={review.completion_status === "complete" ? "complete" : review.completion_status === "incomplete" ? "incomplete" : "none"} />
              </Link>
            ))}
          </div>
        ) : <div className="student-empty-inline">Aún no hay revisiones registradas para este PIAP.</div>}
      </section>
    </StudentModuleLayout>
  );
}
