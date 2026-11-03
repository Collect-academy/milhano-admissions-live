'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lightweight editor for Formato 3. No uploads or external editor dependencies.
 * Store its HTML in the existing milhano_student_form_records.payload as
 * { editor_version: 1, content_html: string, content_text: string }.
 * It is the responsibility of the calling route to authorize per-student access.
 */
export type Formato3Document = {
  editor_version: 1;
  content_html: string;
  content_text: string;
};

const ALLOWED = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE']);
const MAX_TEXT_LENGTH = 100_000;

function sanitizeRichText(input: string): string {
  if (typeof document === 'undefined') return '';
  const source = new DOMParser().parseFromString(input, 'text/html');
  const clean = document.createElement('div');
  function appendSafe(from: Node, into: Node) {
    if (from.nodeType === Node.TEXT_NODE) {
      into.appendChild(document.createTextNode(from.textContent ?? ''));
      return;
    }
    if (from.nodeType !== Node.ELEMENT_NODE) return;
    const element = from as HTMLElement;
    if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','IMG','VIDEO','AUDIO','FORM','INPUT'].includes(element.tagName)) return;
    const target = ALLOWED.has(element.tagName) ? document.createElement(element.tagName.toLowerCase()) : into;
    for (const child of Array.from(element.childNodes)) appendSafe(child, target);
    if (target !== into) into.appendChild(target);
  }
  for (const child of Array.from(source.body.childNodes)) appendSafe(child, clean);
  if ((clean.textContent ?? '').length > MAX_TEXT_LENGTH) throw new Error('El documento supera el límite de 100,000 caracteres.');
  return clean.innerHTML;
}

export function Formato3Editor({ initialHtml = '', readOnly = false, onSave, externalDirty = false }: {
  initialHtml?: string;
  readOnly?: boolean;
  onSave: (document: Formato3Document) => Promise<void>;
  externalDirty?: boolean;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!editor.current) return;
    // Only replace the document when switching records, never on every keystroke.
    editor.current.innerHTML = sanitizeRichText(initialHtml);
    setDirty(false);
    setMessage('');
  }, [initialHtml]);

  const format = useCallback((command: string, value?: string) => {
    if (readOnly || !editor.current) return;
    editor.current.focus();
    document.execCommand(command, false, value);
    setDirty(true);
  }, [readOnly]);

  const save = useCallback(async () => {
    if (!editor.current || saving || readOnly) return;
    setSaving(true);
    setMessage('');
    try {
      const content_html = sanitizeRichText(editor.current.innerHTML);
      const content_text = (editor.current.innerText ?? editor.current.textContent ?? '').trim();
      if (new TextEncoder().encode(content_html).length > 200_000) throw new Error('El documento supera el máximo de 200 KB.');
      await onSave({ editor_version: 1, content_html, content_text });
      setDirty(false);
      setMessage('Guardado correctamente');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }, [onSave, saving, readOnly]);

  return (
    <section aria-label="Formato 3: documento de psicología" style={{ maxWidth: 900, margin: '0 auto' }}>
      {!readOnly && <div role="toolbar" aria-label="Herramientas de formato" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, border: '1px solid #ddd', borderRadius: '8px 8px 0 0' }}>
        {([
          ['bold', 'Negrita'], ['italic', 'Cursiva'], ['underline', 'Subrayado'],
          ['insertUnorderedList', 'Lista'], ['insertOrderedList', 'Lista numerada'],
          ['formatBlock', 'Párrafo'], ['removeFormat', 'Quitar formato']
        ] as const).map(([cmd, label]) => (
          <button key={cmd} type="button" onMouseDown={e => e.preventDefault()}
            onClick={() => format(cmd, cmd === 'formatBlock' ? 'p' : undefined)}
            style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>}
      <div ref={editor} contentEditable={!readOnly} suppressContentEditableWarning
        aria-label="Contenido del documento" role="textbox" aria-multiline="true"
        onInput={() => { setDirty(true); setMessage(''); }}
        onPaste={e => { // Plain-text paste: no embedded files, images, styles or external HTML.
          if (readOnly) return;
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain').slice(0, MAX_TEXT_LENGTH);
          document.execCommand('insertText', false, text);
        }}
        onDrop={e => e.preventDefault()}
        onBeforeInput={e => { if ((e.nativeEvent as InputEvent).inputType === 'insertFromDrop') e.preventDefault(); }}
        style={{ minHeight: 460, padding: 28, border: '1px solid #ddd', borderTop: readOnly ? undefined : 'none', background: '#fff', outlineOffset: -2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
        <small aria-live="polite">{message || (dirty || externalDirty ? 'Cambios sin guardar' : '')}</small>
        {!readOnly && <button type="button" onClick={save} disabled={(!dirty && !externalDirty) || saving}
          style={{ padding: '9px 18px', borderRadius: 6, background: '#18375c', color: '#fff', opacity: (!dirty && !externalDirty) || saving ? .5 : 1 }}>
          {saving ? 'Guardando…' : 'Guardar documento'}
        </button>}
      </div>
    </section>
  );
}
