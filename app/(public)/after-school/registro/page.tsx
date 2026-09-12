import Image from 'next/image'
import RegistrationForm from './RegistrationForm'
import styles from './registro.module.css'

export const dynamic='force-static'

export default function RegistroPage(){
  return <main className={styles.wrap}>
    <div className={styles.shell}>
      <header className={styles.head}>
        <Image className={styles.logo} src="/after-school/milhano-logo.jpg" alt="Milhano International School" width={180} height={120} priority/>
        <div className={styles.tag}>After School Experience</div>
      </header>
      <section className={styles.hero}>
        <div className={styles.tag}>Prueba · Descubre · Elige</div>
        <h1>Reserva su experiencia</h1>
        <p>Registra de 1 a 4 alumnos. El pase será de <b>$50 MXN por participante</b>; el total se calcula automáticamente y no se puede editar manualmente.</p>
      </section>
      <RegistrationForm/>
    </div>
  </main>
}
