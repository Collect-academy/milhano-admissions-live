"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Formato3Editor, type Formato3Document } from "@/components/formato3-editor";
import { saveFormato3Document } from "@/app/alumnos/actions";

export function Formato3DocumentView({ studentId, recordId, canEdit, initialPayload, initialSavedAt }: {
  studentId: string;
  recordId: string;
  canEdit: boolean;
  initialPayload: Record<string, unknown>;
  initialSavedAt: string;
}) {
  const [title, setTitle] = useState(typeof initialPayload.document_title === 'string' ? initialPayload.document_title : '');
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [savedTitle, setSavedTitle] = useState(title);
  const save = async (doc: Formato3Document) => {
    const result = await saveFormato3Document({ studentId, recordId, title, contentHtml: doc.content_html });
    setSavedAt(result.savedAt);
    setSavedTitle(title);
  };
  return <div className="student-editor-wrap">
    <div className="student-editor-toolbar no-print">
      <div className="student-save-indicator"><div><strong>Documento ligero · Formato 3</strong><span>Actualizado: {new Date(savedAt).toLocaleString('es-MX')}</span></div></div>
      <button className="secondary-button" type="button" onClick={() => window.print()}><Printer size={15}/> Imprimir / PDF</button>
    </div>
    <div className="student-document" style={{ padding: '24px 20px' }}>
      <label htmlFor="f3-title" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Título de la ficha</label>
      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <input id="f3-title" className="input" style={{ flex: 1, minWidth: 0, padding: 10, border: '1px solid #ccd3dc', borderRadius: 6 }} value={title} maxLength={120} disabled={!canEdit} onChange={e => setTitle(e.target.value)} placeholder="Ej. Informe de seguimiento" />

      </div>
      <h2 className="print-only">{title || 'Documento de Psicología'}</h2>

      <Formato3Editor initialHtml={typeof initialPayload.content_html === 'string' ? initialPayload.content_html : ''} readOnly={!canEdit} externalDirty={title !== savedTitle} onSave={save} />
      <p className="no-print" style={{ marginTop: 12, fontSize: 12, opacity: .7 }}>Sin archivos adjuntos ni imágenes. El contenido se almacena como texto ligero en el expediente del alumno.</p>
    </div>
  </div>;
}
