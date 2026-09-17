import { getWorkshopAvailability, getWorkshops } from '@/lib/after-school/queries'
import SessionCreator from '@/components/after-school/SessionCreator'

export const dynamic='force-dynamic'

export default async function ConfigPage(){
  const [workshops,availability]=await Promise.all([getWorkshops(),getWorkshopAvailability()])
  return <>
    <div className="asNotice"><b>Cupo comercial:</b> 20 registros por taller. Cada alumno puede seleccionar varios talleres; cada selección ocupa un lugar en ese taller. Cuando un taller llega a 20, deja de aparecer automáticamente en el formulario público.</div>
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
      <p className="asSub">Cada pase es de <b>$50 MXN por alumno</b> e incluye la <b>semana completa de talleres</b>. El precio no aumenta por seleccionar más talleres.</p>
    </div>
  </>
}
