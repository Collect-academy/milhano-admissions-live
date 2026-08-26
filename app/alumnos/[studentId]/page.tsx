import Link from "next/link";
import { ArrowLeft, BookOpenText, CalendarDays, FileText, NotebookPen, UserRound } from "lucide-react";

import { StudentModuleLayout } from "@/components/student-module-layout";
import { StudentNotesPanel } from "@/components/student-notes-panel";
import { ConfidentialTooltip, StudentStatusIcon } from "@/components/student-status";
import { getStudent, getStudentDirectoryRow, getStudentFormRecords, getStudentNotes, getStudentPhotoSignedUrl, requireStudentModuleContext } from "@/lib/student-records";
import type { StudentFormCode, StudentFormStatus } from "@/lib/student-forms";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

function statusCard({
  studentId,
  formCode,
  title,
  description,
  status,
  canOpen,
}: {
  studentId: string;
  formCode: StudentFormCode;
  title: string;
  description: string;
  status: StudentFormStatus;
  canOpen: boolean;
}) {
  const inner = (
    <>
      <div className="student-format-card-top"><span>Formato {formCode.slice(-1)}</span><StudentStatusIcon status={status} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {!canOpen ? <div className="student-format-confidential"><ConfidentialTooltip /> Contenido restringido</div> : <span className="student-format-open">Abrir formato →</span>}
    </>
  );
  return canOpen ? <Link className="student-format-card" href={`/alumnos/${studentId}/formato-${formCode.slice(-1)}`}>{inner}</Link> : <div className="student-format-card student-format-card-locked">{inner}</div>;
}

export default async function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const [context, student, directory, observations, evaluations, piaps, notes] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentDirectoryRow(studentId),
    getStudentFormRecords(studentId, "form_2_observation"),
    getStudentFormRecords(studentId, "form_3_evaluation"),
    getStudentFormRecords(studentId, "form_4_piap", null),
    getStudentNotes(studentId),
  ]);
  const photoUrl = student.photo_path ? await getStudentPhotoSignedUrl(student.photo_path) : student.photo_url;

  return (
    <StudentModuleLayout
      eyebrow="Expediente del alumno"
      title={student.full_name}
      subtitle={[student.level, student.grade, student.group_name ? `Grupo ${student.group_name}` : null].filter(Boolean).join(" · ") || "Datos académicos pendientes"}
      statusLabel="Expediente activo"
    >
      <Link className="secondary-button inline-back-link" href="/alumnos"><ArrowLeft size={15} /> Volver a alumnos</Link>

      <section className="student-profile-summary panel">
        <div className="student-profile-avatar">{photoUrl ? <img alt={`Foto de ${student.full_name}`} src={photoUrl} /> : <UserRound size={26} />}</div>
        <div><span>Alumno</span><strong>{student.full_name}</strong></div>
        <div><span>Grado / grupo</span><strong>{student.grade ?? "—"} {student.group_name ?? ""}</strong></div>
        <div><span>Tutor</span><strong>{student.tutor_name ?? "Pendiente"}</strong></div>
        <div><span>Matrícula</span><strong>{student.student_code ?? "—"}</strong></div>
      </section>

      <section className="student-format-grid">
        {statusCard({ studentId, formCode: "form_1", title: "Formato digital del alumno", description: "Perfil académico, aprendizaje, socioemocional y red de apoyo.", status: directory.form_1_status, canOpen: context.permissions.form_1.can_view_content })}
        {statusCard({ studentId, formCode: "form_2", title: "Observación Conductual en Aula", description: "Historial de observaciones, escalas y registros A-B-C.", status: directory.form_2_status, canOpen: context.permissions.form_2.can_view_content })}
        {statusCard({ studentId, formCode: "form_3", title: "Evaluación Psicopedagógica", description: "Evaluación inicial y reevaluaciones psicopedagógicas.", status: directory.form_3_status, canOpen: context.permissions.form_3.can_view_content })}
        {statusCard({ studentId, formCode: "form_4", title: "PIAP", description: "Planes de intervención y sus revisiones periódicas.", status: directory.form_4_status, canOpen: context.permissions.form_4.can_view_content })}
      </section>

      <section className="panel student-recent-panel">
        <div className="panel-heading"><div><p className="eyebrow">Historial</p><h2>Actividad reciente del expediente</h2></div></div>
        <div className="student-timeline-grid">
          <article><CalendarDays size={18} /><div><strong>Observaciones</strong><span>{observations.length ? `${observations.length} registro(s) · última ${formatDate(observations[0]?.occurred_on ?? null)}` : "Sin registros"}</span></div></article>
          <article><BookOpenText size={18} /><div><strong>Evaluaciones</strong><span>{evaluations.length ? `${evaluations.length} registro(s) · última ${formatDate(evaluations[0]?.occurred_on ?? null)}` : "Sin registros"}</span></div></article>
          <article><FileText size={18} /><div><strong>PIAP</strong><span>{piaps.length ? `${piaps.length} plan(es) · último ${formatDate(piaps[0]?.occurred_on ?? null)}` : "Sin registros"}</span></div></article>
          <article><NotebookPen size={18} /><div><strong>Bitácora</strong><span>{notes.length ? `${notes.length} nota(s) · última ${formatDate(notes[0]?.occurred_on ?? null)}` : "Sin registros"}</span></div></article>
        </div>
        <StudentNotesPanel canWrite studentId={studentId} notes={notes} />
      </section>
    </StudentModuleLayout>
  );
}
