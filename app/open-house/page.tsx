import Link from "next/link";
import { oh, openHouseActor } from "@/lib/open-house";
import OpenHouseDashboard from "@/components/open-house-dashboard";
export const dynamic = "force-dynamic";
export default async function OpenHousePage() {
  const actor=await openHouseActor();
  if(!actor) return <main style={{padding:32}}>Inicia sesión para acceder. <Link href="/login?next=/open-house">Ingresar</Link></main>;
  let data;
  try {data=await oh("list",{},actor.id);} catch {return <main style={{padding:32}}>No se pudo cargar Open House. Verifica la migración y vuelve a intentar.</main>;}
  if(data.error) return <main style={{padding:32}}><h1>Open House</h1><p>Tu cuenta no tiene acceso a este módulo.</p><Link href="/">Volver</Link></main>;
  return <OpenHouseDashboard initial={data.families} user={actor.displayName} canSync={actor.role==="admin"}/>;
}
