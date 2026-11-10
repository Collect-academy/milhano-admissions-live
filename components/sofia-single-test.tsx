"use client";

import { useEffect, useState } from "react";

type TestRecord = {
  status: string;
  provider_status: string | null;
  conversation_id: string | null;
  requested_at: string;
  updated_at: string;
};
const statusLabel: Record<string,string> = {
  claimed: "En proceso. No se puede reenviar.",
  permission_requested: "Autorización enviada a ElevenLabs. WhatsApp puede quedar pendiente de aceptación.",
  blocked: "Bloqueada por validaciones del workflow.",
  needs_review: "Resultado incierto. Revisar n8n antes de intentar otra vez.",
};

export function SofiaSingleTest() {
  const [result,setResult] = useState<TestRecord|null>(null);
  const [loading,setLoading] = useState(true);
  const [sending,setSending] = useState(false);
  const [message,setMessage] = useState<string|null>(null);
  useEffect(()=>{
    let alive=true;
    fetch("/api/sofia/test-single",{cache:"no-store"}).then(r=>r.json()).then(x=>{
      if(alive){setResult(x.sent??null);if(x.error)setMessage(x.error);}
    }).catch(()=>{if(alive)setMessage("No se pudo consultar el historial de pruebas.");})
    .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[]);
  async function send() {
    if(sending||result) return;
    if(!window.confirm("¿Enviar una solicitud real de autorización por WhatsApp únicamente a la oportunidad Manquito Testing?")) return;
    setSending(true);setMessage(null);
    try {
      const response=await fetch("/api/sofia/test-single",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({confirm:"ENVIAR_PRUEBA_MANQUITO"}),
      });
      const json=await response.json();
      setMessage(json.message??json.error??"Solicitud procesada.");
      const refreshed=await fetch("/api/sofia/test-single",{cache:"no-store"}).then(r=>r.json());
      setResult(refreshed.sent??null);
      if(!response.ok && !refreshed.sent)setMessage("No se confirmó la prueba. No vuelvas a enviarla sin revisar n8n.");
    } catch {
      setMessage("Resultado incierto. No vuelvas a enviar hasta consultar el registro.");
    } finally {setSending(false);}
  }
  return (
    <section className="panel sofia-test-section">
      <div className="sofia-panel-title">
        <h2>Prueba en vivo · 1 autorización</h2>
        <span className="sofia-count">Solo Manquito Testing</span>
      </div>
      <p className="subtitle">Oportunidad verificada directamente en GHL, en <strong>New Lead</strong> del pipeline Setter. Esta prueba usa a Sofía en <strong>ElevenLabs main</strong> y no modifica el lote programado de mañana.</p>
      <div className="sofia-metric-line"><span>Oportunidad</span><strong>Manquito Testing</strong></div>
      <div className="sofia-metric-line"><span>Contacto de prueba</span><strong>Teléfono terminado en 0157</strong></div>
      <div className="sofia-metric-line"><span>Acción</span><strong>Enviar 1 solicitud de autorización de llamada</strong></div>
      {result ? (
        <p role="status" className={result.status==="permission_requested"?"sofia-ok":"sofia-error"}>
          {statusLabel[result.status]??result.status}
          {result.conversation_id ? " · Conversación: "+result.conversation_id : ""}
        </p>
      ) : <button type="button" className="primary-button" disabled={loading||sending}
         onClick={send}>{loading?"Comprobando...":sending?"Enviando...":"Enviar autorización de prueba ahora"}</button>}
      {message?<p role="status" className="sofia-caveat">{message}</p>:null}
      <p className="sofia-caveat">El botón realiza una solicitud real por WhatsApp, una sola vez. Que ElevenLabs acepte la solicitud no significa que la persona ya haya contestado la llamada.</p>
    </section>
  );
}
