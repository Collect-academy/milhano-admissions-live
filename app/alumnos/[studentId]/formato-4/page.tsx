import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import { CreateRecordButton } from "@/components/create-record-button";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { StudentStatusIcon } from "@/components/student-status";
import { getStudent, getStudentFormRecords, requireStudentModuleContext } from "@/lib/student-records";

export const dynamic = "force-dynamic";

export default async function StudentForm4Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const [context, student, records] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentFormRecords(studentId, "form_4_piap", null),
  ]);
  const permission = context.permissions.form_4;

  return (
    <StudentModuleLayout eyebrow="Formato 4" title="PIAP" subtitle={`${student.full_name} · Planes de intervención con revisiones periódicas asociadas.`} statusLabel={`${records.length} plan(es)`}>
      <Link className="secondary-button inline-back-link" href={`/alumnos/${studentId}`}><ArrowLeft size={15} /> Volver al expediente</Link>
      <section className="panel">
        <div className="panel-heading student-history-heading">
          <div><p className="eyebrow">Historial</p><h2>Planes de intervención</h2><p className="panel-note student-panel-note">Cada PIAP conserva sus propias revisiones para no sobrescribir el seguimiento.</p></div>
          {permission.can_edit ? <CreateRecordButton definitionCode="form_4_piap" hrefPrefix={`/alumnos/${studentId}/formato-4`} label="Nuevo PIAP" studentId={studentId} /> : null}
        </div>
        {records.length ? (
          <div className="student-record-list">
            {records.map((record) => (
              <Link className="student-record-row" href={`/alumnos/${studentId}/formato-4/${record.id}`} key={record.id}>
                <span className="student-record-icon"><FileText size={17} /></span>
                <span className="student-record-main"><strong>{record.title}</strong><small>Actualizado {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(record.updated_at))}</small></span>
                <StudentStatusIcon status={record.completion_status === "complete" ? "complete" : record.completion_status === "incomplete" ? "incomplete" : "none"} />
              </Link>
            ))}
          </div>
        ) : <div className="student-empty-state"><FileText size={28} /><strong>Sin PIAP</strong><span>Crea el primer plan de intervención cuando el caso lo requiera.</span></div>}
      </section>
    </StudentModuleLayout>
  );
}
