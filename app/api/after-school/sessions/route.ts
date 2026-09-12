import { NextRequest, NextResponse } from 'next/server'
import { as26Admin } from '@/lib/after-school/supabase-admin'
import { revalidateTag } from 'next/cache'

export async function POST(req:NextRequest){
  try{
    const b=await req.json()
    const allowed=String(b.allowed_grades||'').split(',').map((x:string)=>x.trim()).filter(Boolean)
    const {data,error}=await as26Admin().from('as26_workshop_sessions').insert({
      workshop_id:b.workshop_id,
      session_date:b.session_date,
      start_time:b.start_time,
      end_time:b.end_time,
      teacher_name:b.teacher_name||null,
      room_name:b.room_name||null,
      capacity:Number(b.capacity||20),
      allowed_grades:allowed.length?allowed:null
    }).select('id').single()
    if(error) throw error
    revalidateTag('as26-sessions'); revalidateTag('as26-summary')
    return NextResponse.json({ok:true,id:data.id})
  }catch(e:any){return NextResponse.json({ok:false,message:e?.message||'Could not create session'},{status:400})}
}
