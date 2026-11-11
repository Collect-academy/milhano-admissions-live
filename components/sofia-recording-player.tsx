"use client";
import { useEffect, useState } from "react";

export function SofiaRecordingPlayer({conversationId}:{conversationId:string}){
 const [url,setUrl]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 async function load(){
   if(busy||url)return;
   setBusy(true);setError("");
   try{
     const response=await fetch("/api/sofia/conversations/"+encodeURIComponent(conversationId)+"/audio",{cache:"no-store"});
     if(!response.ok){const e=await response.json().catch(()=>({error:"No se pudo obtener la grabación."}));throw new Error(e.error??"No se pudo obtener la grabación.");}
     const blob=await response.blob();
     if(!blob.type.startsWith("audio/"))throw new Error("ElevenLabs no devolvió un archivo de audio compatible.");
     setUrl(URL.createObjectURL(blob));
   }catch(e){setError(e instanceof Error?e.message:"Audio no disponible.");}
   finally{setBusy(false);}
 }
 return <div style={{marginTop:8}}>
  {url?<audio controls preload="none" src={url} style={{maxWidth:"100%",width:280}} aria-label="Grabación de Sofía"/>:
   <button type="button" className="secondary-button" disabled={busy} onClick={()=>void load()}>{busy?"Cargando audio…":"Escuchar grabación"}</button>}
  {error?<p className="sofia-error" role="alert">{error}</p>:null}
  </div>;
}
