import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

import { createStudent } from "@/app/alumnos/actions";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { requireStudentModuleContext } from "@/lib/student-records";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  const context = await requireStudentModuleContext();

  return (
    <StudentModuleLayout
      eyebrow="Directorio"
      title="Nuevo alumno"
      subtitle="Crea el expediente base. Los cuatro formatos se llenan después desde el perfil del alumno."
      statusLabel="Alta manual"
    >
      <Link className="secondary-button inline-back-link" href="/alumnos"><ArrowLeft size={15} /> Volver a alumnos</Link>

      {!context.canManageStudents ? (
        <section className="panel"><strong>No tienes permiso para crear alumnos.</strong></section>
      ) : (
        <form action={createStudent} className="panel student-create-form">
          <div className="student-section-heading">
            <h2>Datos del alumno</h2>
            <p>Nombre y apellidos son los únicos campos imprescindibles para crear el expediente.</p>
          </div>
          <div className="student-form-grid">
            <label className="student-form-field student-field-half"><span>Nombre(s) *</span><input name="first_name" required /></label>
            <label className="student-form-field student-field-half"><span>Apellidos *</span><input name="last_name" required /></label>
            <label className="student-form-field"><span>Matrícula / ID interno</span><input name="student_code" /></label>
            <label className="student-form-field student-field-half"><span>Nivel</span><select name="level" defaultValue=""><option value="">Seleccionar…</option><option>Primaria</option><option>Secundaria</option><option>Preparatoria</option></select></label>
            <label className="student-form-field student-field-half"><span>Grado</span><input name="grade" placeholder="Ej. 5TO" /></label>
            <label className="student-form-field student-field-half"><span>Grupo</span><input name="group_name" placeholder="Ej. A" /></label>
            <label className="student-form-field student-field-half"><span>Sexo</span><select name="sex" defaultValue=""><option value="">Seleccionar…</option><option>Femenino</option><option>Masculino</option></select></label>
            <label className="student-form-field student-field-half"><span>Estado de inscripción</span><select name="enrollment_status" defaultValue=""><option value="">Seleccionar…</option><option>Inscrito</option><option>Reinscrito</option><option>Pendiente</option></select></label>
            <label className="student-form-field student-field-half"><span>Fecha de nacimiento</span><input name="birth_date" type="date" /></label>
            <label className="student-form-field student-field-half"><span>Fecha de ingreso</span><input name="admission_date" type="date" /></label>
            <label className="student-form-field"><span>Tutor 1</span><input name="tutor_name" /></label>
            <label className="student-form-field"><span>Correo del tutor 1</span><input name="tutor_email" type="email" /></label>
            <label className="student-form-field"><span>Teléfono del tutor 1</span><input name="tutor_phone" /></label>
            <label className="student-form-field"><span>Tutor 2</span><input name="tutor_2_name" /></label>
            <label className="student-form-field"><span>Tutor 3</span><input name="tutor_3_name" /></label>
            <label className="student-form-field student-field-full"><span>Notas</span><textarea name="student_notes" /></label>
            <label className="student-form-field"><span>Foto (URL, opcional)</span><input name="photo_url" type="url" /></label>
          </div>
          <div className="student-create-actions"><button className="primary-button" type="submit"><Save size={15} /> Crear expediente</button></div>
        </form>
      )}
    </StudentModuleLayout>
  );
}
