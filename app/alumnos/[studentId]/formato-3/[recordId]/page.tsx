import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StudentFormEditor } from "@/components/student-form-editor";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { getStudent, getStudentFormRecord, requireStudentModuleContext } from "@/lib/student-records";
import { studentFormDefinitions } from "@/lib/student-forms";

export const dynamic = "force-dynamic";

export default async function EvaluationEditorPage({ params }: { params: Promise<{ studentId: string; recordId: string }> }) {
  const { studentId, recordId } = await params;
  const [context, student, record] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentFormRecord(studentId, recordId),
  ]);
  if (record.definition_code !== "form_3_evaluation") throw new Error("El registro no corresponde al Formato 3.");

  return (
    <StudentModuleLayout eyebrow="Formato 3 · Confidencial" title={record.title || "Evaluación"} subtitle={`${student.full_name} · Evaluación Psicopedagógica Individual`} statusLabel={record.completion_status === "complete" ? "Completo" : "Incompleto"}>
      <Link className="secondary-button inline-back-link no-print" href={`/alumnos/${studentId}/formato-3`}><ArrowLeft size={15} /> Volver a evaluaciones</Link>
      <StudentFormEditor canEdit={context.permissions.form_3.can_edit} definition={studentFormDefinitions.form_3_evaluation} initialPayload={record.payload} initialSavedAt={record.updated_at} initialStatus={record.completion_status} recordId={record.id} studentId={studentId} />
    </StudentModuleLayout>
  );
}
