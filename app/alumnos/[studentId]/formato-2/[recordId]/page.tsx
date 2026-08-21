import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StudentFormEditor } from "@/components/student-form-editor";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { getStudent, getStudentFormRecord, requireStudentModuleContext } from "@/lib/student-records";
import { studentFormDefinitions } from "@/lib/student-forms";

export const dynamic = "force-dynamic";

export default async function ObservationEditorPage({ params }: { params: Promise<{ studentId: string; recordId: string }> }) {
  const { studentId, recordId } = await params;
  const [context, student, record] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentFormRecord(studentId, recordId),
  ]);
  if (record.definition_code !== "form_2_observation") throw new Error("El registro no corresponde al Formato 2.");

  return (
    <StudentModuleLayout eyebrow="Formato 2 · Confidencial" title={record.title || "Observación"} subtitle={`${student.full_name} · Observación Conductual en Aula`} statusLabel={record.completion_status === "complete" ? "Completo" : "Incompleto"}>
      <Link className="secondary-button inline-back-link no-print" href={`/alumnos/${studentId}/formato-2`}><ArrowLeft size={15} /> Volver a observaciones</Link>
      <StudentFormEditor canEdit={context.permissions.form_2.can_edit} definition={studentFormDefinitions.form_2_observation} initialPayload={record.payload} initialSavedAt={record.updated_at} initialStatus={record.completion_status} recordId={record.id} studentId={studentId} />
    </StudentModuleLayout>
  );
}
