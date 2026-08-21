import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StudentFormEditor } from "@/components/student-form-editor";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { getStudent, getStudentFormRecords, requireStudentModuleContext } from "@/lib/student-records";
import { studentFormDefinitions } from "@/lib/student-forms";

export const dynamic = "force-dynamic";

export default async function StudentForm1Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const [context, student, records] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentFormRecords(studentId, "form_1_profile", null),
  ]);
  const permission = context.permissions.form_1;
  const record = records[0] ?? null;

  return (
    <StudentModuleLayout
      eyebrow="Formato 1"
      title="Formato digital del alumno"
      subtitle={`${student.full_name} · Perfil general del expediente`}
      statusLabel={record?.completion_status === "complete" ? "Completo" : record ? "Incompleto" : "Sin iniciar"}
    >
      <Link className="secondary-button inline-back-link no-print" href={`/alumnos/${studentId}`}><ArrowLeft size={15} /> Volver al expediente</Link>
      <StudentFormEditor
        canEdit={permission.can_edit}
        definition={studentFormDefinitions.form_1_profile}
        initialPayload={record?.payload ?? {
          full_name: student.full_name,
          grade: student.grade ?? "",
          group: student.group_name ?? "",
          photo_recent: student.photo_url ?? "",
        }}
        initialSavedAt={record?.updated_at ?? null}
        initialStatus={record?.completion_status ?? "empty"}
        recordId={record?.id ?? null}
        studentId={studentId}
      />
    </StudentModuleLayout>
  );
}
