"use client";

import { useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { createStudentFormRecord } from "@/app/alumnos/actions";
import type { StudentDefinitionCode } from "@/lib/student-forms";

export function CreateRecordButton({
  studentId,
  definitionCode,
  hrefPrefix,
  parentRecordId,
  label,
}: {
  studentId: string;
  definitionCode: StudentDefinitionCode;
  hrefPrefix: string;
  parentRecordId?: string | null;
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      className="primary-button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const result = await createStudentFormRecord({ studentId, definitionCode, parentRecordId });
          router.push(`${hrefPrefix}/${result.id}`);
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
      type="button"
    >
      {loading ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
      {label}
    </button>
  );
}
