import Link from "next/link";
import {openHouseActor} from "@/lib/open-house";
import {trial} from "@/lib/open-house-trial";
import TrialAdmin from "@/components/open-house-trial-admin";
export const dynamic="force-dynamic";
export default async function Page(){
 const actor=await openHouseActor();if(!actor)return <main style={{padding:24}}>Inicia sesión. <Link href="/login?next=/open-house/pasadias">Ingresar</Link></main>;
 try{const data=await trial("list",{},actor.id);if(data.error)return <main style={{padding:24}}>Acceso no autorizado. <Link href="/open-house">Volver</Link></main>;return <TrialAdmin initial={data} user={actor.displayName}/>;}catch{return <main style={{padding:24}}>No se pudo cargar la agenda. <Link href="/open-house">Volver</Link></main>;}
}
