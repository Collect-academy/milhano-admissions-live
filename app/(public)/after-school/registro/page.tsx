import Image from 'next/image'
import RegistrationForm from './RegistrationForm'
import styles from './registro.module.css'

export const dynamic='force-dynamic'

export default async function RegistroPage({searchParams}:{searchParams:Promise<{embed?:string}>}){
  const sp=await searchParams
  const embed=sp.embed==='1'

  if(embed){
    return <main className={styles.embedWrap}>
      <div className={styles.embedHead}>
        <Image className={styles.logo} src="/after-school/milhano-logo.jpg" alt="Milhano International School" width={180} height={120} priority/>
        <div><div className={styles.tag}>After School Experience</div><b>Reserva tus talleres</b></div>
      </div>
      <RegistrationForm embed/>
    </main>
  }

  return <main className={styles.wrap}>
    <div className={styles.shell}>
      <header className={styles.head}>
        <Image className={styles.logo} src="/after-school/milhano-logo.jpg" alt="Milhano International School" width={180} height={120} priority/>
        <div className={styles.tag}>After School Experience</div>
      </header>
      <section className={styles.hero}>
        <div className={styles.tag}>Prueba · Descubre · Elige</div>
        <h1>Reserva su experiencia</h1>
        <p>Registra de 1 a 4 alumnos. Cada pase de <b>$50 MXN por alumno</b> incluye la <b>semana completa de talleres</b>. Puedes seleccionar todos los talleres que quieran probar; los talleres que lleguen a 20 registros dejan de mostrarse automáticamente.</p>
      </section>
      <RegistrationForm/>
    </div>
  </main>
}
