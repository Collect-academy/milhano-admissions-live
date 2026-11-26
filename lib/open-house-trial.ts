import "server-only";
import {createSupabaseAdmin} from "@/lib/supabase-admin";
export async function trial(action:string,payload:Record<string,unknown>={},actor:string|null=null){
 const {data,error}=await createSupabaseAdmin().rpc("milhano_oh_trial_v1",{p_action:action,p_payload:payload,p_actor:actor});
 if(error)throw new Error("No se pudo completar la operación de pasadía.");
 return data;
}
