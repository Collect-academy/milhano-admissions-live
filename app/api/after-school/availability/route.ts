import { NextResponse } from 'next/server'
import { as26Admin } from '@/lib/after-school/supabase-admin'

export const dynamic='force-dynamic'

export async function GET(){
  try{
    const {data,error}=await as26Admin().rpc('as26_public_form_options')
    if(error) throw error
    return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}})
  }catch(e:any){
    return NextResponse.json({ok:false,message:e?.message||'Availability failed'},{status:500})
  }
}
