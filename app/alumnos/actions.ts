"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStudentModuleContext, getStudent } from "@/lib/student-records";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StudentDefinitionCode, StudentPayload } from "@/lib/student-forms";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function definitionFormCode(definitionCode: StudentDefinitionCode) {
  if (definitionCode === "form_1_profile") return "form_1" as const;
  if (definitionCode === "form_2_observation") return "form_2" as const;
  if (definitionCode === "form_3_evaluation") return "form_3" as const;
  return "form_4" as const;
}

export async function createStudent(formData: FormData) {
  const context = await requireStudentModuleContext();
  if (!context.canManageStudents) throw new Error("No tienes permiso para crear alumnos.");

  const firstName = text(formData, "first_name");
  const lastName = text(formData, "last_name");
  if (!firstName || !lastName) throw new Error("Nombre y apellidos son requeridos.");

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("milhano_students")
    .insert({
      first_name: firstName,
      last_name: lastName,
      student_code: text(formData, "student_code") || null,
      level: text(formData, "level") || null,
      grade: text(formData, "grade") || null,
      group_name: text(formData, "group_name") || null,
      tutor_name: text(formData, "tutor_name") || null,
      tutor_email: text(formData, "tutor_email") || null,
      tutor_phone: text(formData, "tutor_phone") || null,
      photo_url: text(formData, "photo_url") || null,
    })
    .select("id")
    .single();

  if (result.error) throw new Error(`No se pudo crear el alumno: ${result.error.message}`);
  revalidatePath("/alumnos");
  redirect(`/alumnos/${result.data.id}`);
}

