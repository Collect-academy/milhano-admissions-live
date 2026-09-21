import Link from "next/link";
import { Plus, Search, UserRound } from "lucide-react";

import { StudentModuleLayout } from "@/components/student-module-layout";
import { ConfidentialTooltip, StudentStatusIcon } from "@/components/student-status";
import { getDashboardLocale } from "@/lib/i18n";
import { tr } from "@/lib/locale";
import {
  getStudentDirectory,
  getStudentDirectoryFilterOptions,
  requireStudentModuleContext,
} from "@/lib/student-records";
import type { StudentFormCode, StudentFormStatus } from "@/lib/student-forms";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; level?: string; grade?: string }>;

function formCell({
  studentId,
  label,
  formCode,
  status,
  canOpen,
  confidentialLabel,
}: {
  studentId: string;
  label: string;
  formCode: StudentFormCode;
  status: StudentFormStatus;
  canOpen: boolean;
  confidentialLabel: string;
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
    <span className="student-form-status-link student-form-status-locked" title={confidentialLabel}>{content}</span>
  );
}

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "", level = "", grade = "" } = await searchParams;
  const locale = await getDashboardLocale();
  const [context, students, filterOptions] = await Promise.all([
    requireStudentModuleContext(),
    getStudentDirectory(q, { level, grade }),
    getStudentDirectoryFilterOptions(),
  ]);
  const hasFilters = Boolean(q || level || grade);
  const confidentialLabel = tr(locale, "Confidential", "Confidencial");

  return (
    <StudentModuleLayout
      eyebrow={tr(locale, "School records", "Expediente escolar")}
      title={tr(locale, "Students", "Alumnos")}
      subtitle={tr(
        locale,
        "Search by name, surname, grade, group or guardian and review progress across the four forms.",
        "Busca por nombre, apellidos, grado, grupo o tutor y revisa el avance de los cuatro formatos.",
      )}
      statusLabel={`${students.length} ${tr(locale, "students", "alumnos")}`}
    >
      <section className="panel student-directory-panel">
        <div className="student-directory-actions student-directory-actions-filters">
          <form className="student-directory-filter-form" method="get">
            <label className="student-search">
              <Search size={18} />
              <input
                aria-label={tr(locale, "Search students", "Buscar alumnos")}
                defaultValue={q}
                name="q"
                placeholder={tr(
                  locale,
                  "Search name, surname, grade, group or guardian…",
                  "Buscar nombre, apellido, grado, grupo o tutor…",
                )}
              />
            </label>

            <label className="student-directory-select">
              <span>{tr(locale, "Level", "Nivel")}</span>
              <select defaultValue={level} name="level">
                <option value="">{tr(locale, "All levels", "Todos los niveles")}</option>
                {filterOptions.levels.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="student-directory-select">
              <span>{tr(locale, "Grade", "Grado")}</span>
              <select defaultValue={grade} name="grade">
                <option value="">{tr(locale, "All grades", "Todos los grados")}</option>
                {filterOptions.grades.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <div className="student-directory-filter-actions">
              <button className="primary-button" type="submit">
                {tr(locale, "Apply", "Aplicar")}
              </button>
              {hasFilters ? (
                <Link className="secondary-button" href="/alumnos">
                  {tr(locale, "Clear", "Limpiar")}
                </Link>
              ) : null}
            </div>
          </form>

          {context.canManageStudents ? (
            <Link className="primary-button student-new-button" href="/alumnos/nuevo">
              <Plus size={15} />
              {tr(locale, "New student", "Nuevo alumno")}
            </Link>
          ) : null}
        </div>

        <div className="student-status-legend">
          <span><StudentStatusIcon status="complete" /> {tr(locale, "Complete", "Completo")}</span>
          <span><StudentStatusIcon status="incomplete" /> {tr(locale, "Missing data", "Faltan datos")}</span>
          <span><StudentStatusIcon status="none" /> {tr(locale, "No data", "Sin datos")}</span>
        </div>

        {students.length ? (
          <div className="table-scroll student-table-scroll">
            <table className="student-directory-table">
              <thead>
                <tr>
                  <th>{tr(locale, "Student", "Alumno")}</th>
                  <th>{tr(locale, "Grade", "Grado")}</th>
                  <th>{tr(locale, "Form 1", "Formato 1")}</th>
                  <th>{tr(locale, "Form 2", "Formato 2")}</th>
                  <th>{tr(locale, "Form 3", "Formato 3")}</th>
                  <th>{tr(locale, "Form 4", "Formato 4")}</th>
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
                          <small>{student.tutor_name ? `${tr(locale, "Guardian", "Tutor")}: ${student.tutor_name}` : tr(locale, "Guardian pending", "Tutor pendiente")}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <strong>{student.grade ?? "—"}{student.group_name ? ` ${student.group_name}` : ""}</strong>
                      <span className="secondary-cell">{student.level ?? tr(locale, "Level pending", "Nivel pendiente")}</span>
                    </td>
                    <td>{formCell({ studentId: student.student_id, label: tr(locale, "Form 1", "Formato 1"), formCode: "form_1", status: student.form_1_status, canOpen: context.permissions.form_1.can_view_content, confidentialLabel })}</td>
                    <td>{formCell({ studentId: student.student_id, label: tr(locale, "Form 2", "Formato 2"), formCode: "form_2", status: student.form_2_status, canOpen: context.permissions.form_2.can_view_content, confidentialLabel })}</td>
                    <td>{formCell({ studentId: student.student_id, label: tr(locale, "Form 3", "Formato 3"), formCode: "form_3", status: student.form_3_status, canOpen: context.permissions.form_3.can_view_content, confidentialLabel })}</td>
                    <td>{formCell({ studentId: student.student_id, label: tr(locale, "Form 4", "Formato 4"), formCode: "form_4", status: student.form_4_status, canOpen: context.permissions.form_4.can_view_content, confidentialLabel })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="student-empty-state">
            <UserRound size={30} />
            <strong>{tr(locale, "No students found", "No encontramos alumnos")}</strong>
            <span>{hasFilters ? tr(locale, "Try different filters.", "Prueba con otros filtros.") : tr(locale, "Add the first student to get started.", "Agrega el primer alumno para comenzar.")}</span>
          </div>
        )}
      </section>
    </StudentModuleLayout>
  );
}
