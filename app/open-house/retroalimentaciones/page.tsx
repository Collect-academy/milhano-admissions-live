import Link from "next/link";
import {openHouseActor} from "@/lib/open-house";
import {createSupabaseAdmin} from "@/lib/supabase-admin";
import {dateLabel} from "@/lib/open-house-trial-config";
import styles from "@/components/open-house.module.css";
export const dynamic="force-dynamic";
type Booking={id:string;visit_date:string;grade_label:string;child_name:string;guardian_name:string;phone:string;email:string;status:string;trial_date:string|null;prior_declared:boolean};
export default async function Page(){
 const actor=await openHouseActor();
 if(!actor)return <main style={{padding:24}}>Inicia sesión. <Link href="/login?next=/open-house/retroalimentaciones">Ingresar</Link></main>;
 const {data,error}=await createSupabaseAdmin().rpc("milhano_oh_feedback_v1",{p_action:"list",p_payload:{},p_actor:actor.id});
 if(error||data?.error)return <main style={{padding:24}}>No se pudo cargar la agenda o no tienes acceso. <Link href="/open-house">Volver</Link></main>;
 const rows=(data.bookings??[]) as Booking[];
 return <main className={styles.dashboard}><header className={styles.header}><div><p className={styles.kicker}>MILHANO · OPEN HOUSE</p><h1>Agenda de retroalimentaciones</h1><p>{actor.displayName} · {rows.filter(x=>x.status==="booked").length} fechas registradas</p></div><div className={styles.actions}><Link href="/open-house">Volver a Open House</Link><Link href="/open-house/retroalimentacion" target="_blank">Formulario público ↗</Link><a href="/open-house/retroalimentaciones">Actualizar</a></div></header><div className={styles.trialNotice}>Fechas reservadas en Supabase. Horarios por confirmar con admisiones. Sin sincronización GHL todavía. Las pasadías previas declaradas deben verificarse con el equipo.</div><div className={styles.tableWrap}><table><thead><tr><th>Retroalimentación</th><th>Alumno / grado</th><th>Tutor</th><th>WhatsApp / correo</th><th>Pasadía</th><th>Estado</th></tr></thead><tbody>{rows.map(b=><tr key={b.id}><td>{dateLabel(b.visit_date)}</td><td>{b.child_name}<br/>{b.grade_label}</td><td>{b.guardian_name}</td><td>{b.phone}<br/>{b.email}</td><td>{b.trial_date?dateLabel(b.trial_date):b.prior_declared?"Previa (declarada)":"Por verificar"}</td><td>{b.status==="booked"?"Fecha registrada":"Cancelada"}</td></tr>)}</tbody></table>{!rows.length&&<p>No hay retroalimentaciones registradas.</p>}</div></main>;
}