export async function createStudentFormRecord(input: {
  studentId: string;
  definitionCode: StudentDefinitionCode;
  parentRecordId?: string | null;
}) {
  const context = await requireStudentModuleContext();
  const formCode = definitionFormCode(input.definitionCode);
  if (!context.permissions[formCode].can_edit) throw new Error("No tienes permiso para editar este formato.");

  const student = await getStudent(input.studentId);
  const date = today();
  let payload: StudentPayload = {};
  let sequenceNo: number | null = null;

  if (input.definitionCode === "form_2_observation") {
    payload = {
      observation_date: date,
      grade_group: [student.grade, student.group_name].filter(Boolean).join(" "),
    };
  } else if (input.definitionCode === "form_3_evaluation") {
    payload = { evaluation_date: date, evaluation_type: "Evaluación inicial" };
  } else if (input.definitionCode === "form_4_piap") {
    payload = {
      elaboration_date: date,
      student_name: student.full_name,
      grade_group: [student.grade, student.group_name].filter(Boolean).join(" "),
      level: student.level ?? "",
      psychologist_in_charge: "Psic. Ricardo Soxme Pool",
      psychologist_name: "Psic. Ricardo Soxme Pool",
      teacher_tutor: student.tutor_name ?? "",
    };
  } else if (input.definitionCode === "form_4_review") {
    if (!input.parentRecordId) throw new Error("La revisión requiere un PIAP padre.");
    const supabaseForSequence = await createSupabaseServerClient();
    const sequenceResult = await supabaseForSequence
      .from("milhano_student_form_records")
      .select("sequence_no")
      .eq("student_id", input.studentId)
      .eq("definition_code", "form_4_review")
      .eq("parent_record_id", input.parentRecordId)
      .eq("is_archived", false)
      .order("sequence_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sequenceResult.error) throw new Error(sequenceResult.error.message);
    sequenceNo = (sequenceResult.data?.sequence_no ?? 0) + 1;
    payload = { review_date: date };
  }

  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("milhano_student_form_records")
    .insert({
      student_id: input.studentId,
      definition_code: input.definitionCode,
      parent_record_id: input.parentRecordId ?? null,
      sequence_no: sequenceNo,
      occurred_on: date,
      payload,
    })
    .select("id")
    .single();

  if (result.error) throw new Error(`No se pudo crear el registro: ${result.error.message}`);
  revalidatePath(`/alumnos/${input.studentId}`);
  revalidatePath(`/alumnos/${input.studentId}/formato-${formCode.slice(-1)}`);
  return { id: result.data.id };
}

function deriveOccurredOn(definitionCode: StudentDefinitionCode, payload: StudentPayload): string | null {
  const key = definitionCode === "form_2_observation"
    ? "observation_date"
    : definitionCode === "form_3_evaluation"
      ? "evaluation_date"
      : definitionCode === "form_4_piap"
        ? "elaboration_date"
        : definitionCode === "form_4_review"
          ? "review_date"
          : null;
  if (!key) return null;
  const value = payload[key];
  return typeof value === "string" && value ? value : null;
}

function buildTitle(definitionCode: StudentDefinitionCode, payload: StudentPayload, occurredOn: string | null, sequenceNo?: number | null) {
  const dateLabel = occurredOn ? ` · ${occurredOn}` : "";
  if (definitionCode === "form_1_profile") return "Perfil del alumno";
  if (definitionCode === "form_2_observation") {
    const subject = typeof payload.subject_activity === "string" && payload.subject_activity.trim()
      ? payload.subject_activity.trim()
      : "Observación";
    return `${subject}${dateLabel}`;
  }
  if (definitionCode === "form_3_evaluation") {
    const kind = typeof payload.evaluation_type === "string" && payload.evaluation_type.includes("Reevaluación")
      ? "Reevaluación"
      : "Evaluación inicial";
    return `${kind}${dateLabel}`;
  }
  if (definitionCode === "form_4_piap") return `PIAP${dateLabel}`;
  return `${sequenceNo ?? 1}ª revisión${dateLabel}`;
}

export async function saveStudentFormRecord(input: {
  recordId: string | null;
  studentId: string;
  definitionCode: StudentDefinitionCode;
  payload: StudentPayload;
}) {
  const context = await requireStudentModuleContext();
  const formCode = definitionFormCode(input.definitionCode);
  if (!context.permissions[formCode].can_edit) throw new Error("No tienes permiso para editar este formato.");

  const supabase = await createSupabaseServerClient();
  const occurredOn = deriveOccurredOn(input.definitionCode, input.payload);
  let recordId = input.recordId;
  let sequenceNo: number | null = null;

  if (recordId) {
    const currentResult = await supabase
      .from("milhano_student_form_records")
      .select("sequence_no")
      .eq("id", recordId)
      .eq("student_id", input.studentId)
      .maybeSingle();
    if (currentResult.error) throw new Error(currentResult.error.message);
    sequenceNo = currentResult.data?.sequence_no ?? null;
  }

  const title = buildTitle(input.definitionCode, input.payload, occurredOn, sequenceNo);

  if (!recordId) {
    const insert = await supabase
      .from("milhano_student_form_records")
      .insert({
        student_id: input.studentId,
        definition_code: input.definitionCode,
        payload: input.payload,
        occurred_on: occurredOn,
        title,
      })
      .select("id, completion_status, updated_at")
      .single();
    if (insert.error) throw new Error(`No se pudo guardar el formato: ${insert.error.message}`);
    recordId = insert.data.id;
    revalidatePath(`/alumnos/${input.studentId}`);
    revalidatePath("/alumnos");
    return { ok: true, recordId, status: insert.data.completion_status, savedAt: insert.data.updated_at };
  }

  const update = await supabase
    .from("milhano_student_form_records")
    .update({ payload: input.payload, occurred_on: occurredOn, title })
    .eq("id", recordId)
    .eq("student_id", input.studentId)
    .select("id, completion_status, updated_at")
    .single();

  if (update.error) throw new Error(`No se pudo guardar el formato: ${update.error.message}`);
  revalidatePath(`/alumnos/${input.studentId}`);
  revalidatePath("/alumnos");
  return { ok: true, recordId, status: update.data.completion_status, savedAt: update.data.updated_at };
}
