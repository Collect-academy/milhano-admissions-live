"use client";

import { useRef, useState } from "react";
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
  const inFlight = useRef(false);
  const [error, setError] = useState("");

  return (
    <div>
    <button
      className="primary-button"
      disabled={loading}
      onClick={async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        setLoading(true);
        setError("");
        try {
          const result = await createStudentFormRecord({ studentId, definitionCode, parentRecordId });
          router.push(`${hrefPrefix}/${result.id}`);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "No se pudo crear el documento.");
          inFlight.current = false;
          setLoading(false);
        }
      }}
      type="button"
    >
      {loading ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
      {label}
    </button>
    {error ? <small role="alert" style={{ display: "block", color: "#a12727", maxWidth: 260 }}>{error}</small> : null}
    </div>
  );
}
