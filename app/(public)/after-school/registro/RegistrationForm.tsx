'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'

import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
} from '@/lib/after-school/phone-countries'
import styles from './registro.module.css'

type Workshop={
  id:string
  name:string
  capacity:number
  registered:number
  remaining:number
}

type Grade={
  label:string
  sort_order:number
}

type Options={
  price_per_student_mxn:number
  max_students:number
  grades:Grade[]
  workshops:Workshop[]
}

type Student={
  name:string
  age:string
  grade_raw:string
  school:string
  workshop_ids:string[]
}

const blank=():Student=>({
  name:'',
  age:'',
  grade_raw:'',
  school:'',
  workshop_ids:[]
})

const stripeKey=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise=stripeKey ? loadStripe(stripeKey) : null

function countryFlag(iso:string){
  return iso
    .toUpperCase()
    .replace(/./g,char=>
      String.fromCodePoint(127397+char.charCodeAt(0))
    )
}

function phoneForSubmit(raw:string,dialCode:string){
  const trimmed=raw.trim()
  const digits=trimmed.replace(/\D/g,'')

  if(!digits) return ''

  if(trimmed.startsWith('+')){
    return `+${digits}`
  }

  if(trimmed.startsWith('00')){
    return `+${digits.replace(/^00/,'')}`
  }

  const dialDigits=dialCode.replace(/\D/g,'')

  // Also accept a full international number pasted without the + sign.
  if(
    digits.startsWith(dialDigits)&&
    digits.length>10
  ){
    return `+${digits}`
  }

  return `+${dialDigits}${digits}`
}

