import Link from 'next/link'
import './after-school.css'

const nav = [
  ['/after-school','Resumen'],
  ['/after-school/participants','Participantes'],
  ['/after-school/sessions','Sesiones'],
  ['/after-school/allocation','Asignación'],
  ['/after-school/attendance','Asistencia'],
  ['/after-school/config','Configuración'],
] as const

export default function AfterSchoolLayout({children}:{children:React.ReactNode}) {
  return <section className="asShell">
    <div className="asTop">
      <div>
        <h1 className="asTitle">After School / Workshops</h1>
        <p className="asSub">Milhano After School Experience · operación, cupos y conversión</p>
      </div>
      <Link className="asBtn primary" href="/after-school/registro" prefetch={false}>Ver registro público</Link>
    </div>
    <nav className="asNav">
      {nav.map(([href,label]) => <Link key={href} href={href} prefetch>{label}</Link>)}
    </nav>
    {children}
  </section>
}
