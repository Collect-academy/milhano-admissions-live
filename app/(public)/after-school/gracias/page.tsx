import ThankYouClient from './ThankYouClient'

export const dynamic='force-dynamic'

export default async function GraciasPage({searchParams}:{searchParams:Promise<{status?:string;registration_id?:string;embed?:string}>}){
  const sp=await searchParams
  return <ThankYouClient status={sp.status||'pending'} registrationId={sp.registration_id||''} embed={sp.embed==='1'}/>
}
