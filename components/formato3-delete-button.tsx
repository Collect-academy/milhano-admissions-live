"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import { removeFormato3Record } from "@/app/alumnos/actions";

export function Formato3DeleteButton({ studentId, recordId, empty }: { studentId: string; recordId: string; empty: boolean }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    if (inFlight.current) return;
    const confirmed = window.confirm(empty
      ? "¿Eliminar este documento vacío? Esta acción no se puede deshacer."
      : "¿Retirar este documento del historial? Se conservará archivado en la base de datos.");
    if (!confirmed) return;
    inFlight.current = true;
    setLoading(true);
    setError("");
    try {
      await removeFormato3Record({ studentId, recordId });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el documento.");
      inFlight.current = false;
      setLoading(false);
    }
  };

  return <span className="formato3-delete-area">
    <button className="formato3-delete-button" type="button" onClick={remove} disabled={loading}
      aria-label={empty ? "Eliminar documento vacío" : "Archivar documento (solo administración)"}
      title={empty ? "Eliminar documento vacío" : "Retirar del historial (solo Mona o Cinthia)"}>
      {loading ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
    </button>
    {error ? <small role="alert" className="formato3-delete-error">{error}</small> : null}
  </span>;
}
