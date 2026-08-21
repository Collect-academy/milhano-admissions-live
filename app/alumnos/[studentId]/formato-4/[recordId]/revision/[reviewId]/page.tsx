import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StudentFormEditor } from "@/components/student-form-editor";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { getStudent, getStudentFormRecord, requireStudentModuleContext } from "@/lib/student-records";
import { studentFormDefinitions } from "@/lib/student-forms";

export const dynamic = "force-dynamic";

export default async function PiapReviewEditorPage({ params }: { params: Promise<{ studentId: string; recordId: string; reviewId: string }> }) {
  const { studentId, recordId, reviewId } = await params;
  const [context, student, review] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentFormRecord(studentId, reviewId),
  ]);
  if (review.definition_code !== "form_4_review" || review.parent_record_id !== recordId) throw new Error("La revisión no corresponde al PIAP seleccionado.");

  return (
    <StudentModuleLayout eyebrow="Formato 4 · Revisión" title={review.title || "Revisión PIAP"} subtitle={`${student.full_name} · Seguimiento del plan de intervención`} statusLabel={review.completion_status === "complete" ? "Completo" : "Incompleto"}>
      <Link className="secondary-button inline-back-link no-print" href={`/alumnos/${studentId}/formato-4/${recordId}`}><ArrowLeft size={15} /> Volver al PIAP</Link>
      <StudentFormEditor canEdit={context.permissions.form_4.can_edit} definition={studentFormDefinitions.form_4_review} initialPayload={review.payload} initialSavedAt={review.updated_at} initialStatus={review.completion_status} recordId={review.id} studentId={studentId} />
    </StudentModuleLayout>
  );
}
