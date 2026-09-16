import Stripe from 'stripe'
import ThankYouClient from './ThankYouClient'

export const dynamic='force-dynamic'

export default async function GraciasPage({
  searchParams
}:{
  searchParams:Promise<{
    session_id?:string
    registration_id?:string
    embed?:string
  }>
}){
  const sp=await searchParams

  let paid=false
  let registrationId=sp.registration_id||''

  const sessionId=sp.session_id||''
  const secretKey=process.env.STRIPE_SECRET_KEY

  if(sessionId&&secretKey){
    try{
      const stripe=new Stripe(secretKey)

      const session=
        await stripe.checkout.sessions.retrieve(sessionId)

      paid=session.payment_status==='paid'

      if(session.metadata?.registration_id){
        registrationId=session.metadata.registration_id
      }

    }catch(error){
      console.error(
        'Could not verify Stripe session',
        error
      )
    }
  }

  return <ThankYouClient
    status={paid?'paid':'pending'}
    registrationId={registrationId}
    sessionId={sessionId}
    embed={sp.embed==='1'}
  />
}
