import { getWorkshops } from '@/lib/after-school/queries'
import SessionCreator from '@/components/after-school/SessionCreator'

export const dynamic='force-dynamic'

export default async function ConfigPage(){
  const workshops=await getWorkshops()
  return <>
    <div className="asNotice"><b>Configuración desacoplada del dashboard principal.</b> Crear o editar sesiones aquí no dispara el refresh global de Admissions.</div>
    <SessionCreator workshops={workshops}/>
    <div className="asCard">
      <h3 style={{marginTop:0}}>Stripe</h3>
      <p className="asSub">Integración reservada. Actualmente los registros se guardan con <code>payment_status = stripe_pending_config</code>. No hay secret keys ni dependencia de Stripe en esta versión.</p>
    </div>
  </>
}