export default function RegistrationForm({embed=false}:{embed?:boolean}){
  const [count,setCount]=useState(1)
  const [students,setStudents]=useState<Student[]>([blank()])
  const [tutor,setTutor]=useState({name:'',phone:'',email:''})
  const [phoneCountry,setPhoneCountry]=useState(DEFAULT_PHONE_COUNTRY)
  const [consent,setConsent]=useState(false)
  const [options,setOptions]=useState<Options|null>(null)
  const [loadingOptions,setLoadingOptions]=useState(true)
  const [submitting,setSubmitting]=useState(false)
  const [status,setStatus]=useState<{type:'ok'|'err',msg:string}|null>(null)

  const [checkoutSecret,setCheckoutSecret]=useState<string|null>(null)

  const price=options?.price_per_student_mxn??50
  const total=useMemo(()=>count*price,[count,price])

  const selectedPhoneCountry=useMemo(
    ()=>PHONE_COUNTRIES.find(c=>c.iso===phoneCountry)??PHONE_COUNTRIES[0],
    [phoneCountry]
  )

  const loadOptions=async()=>{
    setLoadingOptions(true)

    try{
      const r=await fetch('/api/after-school/availability',{
        cache:'no-store'
      })

      const j=await r.json()

      if(!r.ok){
        throw new Error(
          j.message||'No se pudo consultar disponibilidad.'
        )
      }

      setOptions(j)

      const activeIds=new Set(
        (j.workshops||[]).map((w:Workshop)=>w.id)
      )

      // If a workshop filled while the form was open, remove only that
      // selection and keep the rest of the student's choices.
      setStudents(old=>
        old.map(s=>({
          ...s,
          workshop_ids:s.workshop_ids.filter(id=>activeIds.has(id))
        }))
      )
    }catch(e:any){
      setStatus({
        type:'err',
        msg:e?.message||'No se pudo consultar disponibilidad.'
      })
    }finally{
      setLoadingOptions(false)
    }
  }

  useEffect(()=>{
    void loadOptions()
  },[])

  const chooseCount=(n:number)=>{
    setCount(n)

    setStudents(old=>
      Array.from(
        {length:n},
        (_,i)=>old[i]??blank()
      )
    )
  }

  const update=(i:number,p:Partial<Student>)=>
    setStudents(old=>
      old.map((s,k)=>k===i?{...s,...p}:s)
    )

  const toggleWorkshop=(studentIndex:number,workshopId:string)=>{
    setStudents(old=>
      old.map((student,index)=>{
        if(index!==studentIndex) return student

        const alreadySelected=student.workshop_ids.includes(workshopId)

        return {
          ...student,
          workshop_ids:alreadySelected
            ? student.workshop_ids.filter(id=>id!==workshopId)
            : [...student.workshop_ids,workshopId]
        }
      })
    )
  }

  const workshopNames=(ids:string[])=>{
    if(!ids.length) return 'Selecciona talleres'

    const names=ids
      .map(id=>options?.workshops.find(w=>w.id===id)?.name)
      .filter(Boolean)

    return names.length
      ? names.join(', ')
      : 'Selecciona talleres'
  }

  const submit=async()=>{
    setStatus(null)

    const normalizedPhone=phoneForSubmit(
      tutor.phone,
      selectedPhoneCountry.dialCode
    )

    if(
      !tutor.name.trim()||
      !tutor.email.trim()||
      !normalizedPhone||
      !consent
    ){
      return setStatus({
        type:'err',
        msg:'Completa los datos del tutor y la autorización.'
      })
    }

    const phoneDigits=normalizedPhone.replace(/\D/g,'')

    if(phoneDigits.length<7||phoneDigits.length>15){
      return setStatus({
        type:'err',
        msg:'Revisa el número de WhatsApp y su clave de país.'
      })
    }

    for(const s of students){
      if(
        !s.name.trim()||
        !s.age||
        !s.grade_raw||
        !s.school.trim()||
        s.workshop_ids.length===0
      ){
        return setStatus({
          type:'err',
          msg:'Completa todos los datos y selecciona al menos un taller para cada alumno.'
        })
      }
    }

    setSubmitting(true)

    try{
      const q=new URLSearchParams(location.search)

      const payload={
        tutor:{
          name:tutor.name.trim(),
          phone:normalizedPhone,
          email:tutor.email.trim().toLowerCase(),
          phone_country_code:selectedPhoneCountry.iso,
          phone_dial_code:selectedPhoneCountry.dialCode,
        },
        students:students.map((s,i)=>({
          ...s,
          student_index:i+1,
          age:Number(s.age)
        })),
        consent,
        attribution:Object.fromEntries(
          [
            'utm_source',
            'utm_medium',
            'utm_campaign',
            'utm_content',
            'utm_term',
            'fbclid'
          ].map(k=>[k,q.get(k)||''])
        )
      }

      const endpoint=embed
        ? '/api/after-school/register?embed=1'
        : '/api/after-school/register'

      const r=await fetch(endpoint,{
        method:'POST',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify(payload)
      })

      const j=await r.json()

      if(!r.ok){
        if(
          String(j.message||'').includes('WORKSHOP_FULL')
        ){
          await loadOptions()

          throw new Error(
            'Uno de los talleres seleccionados acaba de llenar sus 20 lugares. Ya actualizamos las opciones; revisa la selección e inténtalo de nuevo.'
          )
        }

        throw new Error(
          j.message||'No se pudo guardar el registro.'
        )
      }

      if(!j.stripe_client_secret){
        throw new Error(
          j.payment_error||
          'El registro quedó guardado, pero no pudimos iniciar el pago. Contacta a Milhano antes de volver a enviar el formulario.'
        )
      }

      setCheckoutSecret(j.stripe_client_secret)

    }catch(e:any){
      setStatus({
        type:'err',
        msg:e?.message||'No se pudo completar el registro.'
      })
    }finally{
      setSubmitting(false)
    }
  }

  if(checkoutSecret){
    return <div
      style={{
        maxWidth:820,
        margin:'0 auto',
        padding:embed?'8px':'24px'
      }}
    >
      <div className={styles.card}>
        <div
          style={{
            marginBottom:20,
            textAlign:'center'
          }}
        >
          <div
            style={{
              fontSize:12,
              fontWeight:800,
              letterSpacing:'.1em',
              textTransform:'uppercase',
              color:'#966432',
              marginBottom:6
            }}
          >
            Milhano After School Experience
          </div>

          <h2 style={{marginBottom:8}}>
            Finaliza tu reserva
          </h2>

          <p
            style={{
              color:'#326450',
              lineHeight:1.5
            }}
          >
            {count} participante{count>1?'s':''} · Semana completa · Total: <b>${total} MXN</b>
          </p>
        </div>

        {stripePromise
          ? <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{
                clientSecret:checkoutSecret
              }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>

          : <div className={styles.err}>
              No se encontró la configuración pública de Stripe.
            </div>
        }
      </div>
    </div>
  }

  return <div className={`${styles.grid} ${embed?styles.embedGrid:''}`}>
    <div>

      <div className={styles.card}>
        <h2>1 · Tutor responsable</h2>

        <div className={styles.fields}>
          <label className={styles.full}>
            Nombre completo
            <input
              autoComplete="name"
              value={tutor.name}
              onChange={e=>
                setTutor({
                  ...tutor,
                  name:e.target.value
                })
              }
            />
          </label>

          <label>
            WhatsApp
            <div className={styles.phoneRow}>
              <select
                className={styles.countryPicker}
                aria-label="Clave de país de WhatsApp"
                value={phoneCountry}
                onChange={e=>setPhoneCountry(e.target.value)}
              >
                {PHONE_COUNTRIES.map(country=>
                  <option value={country.iso} key={country.iso}>
                    {countryFlag(country.iso)} {country.name} {country.dialCode}
                  </option>
                )}
              </select>

              <input
                className={styles.phoneInput}
                autoComplete="tel"
                inputMode="tel"
                placeholder="999 123 4567"
                value={tutor.phone}
                onChange={e=>
                  setTutor({
                    ...tutor,
                    phone:e.target.value
                  })
                }
              />
            </div>
          </label>

          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={tutor.email}
              onChange={e=>
                setTutor({
                  ...tutor,
                  email:e.target.value
                })
              }
            />
          </label>
        </div>
      </div>

      <div className={styles.card}>
        <h2>2 · ¿Cuántos alumnos?</h2>

        <p className={styles.helper}>
          Cada alumno puede elegir <b>todos los talleres que quiera</b>.
          El precio de <b>$50 MXN por alumno</b> incluye la <b>semana completa de talleres</b>.
        </p>

        <div className={styles.count}>
          {[1,2,3,4].map(n=>
            <button
              type="button"
              className={n===count?styles.on:''}
              onClick={()=>chooseCount(n)}
              key={n}
            >
              {n}
            </button>
          )}
        </div>

        {students.map((s,i)=>
          <div className={styles.student} key={i}>

            <h3>Alumno {i+1}</h3>

            <div className={styles.fields}>

              <label className={styles.full}>
                Nombre completo
                <input
                  value={s.name}
                  onChange={e=>
                    update(i,{name:e.target.value})
                  }
                />
              </label>

              <label>
                Edad
                <select
                  value={s.age}
                  onChange={e=>
                    update(i,{age:e.target.value})
                  }
                >
                  <option value="">
                    Selecciona
                  </option>

                  {Array.from(
                    {length:11},
                    (_,k)=>k+6
                  ).map(a=>
                    <option value={a} key={a}>
                      {a} años
                    </option>
                  )}
                </select>
              </label>

              <label>
                Grado
                <select
                  value={s.grade_raw}
                  onChange={e=>
                    update(i,{
                      grade_raw:e.target.value
                    })
                  }
                  disabled={loadingOptions}
                >
                  <option value="">
                    Selecciona grado
                  </option>

                  {(options?.grades||[]).map(g=>
                    <option
                      value={g.label}
                      key={g.label}
                    >
                      {g.label}
                    </option>
                  )}
                </select>
              </label>

              <label className={styles.full}>
                Escuela actual
                <input
                  value={s.school}
                  onChange={e=>
                    update(i,{
                      school:e.target.value
                    })
                  }
                />
              </label>

              <fieldset className={`${styles.full} ${styles.workshopFieldset}`}>
                <legend>Talleres que desea probar</legend>

                <p className={styles.workshopHelper}>
                  Marca todos los que le interesen. No hay límite de selección.
                </p>

                {loadingOptions
                  ? <div className={styles.workshopLoading}>Consultando cupos…</div>
                  : <div className={styles.workshopGrid}>
                      {(options?.workshops||[]).map(w=>{
                        const checked=s.workshop_ids.includes(w.id)

                        return <label
                          className={`${styles.workshopOption} ${checked?styles.workshopOptionOn:''}`}
                          key={w.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={()=>toggleWorkshop(i,w.id)}
                          />

                          <span>
                            <b>{w.name}</b>
                            <small>
                              {w.remaining} lugar{w.remaining===1?'':'es'} disponible{w.remaining===1?'':'s'}
                            </small>
                          </span>
                        </label>
                      })}
                    </div>
                }
              </fieldset>

            </div>
          </div>
        )}

        {!loadingOptions&&
          (options?.workshops?.length??0)===0&&
          <div className={styles.err}>
            Por el momento todos los talleres llegaron a su cupo de 20 registros.
          </div>
        }
      </div>

      <div className={styles.card}>
        <label className={styles.ws}>
          <input
            type="checkbox"
            checked={consent}
            onChange={e=>
              setConsent(e.target.checked)
            }
          />

          Acepto la autorización de participación y el aviso de privacidad aplicable. Reemplazar por el texto legal aprobado antes de Ads.
        </label>
      </div>

    </div>

    <aside className={styles.summary}>
      <h2>Tu reserva</h2>

      {students.map((s,i)=>
        <div className={styles.line} key={i}>
          <span>
            <b>
              {s.name||`Alumno ${i+1}`}
            </b>

            <small>
              {workshopNames(s.workshop_ids)}
            </small>
          </span>

          <b>${price}</b>
        </div>
      )}

      <div className={styles.total}>
        <span>
          {count} pase{count>1?'s':''}
        </span>

        <strong>
          ${total}
        </strong>
      </div>

      <button
        className={styles.btn}
        disabled={
          submitting||
          loadingOptions||
          (options?.workshops?.length??0)===0
        }
        onClick={submit}
      >
        {submitting
          ?'Preparando pago…'
          :`Continuar al pago · $${total} MXN`
        }
      </button>

      <div className={styles.note}>
        Cada pase incluye acceso a todos los talleres de la semana para un participante. El total se calcula automáticamente y no se puede editar.
      </div>

      {status&&
        <div
          className={
            status.type==='ok'
              ?styles.ok
              :styles.err
          }
        >
          {status.msg}
        </div>
      }
    </aside>

  </div>
}
