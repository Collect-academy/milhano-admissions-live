import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { requireCurrentAppUser, type CurrentAppUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StudentFormCode, StudentFormStatus, StudentPayload } from "@/lib/student-forms";

export type StudentDirectoryRow = {
  student_id: string;
  student_code: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  level: string | null;
  grade: string | null;
  group_name: string | null;
  tutor_name: string | null;
  photo_url: string | null;
  is_active: boolean;
  form_1_status: StudentFormStatus;
  form_2_status: StudentFormStatus;
  form_3_status: StudentFormStatus;
  form_4_status: StudentFormStatus;
};

export type StudentRow = {
  id: string;
  student_code: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  level: string | null;
  grade: string | null;
  group_name: string | null;
  tutor_name: string | null;
  tutor_email: string | null;
  tutor_phone: string | null;
  photo_url: string | null;
  photo_path: string | null;
  is_active: boolean;
};

export type StudentFormPermission = {
  form_code: StudentFormCode;
  can_view_content: boolean;
  can_edit: boolean;
};

export type StudentFormRecord = {
  id: string;
  student_id: string;
  definition_code: string;
  parent_record_id: string | null;
  sequence_no: number | null;
  title: string;
  occurred_on: string | null;
  payload: StudentPayload;
  completion_status: "empty" | "incomplete" | "complete";
  created_at: string;
  updated_at: string;
};

export type StudentModuleContext = {
  user: CurrentAppUser;
  canManageStudents: boolean;
  permissions: Record<StudentFormCode, StudentFormPermission>;
};

const defaultPermission = (formCode: StudentFormCode): StudentFormPermission => ({
  form_code: formCode,
  can_view_content: false,
  can_edit: false,
});

export const requireStudentModuleContext = cache(async (): Promise<StudentModuleContext> => {
  const user = await requireCurrentAppUser();
  const supabase = await createSupabaseServerClient();

  const [moduleAccessResult, permissionsResult] = await Promise.all([
    supabase
      .from("milhano_student_module_access")
      .select("can_access, can_manage_students")
      .eq("app_user_id", user.id)
      .maybeSingle(),
    supabase
      .from("milhano_student_form_permissions")
      .select("form_code, can_view_content, can_edit")
      .eq("app_user_id", user.id),
  ]);

  if (moduleAccessResult.error) {
    throw new Error(`No se pudo validar el acceso al expediente escolar: ${moduleAccessResult.error.message}`);
  }

  if (!moduleAccessResult.data?.can_access) {
    redirect("/?error=student-module-access");
  }

  if (permissionsResult.error) {
    throw new Error(`No se pudieron cargar los permisos de formatos: ${permissionsResult.error.message}`);
  }

  const permissions: Record<StudentFormCode, StudentFormPermission> = {
    form_1: defaultPermission("form_1"),
    form_2: defaultPermission("form_2"),
    form_3: defaultPermission("form_3"),
    form_4: defaultPermission("form_4"),
  };

  for (const row of permissionsResult.data ?? []) {
    const code = row.form_code as StudentFormCode;
    permissions[code] = {
      form_code: code,
      can_view_content: Boolean(row.can_view_content),
      can_edit: Boolean(row.can_edit),
    };
  }

  return {
    user,
    canManageStudents: Boolean(moduleAccessResult.data.can_manage_students),
    permissions,
  };
});

export async function getStudentDirectory(query = ""): Promise<StudentDirectoryRow[]> {
  await requireStudentModuleContext();
  const supabase = await createSupabaseServerClient();

  let request = supabase
    .from("vw_milhano_student_directory")
    .select("student_id, student_code, first_name, last_name, full_name, level, grade, group_name, tutor_name, photo_url, is_active, form_1_status, form_2_status, form_3_status, form_4_status")
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(500);

  const normalized = query.trim().replace(/[(),]/g, " ");
  if (normalized) {
    request = request.or(
      `full_name.ilike.%${normalized}%,last_name.ilike.%${normalized}%,grade.ilike.%${normalized}%,group_name.ilike.%${normalized}%,level.ilike.%${normalized}%,tutor_name.ilike.%${normalized}%`,
    );
  }

  const result = await request;
  if (result.error) {
    throw new Error(`No se pudo cargar el directorio de alumnos: ${result.error.message}`);
  }

  return (result.data ?? []) as StudentDirectoryRow[];
}

