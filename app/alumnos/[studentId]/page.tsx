import Link from "next/link";
import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  FileText,
  GraduationCap,
  IdCard,
  UserRound,
  UsersRound,
} from "lucide-react";

import { StudentModuleLayout } from "@/components/student-module-layout";
import { ConfidentialTooltip, StudentStatusIcon } from "@/components/student-status";
import { getStudent, getStudentDirectoryRow, getStudentFormRecords, requireStudentModuleContext } from "@/lib/student-records";
import type { StudentFormCode, StudentFormStatus } from "@/lib/student-forms";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
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

function tutorList(student: Awaited<ReturnType<typeof getStudent>>) {
  return [student.tutor_name, student.tutor_2_name, student.tutor_3_name].filter((value): value is string => Boolean(value));
}

export default async function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const [context, student, directory, observations, evaluations, piaps] = await Promise.all([
    requireStudentModuleContext(),
    getStudent(studentId),
    getStudentDirectoryRow(studentId),
    getStudentFormRecords(studentId, "form_2_observation"),
    getStudentFormRecords(studentId, "form_3_evaluation"),
    getStudentFormRecords(studentId, "form_4_piap", null),
  ]);
  const tutors = tutorList(student);

  return (
    <StudentModuleLayout
      eyebrow="Expediente del alumno"
      title={student.full_name}
      subtitle={[student.level, student.grade, student.group_name ? `Grupo ${student.group_name}` : null].filter(Boolean).join(" · ") || "Datos académicos pendientes"}
      statusLabel={student.is_demo ? "Alumno de prueba" : "Expediente activo"}
    >
      <Link className="secondary-button inline-back-link" href="/alumnos"><ArrowLeft size={15} /> Volver a alumnos</Link>

      {student.is_demo ? (
        <div className="student-demo-notice">
          <strong>Expediente DEMO</strong>
          <span>Este alumno es ficticio. Puedes editar sus formatos libremente para probar estados, autoguardado e impresión.</span>
        </div>
      ) : null}

      <section className="student-profile-summary panel">
        <div className="student-profile-avatar"><UserRound size={26} /></div>
        <div><span>Alumno</span><strong>{student.full_name}</strong></div>
        <div><span>Grado / grupo</span><strong>{student.grade ?? "—"} {student.group_name ?? ""}</strong></div>
        <div><span>Nivel</span><strong>{student.level ?? "—"}</strong></div>
        <div><span>Matrícula</span><strong>{student.student_code ?? "—"}</strong></div>
      </section>

      <section className="panel student-info-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Datos base</p><h2>Información del alumno</h2></div>
        </div>
        <div className="student-info-grid">
          <article><UserRound size={17} /><div><span>Sexo</span><strong>{student.sex ?? "Sin dato"}</strong></div></article>
          <article><CalendarDays size={17} /><div><span>Fecha de nacimiento</span><strong>{formatDate(student.birth_date)}</strong></div></article>
          <article><GraduationCap size={17} /><div><span>Estado de inscripción</span><strong>{student.enrollment_status ?? "Sin dato"}</strong></div></article>
          <article><IdCard size={17} /><div><span>Estado del alumno</span><strong>{student.student_status ?? "Activo"}</strong></div></article>
          <article><CalendarDays size={17} /><div><span>Fecha de ingreso</span><strong>{formatDate(student.admission_date)}</strong></div></article>
          <article><FileText size={17} /><div><span>Origen</span><strong>{student.source_system ?? "Manual"}</strong></div></article>
        </div>
      </section>

      <section className="panel student-tutors-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Red de apoyo</p><h2>Tutores registrados</h2></div>
        </div>
        {tutors.length ? (
          <div className="student-tutor-grid">
            {tutors.map((tutor, index) => (
              <article key={`${tutor}-${index}`}>
                <span className="student-tutor-icon"><UsersRound size={17} /></span>
                <div><small>Tutor {index + 1}</small><strong>{tutor}</strong></div>
              </article>
            ))}
          </div>
        ) : <p className="student-empty-inline">Sin tutores registrados.</p>}
        {student.student_notes ? <div className="student-source-note"><strong>Notas de origen</strong><span>{student.student_notes}</span></div> : null}
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
        </div>
      </section>
    </StudentModuleLayout>
  );
}
