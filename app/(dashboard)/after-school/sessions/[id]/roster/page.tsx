import PrintButton from "@/components/after-school/PrintButton";
import { getRoster, getSession } from "@/lib/after-school/queries";

export const dynamic = "force-dynamic";

export default async function RosterPrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [s, rows] = await Promise.all([getSession(id), getRoster(id)]);

  return (
    <div className="rosterPrint">
      <style>{`
        @page { size: letter; margin: 12mm; }
        .rosterPrint { font-family: Arial, sans-serif; color: #222; background: #fff; padding: 16px; }
        .rosterPrint header { display:flex; justify-content:space-between; gap:20px; border-bottom:3px solid #003c32; padding-bottom:8px; }
        .rosterPrint h1 { font-size:22px; margin:0; color:#003c32; }
        .rosterMeta { font-size:12px; line-height:1.45; }
        .rosterPrint table { width:100%; border-collapse:collapse; margin-top:12px; font-size:10.5px; }
        .rosterPrint th, .rosterPrint td { border:1px solid #777; padding:6px; vertical-align:top; }
        .rosterPrint th { background:#eee7e3; }
        .rosterNotes { width:25%; }
        .rosterCheck { width:50px; }
        .rosterLines { height:55px; border:1px solid #777; margin-top:6px; }
        .rosterToolbar { display:flex; justify-content:flex-end; margin-bottom:10px; }
        @media print {
          .navigation-row, .topbar, .footer, .asNav, .asTop, .rosterNoPrint { display:none !important; }
          .dashboard-shell { padding:0 !important; background:#fff !important; }
          .asShell { display:block !important; }
          .rosterPrint { padding:0 !important; }
        }
      `}</style>
      <div className="rosterToolbar rosterNoPrint">
        <PrintButton />
      </div>
      <header>
        <div>
          <h1>{s.workshop_name}</h1>
          <div>Milhano After School Experience</div>
        </div>
        <div className="rosterMeta">
          <b>Fecha:</b> {s.session_date}
          <br />
          <b>Horario:</b> {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)}
          <br />
          <b>Profesor:</b> {s.teacher_name || "__________"}
          <br />
          <b>Salón:</b> {s.room_name || "__________"}
          <br />
          <b>Cupo:</b> {s.capacity}
        </div>
      </header>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Alumno</th><th>Edad</th><th>Grado</th><th>Tutor</th><th>WhatsApp</th><th className="rosterCheck">Presente</th><th className="rosterNotes">Notas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={r.participant_id}>
              <td>{i + 1}</td><td>{r.full_name}</td><td>{r.age}</td><td>{r.grade_raw}</td><td>{r.tutor_name}</td><td>{r.tutor_phone}</td><td>☐</td><td />
            </tr>
          ))}
        </tbody>
      </table>
      <p><b>Asistencia:</b> ____ / {s.capacity}</p>
      <b>Observaciones generales:</b>
      <div className="rosterLines" />
    </div>
  );
}
