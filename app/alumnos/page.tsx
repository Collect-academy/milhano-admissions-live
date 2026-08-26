import Link from "next/link";
import { Plus, Search, UserRound } from "lucide-react";

import { StudentModuleLayout } from "@/components/student-module-layout";
import { ConfidentialTooltip, StudentStatusIcon } from "@/components/student-status";
import { getStudentDirectory, requireStudentModuleContext } from "@/lib/student-records";
import type { StudentFormCode, StudentFormStatus } from "@/lib/student-forms";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

function formCell({
  studentId,
  label,
  formCode,
  status,
  canOpen,
}: {
  studentId: string;
  label: string;
  formCode: StudentFormCode;
  status: StudentFormStatus;
  canOpen: boolean;
}) {
  const number = formCode.slice(-1);
  const content = (
    <span className="student-form-status-content">
      <span>{label}</span>
      <StudentStatusIcon status={status} />
      {!canOpen ? <ConfidentialTooltip /> : null}
    </span>
  );

  return canOpen ? (
    <Link className="student-form-status-link" href={`/alumnos/${studentId}/formato-${number}`}>{content}</Link>
  ) : (
    <span className="student-form-status-link student-form-status-locked" title="Confidencial">{content}</span>
  );
}

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "" } = await searchParams;
  const [context, students] = await Promise.all([
    requireStudentModuleContext(),
    getStudentDirectory(q),
  ]);

  return (
    <StudentModuleLayout
      eyebrow="Expediente escolar"
      title="Alumnos"
      subtitle="Busca por nombre, apellidos, grado, grupo o tutor y revisa el avance de los cuatro formatos."
      statusLabel={`${students.length} alumnos`}
    >
      <section className="panel student-directory-panel">
        <div className="student-directory-actions">
          <form className="student-search" method="get">
            <Search size={18} />
            <input
              aria-label="Buscar alumnos"
              defaultValue={q}
              name="q"
              placeholder="Buscar nombre, apellido, grado, grupo o tutor…"
            />
          </form>
          {context.canManageStudents ? (
            <Link className="primary-button" href="/alumnos/nuevo">
              <Plus size={15} />
              Nuevo alumno
            </Link>
          ) : null}
        </div>

        <div className="student-status-legend">
          <span><StudentStatusIcon status="complete" /> Completo</span>
          <span><StudentStatusIcon status="incomplete" /> Faltan datos</span>
          <span><StudentStatusIcon status="none" /> Sin datos</span>
        </div>

        {students.length ? (
          <div className="table-scroll student-table-scroll">
            <table className="student-directory-table">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Grado</th>
                  <th>Formato 1</th>
                  <th>Formato 2</th>
                  <th>Formato 3</th>
                  <th>Formato 4</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.student_id}>
                    <td>
                      <Link className="student-name-link" href={`/alumnos/${student.student_id}`}>
                        <span className="student-avatar"><UserRound size={16} /></span>
                        <span>
                          <strong>{student.full_name}</strong>
                          <small>{student.tutor_name ? `Tutor: ${student.tutor_name}` : "Tutor pendiente"}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <strong>{student.grade ?? "—"}{student.group_name ? ` ${student.group_name}` : ""}</strong>
                      <span className="secondary-cell">{student.level ?? "Nivel pendiente"}</span>
                    </td>
                    <td>{formCell({ studentId: student.student_id, label: "Formato 1", formCode: "form_1", status: student.form_1_status, canOpen: context.permissions.form_1.can_view_content })}</td>
                    <td>{formCell({ studentId: student.student_id, label: "Formato 2", formCode: "form_2", status: student.form_2_status, canOpen: context.permissions.form_2.can_view_content })}</td>
                    <td>{formCell({ studentId: student.student_id, label: "Formato 3", formCode: "form_3", status: student.form_3_status, canOpen: context.permissions.form_3.can_view_content })}</td>
                    <td>{formCell({ studentId: student.student_id, label: "Formato 4", formCode: "form_4", status: student.form_4_status, canOpen: context.permissions.form_4.can_view_content })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="student-empty-state">
            <UserRound size={30} />
            <strong>No encontramos alumnos</strong>
            <span>{q ? "Prueba con otro término de búsqueda." : "Agrega el primer alumno para comenzar."}</span>
          </div>
        )}
      </section>
    </StudentModuleLayout>
  );
}
