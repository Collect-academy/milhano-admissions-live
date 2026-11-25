import {NextResponse} from "next/server";
import {openHouseActor} from "@/lib/open-house";
import {synchronizeOpenHouse} from "@/lib/open-house-ghl";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(request:Request){
 try{
  const origin=request.headers.get("origin");
  if(!origin||new URL(origin).host!==new URL(request.url).host)return NextResponse.json({error:"Origen no autorizado."},{status:403});
  const actor=await openHouseActor();
  if(!actor||actor.role!=="admin")return NextResponse.json({error:"Solo administración puede sincronizar."},{status:403});
  const data=await synchronizeOpenHouse(actor.id);
  return NextResponse.json(data,{status:data.error?400:200,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"No se completó la sincronización. Verifica conexión GHL/Vault; los registros anteriores se conservan."},{status:503});}
}
