'use client'

import { useEffect } from 'react'

export default function ThankYouClient({
  status,
  registrationId,
  sessionId,
  embed
}:{
  status:string
  registrationId:string
  sessionId:string
  embed:boolean
}){
  const paid=status==='paid'

  useEffect(()=>{
    if(
      embed&&
      paid&&
      window.parent!==window
    ){
      const url=
        `${window.location.origin}/after-school/gracias`+
        `?session_id=${encodeURIComponent(sessionId||'')}`+
        `&registration_id=${encodeURIComponent(registrationId||'')}`

      window.parent.postMessage({
        type:'AS26_PAYMENT_SUCCESS',
        url
      },'*')
    }
  },[
    embed,
    paid,
    registrationId,
    sessionId
  ])

  return <main
    style={{
      minHeight:'100vh',
      display:'grid',
      placeItems:'center',
      background:'#e6dcdc',
      padding:20,
      fontFamily:'Montserrat,Arial,sans-serif',
      color:'#001e28'
    }}
  >
    <section
      style={{
        maxWidth:620,
        width:'100%',
        background:'#fff',
        borderRadius:20,
        padding:'38px 28px',
        textAlign:'center',
        boxShadow:'0 18px 50px rgba(0,30,40,.10)'
      }}
    >
      <div
        style={{
          fontSize:12,
          fontWeight:900,
          letterSpacing:'.12em',
          textTransform:'uppercase',
          color:'#966432'
        }}
      >
        Milhano After School Experience
      </div>

      <h1
        style={{
          fontSize:34,
          margin:'10px 0 12px',
          color:'#003c32'
        }}
      >
        {paid
          ?'¡Reserva confirmada!'
          :'Pago pendiente'
        }
      </h1>

      <p
        style={{
          lineHeight:1.6,
          color:'#326450'
        }}
      >
        {paid
          ?'Tu pago fue confirmado. Te enviaremos por correo y WhatsApp la información de tu taller.'
          :'Tu registro fue recibido, pero todavía no encontramos un pago confirmado para esta reserva.'
        }
      </p>

      {registrationId&&
        <p
          style={{
            fontSize:11,
            color:'#777',
            marginTop:18
          }}
        >
          Registro: {registrationId}
        </p>
      }
    </section>
  </main>
}
