import "server-only";
import {createHmac,timingSafeEqual} from "node:crypto";
import type {NextResponse} from "next/server";
export const FAMILY_COOKIE="milhano_oh_verified_v1";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function sign(payload:string){
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!key)throw new Error("Missing server secret");
 return createHmac("sha256",key).update("openhouse-verified:"+payload).digest("hex");
}
export function attachVerifiedFamily(response:NextResponse,id:string){
 if(!uuid.test(id))return;
 const exp=Math.floor(Date.now()/1000)+48*60*60;
 const payload=id+"."+exp;
 response.cookies.set(FAMILY_COOKIE,payload+"."+sign(payload),{httpOnly:true,secure:true,sameSite:"lax",path:"/api/open-house",maxAge:48*60*60});
}
export function verifiedFamily(request:Request):string|null{
 try{
  const cookie=(request.headers.get("cookie")??"").split(";").map(x=>x.trim()).find(x=>x.startsWith(FAMILY_COOKIE+"="));
  if(!cookie)return null;
  const [id,exp,mac,...rest]=cookie.slice(FAMILY_COOKIE.length+1).split(".");
  if(rest.length||!uuid.test(id)||!/^\d{10}$/.test(exp)||Number(exp)<=Date.now()/1000||!/^[a-f0-9]{64}$/.test(mac))return null;
  return timingSafeEqual(Buffer.from(mac,"hex"),Buffer.from(sign(id+"."+exp),"hex"))?id:null;
 }catch{return null;}
}
