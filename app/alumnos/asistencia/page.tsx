import { AttendanceBoard } from "@/components/attendance-board";
import { AttendanceFilter } from "@/components/attendance-filter";
import { StudentModuleLayout } from "@/components/student-module-layout";
import { getAttendanceDay, getAttendanceGrades } from "@/lib/student-attendance";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function todayMerida() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Merida", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function validDate(value?: string) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayMerida(); }

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams; const date = validDate(one(params.date)); const grade = one(params.grade) ?? "";
  const [students, grades] = await Promise.all([getAttendanceDay(date, grade), getAttendanceGrades()]);
  return <StudentModuleLayout eyebrow="Alumnos" title="Lista de asistencia" subtitle="Marca ✓, ✕ o deja en blanco. Puedes abrir cualquier fecha y guardar notas por alumno." statusLabel={`${date} · ${students.length} alumnos`}>
    <AttendanceFilter date={date} grade={grade} grades={grades} />
    <AttendanceBoard date={date} initialStudents={students} />
  </StudentModuleLayout>;
}
