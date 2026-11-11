import { NextResponse } from "next/server";
import { requireAdmissionsAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(_request: Request, context: {params:Promise<{conversationId:string}>}) {
  try {
    const user=await requireAdmissionsAppUser();
    if(user.role!=="admin")return NextResponse.json({error:"Sólo administradores pueden escuchar grabaciones."},{status:403});
    const {conversationId}=await context.params;
    if(!/^conv_[A-Za-z0-9]{8,80}$/.test(conversationId))
      return NextResponse.json({error:"Conversación inválida."},{status:400});
    const admin=createSupabaseAdmin();
    const {data,error}=await admin.from("milhano_ai_call_insights")
      .select("conversation_id").eq("conversation_id",conversationId).maybeSingle();
    if(error||!data)return NextResponse.json({error:"Esta conversación no está registrada en Milhano."},{status:404});
    const key=process.env.ELEVENLABS_API_KEY;
    if(!key)return NextResponse.json({error:"Falta configurar ELEVENLABS_API_KEY en el servidor de Vercel."},{status:503});
    const details=await fetch("https://api.elevenlabs.io/v1/convai/conversations/"+encodeURIComponent(conversationId),{
      headers:{"xi-api-key":key},cache:"no-store",signal:AbortSignal.timeout(20000)
    });
    if(!details.ok)return NextResponse.json({error:"No se pudieron verificar los detalles de la conversación en ElevenLabs."},{status:502});
    const record=await details.json();
    if(record?.agent_id!=="agent_6401m3yvs1rcfbya7hk1qb2bxp8v")
      return NextResponse.json({error:"La grabación no pertenece al agente Sofía."},{status:403});
    if(record?.has_audio!==true)return NextResponse.json({error:"ElevenLabs no conserva audio para esta conversación."},{status:404});
    const response=await fetch("https://api.elevenlabs.io/v1/convai/conversations/"+encodeURIComponent(conversationId)+"/audio",{
      headers:{"xi-api-key":key},cache:"no-store",signal:AbortSignal.timeout(60000)
    });
    if(!response.ok||!response.body)return NextResponse.json({error:"La grabación no está disponible en ElevenLabs."},{status:502});
    return new Response(response.body,{status:200,headers:{
      "Content-Type":response.headers.get("content-type")||"audio/mpeg",
      "Cache-Control":"private, no-store",
      "X-Content-Type-Options":"nosniff",
      "Content-Disposition":"inline"
    }});
  }catch{return NextResponse.json({error:"No se pudo consultar el audio."},{status:500});}
}
