"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Cloud, LoaderCircle, Plus, Printer, Trash2, TriangleAlert } from "lucide-react";

import { saveStudentFormRecord } from "@/app/alumnos/actions";
import {
  completionProgress,
  type AbcEntry,
  type StudentDefinitionCode,
  type StudentFieldValue,
  type StudentFormDefinition,
  type StudentPayload,
  valueIsFilled,
} from "@/lib/student-forms";

type Props = {
  studentId: string;
  definition: StudentFormDefinition;
  recordId: string | null;
  initialPayload: StudentPayload;
  initialStatus: "empty" | "incomplete" | "complete";
  initialSavedAt?: string | null;
  canEdit: boolean;
};

function stringValue(value: StudentFieldValue | undefined): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function arrayValue(value: StudentFieldValue | undefined): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value as string[] : [];
}

function abcValue(value: StudentFieldValue | undefined): AbcEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AbcEntry => Boolean(item && typeof item === "object" && !Array.isArray(item)));
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return "Aún no guardado";
  try {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function StudentFormEditor({
  studentId,
  definition,
  recordId: initialRecordId,
  initialPayload,
  initialStatus,
  initialSavedAt,
  canEdit,
}: Props) {
  const [payload, setPayload] = useState<StudentPayload>(initialPayload);
  const [recordId, setRecordId] = useState<string | null>(initialRecordId);
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const lastSavedPayload = useRef(JSON.stringify(initialPayload));
  const latestPayload = useRef(payload);
  latestPayload.current = payload;

  const progress = useMemo(() => completionProgress(definition, payload), [definition, payload]);

  const persist = useCallback(async (nextPayload: StudentPayload) => {
    if (!canEdit) return;
    const serialized = JSON.stringify(nextPayload);
    if (serialized === lastSavedPayload.current) return;

    setSaveState("saving");
    setError(null);
    try {
      const result = await saveStudentFormRecord({
        recordId,
        studentId,
        definitionCode: definition.code as StudentDefinitionCode,
        payload: nextPayload,
      });
      setRecordId(result.recordId);
      setStatus(result.status as "empty" | "incomplete" | "complete");
      setSavedAt(result.savedAt);
      lastSavedPayload.current = serialized;
      setSaveState("saved");
    } catch (saveError) {
      setSaveState("error");
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el formato.");
    }
  }, [canEdit, definition.code, recordId, studentId]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!canEdit) return;
    if (JSON.stringify(payload) === lastSavedPayload.current) return;

    setSaveState("dirty");
    const timer = window.setTimeout(() => {
      void persist(latestPayload.current);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [payload, canEdit, persist]);

  const setValue = (key: string, value: StudentFieldValue) => {
    if (!canEdit) return;
    setPayload((current) => ({ ...current, [key]: value }));
  };

  const toggleCheckbox = (key: string, option: string) => {
    const current = arrayValue(payload[key]);
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    setValue(key, next);
  };

  const updateAbc = (key: string, index: number, field: keyof AbcEntry, value: string) => {
    const current = abcValue(payload[key]);
    const next = current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry);
    setValue(key, next);
  };

  const addAbc = (key: string) => {
    setValue(key, [...abcValue(payload[key]), { time: "", antecedent: "", behavior: "", consequence: "" }]);
  };

  const removeAbc = (key: string, index: number) => {
    setValue(key, abcValue(payload[key]).filter((_, entryIndex) => entryIndex !== index));
  };

  const flushSave = () => void persist(latestPayload.current);

  return (
    <div className="student-editor-wrap">
      <div className="student-editor-toolbar no-print">
        <div className="student-save-indicator">
          {saveState === "saving" ? <LoaderCircle className="spin" size={16} /> : null}
          {saveState === "saved" || saveState === "idle" ? <Cloud size={16} /> : null}
          {saveState === "dirty" ? <LoaderCircle size={16} /> : null}
          {saveState === "error" ? <TriangleAlert size={16} /> : null}
          <div>
            <strong>
              {saveState === "saving" ? "Guardando…" : saveState === "dirty" ? "Cambios pendientes" : saveState === "error" ? "Error al guardar" : "Autoguardado activo"}
            </strong>
            <span>Último guardado: {dateTimeLabel(savedAt)}</span>
          </div>
        </div>

        <div className="student-toolbar-actions">
          <span className={`student-completion-pill student-completion-${status}`}>
            {status === "complete" ? <Check size={14} /> : <TriangleAlert size={14} />}
            {progress.completed}/{progress.total} campos
          </span>
          {canEdit ? (
            <button className="secondary-button" onClick={flushSave} type="button">Guardar ahora</button>
          ) : null}
          <button className="secondary-button" onClick={() => window.print()} type="button">
            <Printer size={15} />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {error ? <div className="student-save-error no-print">{error}</div> : null}

      <article className="student-document">
        <div className="student-document-title print-only">
          <strong>Milhano</strong>
          <h1>{definition.title}</h1>
        </div>

        {definition.sections.map((section) => (
          <section className="student-form-section" key={section.title}>
            <div className="student-section-heading">
              <h2>{section.title}</h2>
              {section.description ? <p>{section.description}</p> : null}
            </div>

            <div className="student-form-grid">
              {section.fields.map((field) => {
                const value = payload[field.key];
                const filled = valueIsFilled(value);
                const classes = `student-form-field ${field.span === "half" ? "student-field-half" : ""}`;

                if (field.type === "checkboxGroup") {
                  const selected = arrayValue(value);
                  return (
                    <fieldset className={`${classes} student-field-full`} key={field.key}>
                      <legend>{field.label} <span className={filled ? "required-ok" : "required-missing"}>*</span></legend>
                      <div className="student-checkbox-grid">
                        {(field.options ?? []).map((option) => (
                          <label key={option}>
                            <input
                              checked={selected.includes(option)}
                              disabled={!canEdit}
                              onChange={() => toggleCheckbox(field.key, option)}
                              type="checkbox"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                }

                if (field.type === "abc") {
                  const entries = abcValue(value);
                  return (
                    <div className={`${classes} student-field-full`} key={field.key}>
                      <div className="student-field-label-row">
                        <span>{field.label} <span className={filled ? "required-ok" : "required-missing"}>*</span></span>
                        {canEdit ? (
                          <button className="secondary-button no-print" onClick={() => addAbc(field.key)} type="button">
                            <Plus size={14} /> Agregar registro
                          </button>
                        ) : null}
                      </div>
                      {entries.length ? (
                        <div className="abc-table-wrap">
                          <table className="abc-table">
                            <thead><tr><th>Hora</th><th>Antecedente</th><th>Conducta observable</th><th>Consecuencia</th>{canEdit ? <th className="no-print" /> : null}</tr></thead>
                            <tbody>
                              {entries.map((entry, index) => (
                                <tr key={index}>
                                  <td><input disabled={!canEdit} onChange={(event) => updateAbc(field.key, index, "time", event.target.value)} type="time" value={entry.time} /></td>
                                  <td><textarea disabled={!canEdit} onChange={(event) => updateAbc(field.key, index, "antecedent", event.target.value)} value={entry.antecedent} /></td>
                                  <td><textarea disabled={!canEdit} onChange={(event) => updateAbc(field.key, index, "behavior", event.target.value)} value={entry.behavior} /></td>
                                  <td><textarea disabled={!canEdit} onChange={(event) => updateAbc(field.key, index, "consequence", event.target.value)} value={entry.consequence} /></td>
                                  {canEdit ? <td className="no-print"><button className="icon-button" onClick={() => removeAbc(field.key, index)} type="button"><Trash2 size={14} /></button></td> : null}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="student-empty-inline">Sin registros A-B-C.</p>}
                    </div>
                  );
                }

                return (
                  <label className={classes} key={field.key}>
                    <span>{field.label} <span className={filled ? "required-ok" : "required-missing"}>*</span></span>
                    {field.helper ? <small>{field.helper}</small> : null}
                    {field.type === "textarea" ? (
                      <textarea
                        disabled={!canEdit}
                        onBlur={flushSave}
                        onChange={(event) => setValue(field.key, event.target.value)}
                        placeholder={field.placeholder}
                        value={stringValue(value)}
                      />
                    ) : field.type === "select" || field.type === "scale" ? (
                      <select
                        disabled={!canEdit}
                        onBlur={flushSave}
                        onChange={(event) => setValue(field.key, event.target.value)}
                        value={stringValue(value)}
                      >
                        <option value="">Seleccionar…</option>
                        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input
                        disabled={!canEdit}
                        min={field.type === "number" ? 0 : undefined}
                        onBlur={flushSave}
                        onChange={(event) => setValue(field.key, field.type === "number" && event.target.value ? Number(event.target.value) : event.target.value)}
                        placeholder={field.placeholder}
                        type={field.type}
                        value={stringValue(value)}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
