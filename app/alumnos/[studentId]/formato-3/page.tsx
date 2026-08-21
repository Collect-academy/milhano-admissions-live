import Link from "next/link";
import { ArrowLeft, BookOpenText, LockKeyhole } from "lucide-react";

import { CreateRecordButton } from "@/components/create-record-button";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { StudentStatusIcon } from "@/components/student-status";
import { getStudent, getStudentFormRecords, requireStudentModuleContext } from "@/lib/student-records";

export const dynamic = "force-dynamic";

export default async function StudentForm3Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const [context, student, records] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentFormRecords(studentId, "form_3_evaluation", null),
  ]);
  const permission = context.permissions.form_3;

  return (
    <StudentModuleLayout eyebrow="Formato 3 · Confidencial" title="Evaluación Psicopedagógica Individual" subtitle={`${student.full_name} · Evaluaciones y reevaluaciones conservadas por fecha.`} statusLabel={`${records.length} evaluaciones`}>
      <Link className="secondary-button inline-back-link" href={`/alumnos/${studentId}`}><ArrowLeft size={15} /> Volver al expediente</Link>
      {!permission.can_view_content ? (
        <section className="panel student-confidential-block"><LockKeyhole size={24} /><div><strong>Contenido confidencial</strong><span>El estado permanece visible, pero el contenido sólo está disponible para usuarios autorizados.</span></div></section>
      ) : (
        <section className="panel">
          <div className="panel-heading student-history-heading">
            <div><p className="eyebrow">Historial</p><h2>Evaluaciones registradas</h2><p className="panel-note student-panel-note">Títulos automáticos: evaluación inicial / reevaluación + fecha.</p></div>
            {permission.can_edit ? <CreateRecordButton definitionCode="form_3_evaluation" hrefPrefix={`/alumnos/${studentId}/formato-3`} label="Nueva evaluación" studentId={studentId} /> : null}
          </div>
          {records.length ? (
            <div className="student-record-list">
              {records.map((record) => (
                <Link className="student-record-row" href={`/alumnos/${studentId}/formato-3/${record.id}`} key={record.id}>
                  <span className="student-record-icon"><BookOpenText size={17} /></span>
                  <span className="student-record-main"><strong>{record.title}</strong><small>Actualizado {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(record.updated_at))}</small></span>
                  <StudentStatusIcon status={record.completion_status === "complete" ? "complete" : record.completion_status === "incomplete" ? "incomplete" : "none"} />
                </Link>
              ))}
            </div>
          ) : <div className="student-empty-state"><BookOpenText size={28} /><strong>Sin evaluaciones</strong><span>Crea la evaluación inicial cuando corresponda.</span></div>}
        </section>
      )}
    </StudentModuleLayout>
  );
}
