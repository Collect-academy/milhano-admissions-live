import { getWorkshopAvailability, getWorkshops } from '@/lib/after-school/queries'
import SessionCreator from '@/components/after-school/SessionCreator'

export const dynamic='force-dynamic'

export default async function ConfigPage(){
  const [workshops,availability]=await Promise.all([getWorkshops(),getWorkshopAvailability()])
  return <>
    <div className="asNotice"><b>Cupo comercial:</b> 20 registros por taller. Cuando un taller llega a 20, deja de aparecer automáticamente en el formulario público. Las sesiones siguen administrándose aparte para asistencia y listas.</div>
    <div className="asSessionGrid">
      {availability.map((w:any)=><div className="asSession" key={w.id}>
        <h3>{w.name}</h3>
        <div><b>{w.registered}/{w.capacity}</b> registrados</div>
        <div className="asSub">{w.remaining>0?`${w.remaining} lugares disponibles`:'CUPO LLENO'}</div>
      </div>)}
    </div>
    <SessionCreator workshops={workshops}/>
    <div className="asCard">
      <h3 style={{marginTop:0}}>Stripe</h3>
      <p className="asSub">Integración reservada. Cada pase será de $50 MXN por un taller/participante. Actualmente los registros quedan con <code>payment_status = stripe_pending_config</code>.</p>
    </div>
  </>
}
