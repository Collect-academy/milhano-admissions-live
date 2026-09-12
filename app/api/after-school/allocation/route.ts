import { NextRequest, NextResponse } from 'next/server'
import { as26Admin } from '@/lib/after-school/supabase-admin'
import { revalidateTag } from 'next/cache'

export async function POST(req:NextRequest){
  try{
    const b=await req.json()
    if(!b.participant_id) throw new Error('participant_id required')
    const {data,error}=await as26Admin().rpc('as26_auto_allocate_participant',{p_participant_id:b.participant_id})
    if(error) throw error
    revalidateTag('as26-summary'); revalidateTag('as26-sessions')
    return NextResponse.json(data)
  }catch(e:any){return NextResponse.json({ok:false,message:e?.message||'Allocation failed'},{status:400})}
}
