import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StudentFormEditor } from "@/components/student-form-editor";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import { getStudent, getStudentFormRecord, requireStudentModuleContext } from "@/lib/student-records";
import { studentFormDefinitions } from "@/lib/student-forms";

export const dynamic = "force-dynamic";

export default async function InterviewEditorPage({ params }: { params: Promise<{ studentId: string; recordId: string }> }) {
  const { studentId, recordId } = await params;
  const [context, student, record, locale] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentFormRecord(studentId, recordId),
    getDashboardLocale(),
  ]);
  if (record.definition_code !== "form_5_interview") throw new Error("El registro no corresponde al Formato 5.");

  return (
    <StudentModuleLayout
      eyebrow={tr(locale, "Form 5 · Open", "Formato 5 · Abierto")}
      title={record.title || tr(locale, "Student Interview", "Entrevista del Alumno")}
      subtitle={tr(locale, `${student.full_name} · Open-ended student interview`, `${student.full_name} · Entrevista de respuesta libre`)}
      statusLabel={record.completion_status === "complete" ? tr(locale, "Complete", "Completo") : tr(locale, "Incomplete", "Incompleto")}
    >
      <Link className="secondary-button inline-back-link no-print" href={`/alumnos/${studentId}/formato-5`}>
        <ArrowLeft size={15} /> {tr(locale, "Back to interviews", "Volver a entrevistas")}
      </Link>
      <StudentFormEditor
        canEdit={context.permissions.form_5.can_edit}
        definition={studentFormDefinitions.form_5_interview}
        initialPayload={record.payload}
        initialSavedAt={record.updated_at}
        initialStatus={record.completion_status}
        locale={locale}
        recordId={record.id}
        studentId={studentId}
      />
    </StudentModuleLayout>
  );
}
