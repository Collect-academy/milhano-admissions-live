import { NextRequest, NextResponse } from 'next/server'
import { as26Admin } from '@/lib/after-school/supabase-admin'
import { revalidateTag } from 'next/cache'

export const runtime='nodejs'

export async function POST(req:NextRequest){
  try{
    const payload=await req.json()
    const { data,error }=await as26Admin().rpc('as26_register_family',{p_payload:payload})
    if(error) throw error

    // GHL/n8n sync is intentionally decoupled from the UX.
    // If AS26_N8N_SYNC_WEBHOOK is configured, notify it AFTER the DB commit.
    const hook=process.env.AS26_N8N_SYNC_WEBHOOK
    if(hook){
      try{
        await fetch(hook,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({registration_id:data.registration_id}),cache:'no-store'})
      }catch{}
    }

    revalidateTag('as26-summary')
    return NextResponse.json(data,{status:201})
  }catch(e:any){
    return NextResponse.json({ok:false,message:e?.message||'Registration failed'},{status:400})
  }
}
