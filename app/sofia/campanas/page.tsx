import "../sofia.css";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { SofiaCampaignPlanner } from "@/components/sofia-campaign-planner";
import { requireAdmissionsAppUser } from "@/lib/auth";
import { getSofiaAnalytics, getSofiaCandidates } from "@/lib/sofia-analytics";

export const dynamic = "force-dynamic";

export default async function SofiaCampaignPage() {
  const [user,candidates,analytics]=await Promise.all([
    requireAdmissionsAppUser(), getSofiaCandidates(), getSofiaAnalytics()
  ]);
  return <DashboardLayout
    eyebrow="Sofía IA · Operaciones"
    title="Campañas y programación de llamadas"
    subtitle="Filtra oportunidades, selecciona lotes y crea ventanas horarias sin modificar los pipelines originales."
    statusLabel="Borradores · Marcación desactivada"
  >
    <div className="sofia-top-actions">
      <Link href="/sofia" className="secondary-button">← Rendimiento IA</Link>
      <Link href="/" className="secondary-button">V2 Summary</Link>
    </div>
    <div className="sofia-safe-message">
      <strong>Planificación segura:</strong> las campañas se guardan como borradores con simulación activada. La automatización de n8n necesitará ser instalada y verificada antes de habilitar el envío.
      Se comprueba la elegibilidad de cada oportunidad al guardar y nuevamente antes de llamar.
    </div>
    <SofiaCampaignPlanner candidates={candidates} campaigns={analytics.campaigns} canPlan={user.role==="admin"}/>
  </DashboardLayout>;
}
