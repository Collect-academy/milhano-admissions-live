import "../sofia.css";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { getSofiaCallTracking } from "@/lib/sofia-call-tracking";
import { SofiaAttemptsMonitor } from "@/components/sofia-attempts-monitor";

export const dynamic="force-dynamic";

export default async function SofiaSeguimientoPage(){
 const calls=await getSofiaCallTracking();
 return <DashboardLayout
   eyebrow="Sofía IA · Seguimiento"
   title="Autorizaciones y llamadas"
   subtitle="Primeros y segundos intentos, motivos de rechazo, resultados y reintentos automáticos."
   statusLabel="Resultados verificados en ElevenLabs y Supabase"
 >
   <div className="sofia-top-actions">
    <Link className="secondary-button" href="/sofia">Rendimiento de Sofía</Link>
    <Link className="primary-button" href="/sofia/campanas">Preparar batches</Link>
   </div>
   <SofiaAttemptsMonitor rows={calls}/>
 </DashboardLayout>;
}
