import { NextRequest, NextResponse } from 'next/server'
import { as26Admin } from '@/lib/after-school/supabase-admin'
import { revalidateTag } from 'next/cache'

export async function PATCH(req:NextRequest){
  try{
    const b=await req.json()
    const {data,error}=await as26Admin().rpc('as26_mark_attendance',{
      p_participant_id:b.participant_id,p_session_id:b.session_id,p_attended:!!b.attended,p_notes:b.notes||null
    })
    if(error) throw error
    revalidateTag('as26-summary'); revalidateTag('as26-sessions')
    return NextResponse.json(data)
  }catch(e:any){return NextResponse.json({ok:false,message:e?.message||'Attendance failed'},{status:400})}
}
