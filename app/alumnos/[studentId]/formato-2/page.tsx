import Link from "next/link";
import { ArrowLeft, CalendarDays, LockKeyhole } from "lucide-react";

import { CreateRecordButton } from "@/components/create-record-button";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { StudentStatusIcon } from "@/components/student-status";
import { getStudent, getStudentFormRecords, requireStudentModuleContext } from "@/lib/student-records";

export const dynamic = "force-dynamic";

function dateLabel(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
}

export default async function StudentForm2Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const [context, student, records] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentFormRecords(studentId, "form_2_observation", null),
  ]);
  const permission = context.permissions.form_2;

  return (
    <StudentModuleLayout
      eyebrow="Formato 2 · Confidencial"
      title="Observación Conductual en Aula"
      subtitle={`${student.full_name} · Cada observación se conserva como un registro independiente.`}
      statusLabel={`${records.length} observaciones`}
    >
      <Link className="secondary-button inline-back-link" href={`/alumnos/${studentId}`}><ArrowLeft size={15} /> Volver al expediente</Link>

      {!permission.can_view_content ? (
        <section className="panel student-confidential-block"><LockKeyhole size={24} /><div><strong>Contenido confidencial</strong><span>Puedes ver el estado del formato desde la lista de alumnos, pero no su contenido.</span></div></section>
      ) : (
        <section className="panel">
          <div className="panel-heading student-history-heading">
            <div><p className="eyebrow">Historial</p><h2>Observaciones registradas</h2><p className="panel-note student-panel-note">Títulos automáticos: materia + fecha.</p></div>
            {permission.can_edit ? <CreateRecordButton definitionCode="form_2_observation" hrefPrefix={`/alumnos/${studentId}/formato-2`} label="Nueva observación" studentId={studentId} /> : null}
          </div>

          {records.length ? (
            <div className="student-record-list">
              {records.map((record) => (
                <Link className="student-record-row" href={`/alumnos/${studentId}/formato-2/${record.id}`} key={record.id}>
                  <span className="student-record-icon"><CalendarDays size={17} /></span>
                  <span className="student-record-main"><strong>{record.title}</strong><small>{dateLabel(record.occurred_on)} · Actualizado {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(record.updated_at))}</small></span>
                  <StudentStatusIcon status={record.completion_status === "complete" ? "complete" : record.completion_status === "incomplete" ? "incomplete" : "none"} />
                </Link>
              ))}
            </div>
          ) : <div className="student-empty-state"><CalendarDays size={28} /><strong>Sin observaciones</strong><span>Crea la primera observación para iniciar el historial.</span></div>}
        </section>
      )}
    </StudentModuleLayout>
  );
}