export async function getStudent(studentId: string): Promise<StudentRow> {
  await requireStudentModuleContext();
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("milhano_students")
    .select("id, student_code, first_name, last_name, full_name, level, grade, group_name, tutor_name, tutor_email, tutor_phone, photo_url, photo_path, is_active")
    .eq("id", studentId)
    .eq("is_active", true)
    .maybeSingle();

  if (result.error) {
    throw new Error(`No se pudo cargar el alumno: ${result.error.message}`);
  }
  if (!result.data) notFound();
  return result.data as StudentRow;
}

export async function getStudentDirectoryRow(studentId: string): Promise<StudentDirectoryRow> {
  await requireStudentModuleContext();
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("vw_milhano_student_directory")
    .select("student_id, student_code, first_name, last_name, full_name, level, grade, group_name, tutor_name, photo_url, is_active, form_1_status, form_2_status, form_3_status, form_4_status")
    .eq("student_id", studentId)
    .maybeSingle();

  if (result.error) throw new Error(`No se pudo cargar el estado del alumno: ${result.error.message}`);
  if (!result.data) notFound();
  return result.data as StudentDirectoryRow;
}

export async function getStudentFormRecords(
  studentId: string,
  definitionCode: string,
  parentRecordId?: string | null,
): Promise<StudentFormRecord[]> {
  const context = await requireStudentModuleContext();
  const formCode = definitionCode.startsWith("form_1")
    ? "form_1"
    : definitionCode.startsWith("form_2")
      ? "form_2"
      : definitionCode.startsWith("form_3")
        ? "form_3"
        : "form_4";

  if (!context.permissions[formCode].can_view_content) return [];

  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from("milhano_student_form_records")
    .select("id, student_id, definition_code, parent_record_id, sequence_no, title, occurred_on, payload, completion_status, created_at, updated_at")
    .eq("student_id", studentId)
    .eq("definition_code", definitionCode)
    .eq("is_archived", false)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (parentRecordId !== undefined) {
    request = parentRecordId === null
      ? request.is("parent_record_id", null)
      : request.eq("parent_record_id", parentRecordId);
  }

  const result = await request;
  if (result.error) {
    throw new Error(`No se pudieron cargar los registros del formato: ${result.error.message}`);
  }
  return (result.data ?? []) as StudentFormRecord[];
}

export async function getStudentFormRecord(
  studentId: string,
  recordId: string,
): Promise<StudentFormRecord> {
  await requireStudentModuleContext();
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("milhano_student_form_records")
    .select("id, student_id, definition_code, parent_record_id, sequence_no, title, occurred_on, payload, completion_status, created_at, updated_at")
    .eq("id", recordId)
    .eq("student_id", studentId)
    .eq("is_archived", false)
    .maybeSingle();

  if (result.error) {
    throw new Error(`No se pudo cargar el registro: ${result.error.message}`);
  }
  if (!result.data) notFound();
  return result.data as StudentFormRecord;
}


export type StudentNote = {
  id: string;
  student_id: string;
  occurred_on: string;
  category: "convivencia" | "clase" | "personal" | "academico" | "otro";
  title: string | null;
  note: string;
  author_label: string;
  created_at: string;
};

export async function getStudentNotes(studentId: string): Promise<StudentNote[]> {
  await requireStudentModuleContext();
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("milhano_student_notes")
    .select("id, student_id, occurred_on, category, title, note, author_label, created_at")
    .eq("student_id", studentId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) throw new Error(`No se pudo cargar la bitácora del alumno: ${result.error.message}`);
  return (result.data ?? []) as StudentNote[];
}

export async function getStudentPhotoSignedUrl(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;
  const supabase = await createSupabaseServerClient();
  const result = await supabase.storage.from("student-photos").createSignedUrl(photoPath, 3600);
  if (result.error) return null;
  return result.data.signedUrl;
}
