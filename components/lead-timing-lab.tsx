"use client";

import { useMemo, useState } from "react";
import {
  buckets, describe, dhm, durationMinutes, intervalPoints, meridaStamp, normalizedStatus,
  spearman, TIMING_METRICS, waitBands, wilson,
  type Bucket, type Distribution, type TimingMetricKey, type TimingPoint, type TimingV3Row,
} from "@/lib/timing-v3-metrics";

type Props={rows:TimingV3Row[];locale:"es"|"en";metric:TimingMetricKey;start:string;end:string;mode:string};
type Period="hour"|"day"|"week"|"month";
const colors={green:"#176b52",gold:"#c28a36",red:"#b24e4e",blue:"#437d9d",gray:"#89948a"};
const line=(pts:Array<[number,number]>)=>pts.map((p,i)=>`${i?"L":"M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
const showTitle=(p:TimingPoint)=>`${p.name} · ${p.stage} · ${p.estimated?"≤ ":""}${dhm(p.minutes)} · ${meridaStamp(p.at).day}`;
function MetricKpis({summary,covered,total}: {summary:Distribution|null;covered:number;total:number}) {
 const cards=[{name:"Promedio",value:summary?.mean},{name:"Mínimo",value:summary?.min},{name:"Máximo",value:summary?.max},{name:"Mediana",value:summary?.median},{name:"P90",value:summary?.p90}];
 return <div className="timing-v3-kpis">{cards.map(c=><div className="timing-v3-kpi" key={c.name}><span>{c.name}</span><strong>{dhm(c.value)}</strong><small>dd:hh:mm</small></div>)}<div className="timing-v3-kpi timing-v3-kpi-coverage"><span>Observaciones válidas</span><strong>{summary?.n??0}</strong><small>{covered} / {total} leads con evidencia</small></div></div>;
}
function Trend({groups}: {groups:Bucket[]}) {
 const [hover,setHover]=useState<number|null>(null);
 if(!groups.length)return <p className="panel-note">Sin observaciones válidas para la tendencia.</p>;
 const w=980,h=290,l=58,r=18,t=18,b=40;
 const max=Math.max(1,...groups.map(x=>x.summary.max)),floor=h-b,scaleY=(v:number)=>floor-v/max*(floor-t);
 const step=(w-l-r)/Math.max(1,groups.length-1);
 const x=(i:number)=>l+(groups.length===1?(w-l-r)/2:i*step);
 const avg=groups.map((g,i)=>[x(i),scaleY(g.summary.mean)] as [number,number]);
 const mn=groups.map((g,i)=>[x(i),scaleY(g.summary.min)] as [number,number]);
 const mx=groups.map((g,i)=>[x(i),scaleY(g.summary.max)] as [number,number]);
 const fill=[...mx,...mn.slice().reverse()].map((p,i)=>`${i?"L":"M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")+" Z";
 const visible=hover===null?null:groups[hover];
 return <div className="timing-trend-wrap">
  <svg className="timing-trend-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Promedio y rango mínimo a máximo por periodo">
   {[0,.25,.5,.75,1].map(v=><g key={v}><line x1={l} x2={w-r} y1={scaleY(max*v)} y2={scaleY(max*v)} stroke="#9baaa0" strokeOpacity={.32} strokeDasharray="4 4"/><text x={l-8} y={scaleY(max*v)+4} textAnchor="end" fontSize="11" fill="currentColor">{dhm(max*v)}</text></g>)}
   <path d={fill} fill="rgba(67,125,157,.13)"/>
   <path d={line(mn)} stroke={colors.gray} strokeWidth={1.3} strokeDasharray="4 4" fill="none"/>
   <path d={line(mx)} stroke={colors.gold} strokeWidth={1.6} strokeDasharray="5 3" fill="none"/>
   <path d={line(avg)} stroke={colors.green} strokeWidth={3} fill="none"/>
   {avg.map((p,i)=><g key={`${groups[i].key}-${i}`} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}><circle cx={p[0]} cy={p[1]} r={hover===i?6:4} fill={colors.green}/><circle cx={p[0]} cy={p[1]} r={Math.min(22,Math.max(9,step/2))} fill="transparent" tabIndex={0} onFocus={()=>setHover(i)} onBlur={()=>setHover(null)}/></g>)}
   {groups.map((g,i)=>i%Math.max(1,Math.ceil(groups.length/9))===0||i===groups.length-1?<text key={g.key} x={x(i)} y={h-12} textAnchor="middle" fontSize="11" fill="currentColor">{g.key.slice(5)}</text>:null)}
  </svg>
  <div className="timing-v3-legend"><span style={{color:colors.green}}>● Promedio</span><span style={{color:colors.gold}}>— Máximo</span><span style={{color:colors.gray}}>⋯ Mínimo</span><span>Área = rango</span></div>
  <div className="timing-v3-hover-detail" aria-live="polite">{visible?<><strong>{visible.key} · {visible.summary.n} observaciones</strong><span>Prom. {dhm(visible.summary.mean)} · Mín. {dhm(visible.summary.min)} · Máx. {dhm(visible.summary.max)} · Mediana {dhm(visible.summary.median)}</span><span>Mín.: {visible.points.filter(p=>p.minutes===visible.summary.min).slice(0,2).map((p,i)=><span key={`${p.id}-${i}`}><a href={`/analisis-leads/${encodeURIComponent(p.id)}`}>{p.name}</a>{i===0?" ":""}</span>)} · Máx.: {visible.points.filter(p=>p.minutes===visible.summary.max).slice(0,2).map((p,i)=><span key={`${p.id}-${i}`}><a href={`/analisis-leads/${encodeURIComponent(p.id)}`}>{p.name}</a>{i===0?" ":""}</span>)}</span><span>{visible.summary.outliers.length?`Outliers (${visible.summary.outliers.length}): `:"Sin outliers 1.5×IQR en este periodo."}{visible.summary.outliers.slice(0,6).map((p,i)=><span key={`${p.id}-${i}`}><a href={`/analisis-leads/${encodeURIComponent(p.id)}`}>{p.name} ({dhm(p.minutes)})</a>{i<Math.min(6,visible.summary.outliers.length)-1?", ":""}</span>)}</span></>:<span>Pasa el cursor sobre un punto para ver min/máx, cantidad y nombres de outliers.</span>}</div>
 </div>;
}
const sameLabel=(kind:TimingMetricKey)=>TIMING_METRICS.find(m=>m.key===kind)?.label??kind;
function BoxPlots({rows}: {rows:TimingV3Row[]}) {
 const [group,setGroup]=useState<"intervals"|"stages">("intervals");
 const boxes=useMemo(()=>{
  if(group==="intervals")return TIMING_METRICS.filter(m=>m.key!=="stage_dwell").map(m=>({label:m.label,points:rows.flatMap(r=>intervalPoints(r,m.key))})).filter(g=>g.points.length);
  const map=new Map<string,TimingPoint[]>();
  rows.flatMap(r=>intervalPoints(r,"stage_dwell")).forEach(p=>{if(!map.has(p.stage))map.set(p.stage,[]);map.get(p.stage)!.push(p);});
  return [...map].sort((a,b)=>b[1].length-a[1].length).slice(0,13).map(([label,points])=>({label,points}));
 },[rows,group]);
 const stats=boxes.map(g=>({...g,dist:describe(g.points)!})), max=Math.max(1,...stats.map(x=>x.dist.max));
 const x=(v:number)=>256+Math.log1p(Math.max(0,v))/Math.log1p(max)*680;
 const height=Math.max(160,stats.length*59+52);
 return <div><div className="timing-v3-segment"><button className={group==="intervals"?"active":""} onClick={()=>setGroup("intervals")}>Intervalos del embudo</button><button className={group==="stages"?"active":""} onClick={()=>setGroup("stages")}>Permanencia por stage</button></div>
 {stats.length?<div className="timing-box-scroll"><svg viewBox={`0 0 960 ${height}`} width="100%" role="img" aria-label="Diagramas boxplot con rango intercuartílico y valores atípicos">
   {stats.map((g,i)=>{const y=32+i*59,d=g.dist;return <g key={g.label}>
    <text x="4" y={y+5} fill="currentColor" fontSize="12">{g.label.length>32?g.label.slice(0,30)+"…":g.label}</text>
    <line x1={x(d.low)} y1={y} x2={x(d.high)} y2={y} stroke={colors.gray} strokeWidth={2}/>
    <line x1={x(d.low)} y1={y-7} x2={x(d.low)} y2={y+7} stroke={colors.gray} strokeWidth={2}/>
    <line x1={x(d.high)} y1={y-7} x2={x(d.high)} y2={y+7} stroke={colors.gray} strokeWidth={2}/>
    <rect x={x(d.q1)} y={y-13} width={Math.max(2,x(d.q3)-x(d.q1))} height="26" rx="3" fill="rgba(23,107,82,.25)" stroke={colors.green}/>
    <line x1={x(d.median)} x2={x(d.median)} y1={y-13} y2={y+13} stroke={colors.green} strokeWidth={3}/>
    {d.outliers.slice(0,50).map((p,j)=><a key={`${p.id}-${j}`} href={`/analisis-leads/${encodeURIComponent(p.id)}`}><circle cx={x(p.minutes)} cy={y+(j%3-1)*4} r="4.5" stroke={colors.red} fill="#f4c9bf"><title>{showTitle(p)} · clic para expediente</title></circle></a>)}
    <text x="940" y={y+25} fill="currentColor" textAnchor="end" fontSize="10">n={d.n} · med. {dhm(d.median)}</text>
   </g>})}
  </svg></div>:<p className="panel-note">No hay intervalos válidos para construir cajas.</p>}
 <p className="panel-note">Escala horizontal logarítmica. Caja = Q1–Q3; línea = mediana; bigotes = 1.5×IQR; puntos rojos = outliers (clicables). Duración en dd:hh:mm.</p></div>;
}
function WaitOutcomes({rows,kind}:{rows:TimingV3Row[];kind:"st"|"trial"}) {
 const bands=useMemo(()=>waitBands(rows,kind),[rows,kind]);const [active,setActive]=useState<string|null>(null);
 const selected=bands.find(x=>x.label===active);
 const closed=bands.reduce((a,b)=>a+b.showed+b.noshow,0);
 return <div className="timing-wait-panel"><h3>{kind==="st"?"School Tour":"Pasadía"} · anticipación vs asistencia</h3><p className="panel-note">Cada barra representa citas válidas por días entre agendamiento y visita. No se consideran las fechas negativas.</p>
 <div className="timing-wait-head"><span>Demora</span><span>Showed / Noshow / Pendiente</span><span>n</span></div>
 {bands.map(b=><button className={`timing-wait-row ${active===b.label?"active":""}`} onClick={()=>setActive(active===b.label?null:b.label)} key={b.label}><span>{b.label}</span><span className="timing-wait-stacked"><span style={{width:`${b.total?100*b.showed/b.total:0}%`,background:colors.green}}/><span style={{width:`${b.total?100*b.noshow/b.total:0}%`,background:colors.red}}/><span style={{width:`${b.total?100*b.pending/b.total:0}%`,background:colors.gray}}/></span><strong>{b.total}</strong></button>)}
 <div className="timing-v3-legend"><span style={{color:colors.green}}>■ Showed</span><span style={{color:colors.red}}>■ Noshow</span><span style={{color:colors.gray}}>■ Pendiente</span></div>
 {selected&&<div className="timing-band-detail"><strong>{selected.label} · {selected.showed} asistieron / {selected.noshow} no asistieron / {selected.pending} pendientes</strong><p className="panel-note">Tasa de asistencia observada: {selected.showed+selected.noshow?`${(100*selected.showed/(selected.showed+selected.noshow)).toFixed(0)}% (IC 95% Wilson: ${(selected.ci[0]*100).toFixed(0)}–${(selected.ci[1]*100).toFixed(0)}%)`:"sin outcomes suficientes"}.</p><div className="timing-band-names">{selected.members.slice(0,18).map(r=><a key={r.ghl_opportunity_id} href={`/analisis-leads/${encodeURIComponent(r.ghl_opportunity_id)}`}>{r.lead_name}</a>)}{selected.members.length>18?<small>y {selected.members.length-18} más</small>:null}</div></div>}
 {closed<10?<p className="panel-note">Muestra pequeña: se muestran distribuciones, no inferencias de causalidad.</p>:null}
 </div>;
}
function ScatterTemporal({rows}: {rows:TimingV3Row[]}) {
 const points=rows.flatMap(r=>{const x=durationMinutes(r.lead_at,r.first_management_at),y=durationMinutes(r.school_tour_booked_at,r.school_tour_scheduled_at);
  if(x===null||y===null)return [];return [{r,x,y,status:normalizedStatus(r.school_tour_status)}];});
 if(!points.length)return <p className="panel-note">Todavía no hay pares válidos de primera gestión y ST para este periodo.</p>;
 const width=960,height=300,L=74,R=18,T=18,B=46,xx=Math.max(1,...points.map(p=>p.x)),yy=Math.max(1,...points.map(p=>p.y));
 const x=(v:number)=>L+Math.log1p(v)/Math.log1p(xx)*(width-L-R),y=(v:number)=>height-B-Math.log1p(v)/Math.log1p(yy)*(height-T-B);
 return <><div className="timing-box-scroll"><svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Relación entre tiempo hasta primera gestión y días de antelación al School Tour">
  {[0,.25,.5,.75,1].map(v=><g key={v}><line x1={L} x2={width-R} y1={y(yy*v)} y2={y(yy*v)} stroke="currentColor" strokeOpacity={.13}/><text x={L-7} y={y(yy*v)+4} textAnchor="end" fontSize="11" fill="currentColor">{dhm(yy*v)}</text><text x={x(xx*v)} y={height-B+19} textAnchor="middle" fontSize="11" fill="currentColor">{dhm(xx*v)}</text></g>)}
  {points.map(({r,x:val,y:valY,status})=><a key={r.ghl_opportunity_id} href={`/analisis-leads/${encodeURIComponent(r.ghl_opportunity_id)}`}><circle cx={x(val)} cy={y(valY)} r={5} fill={status==="showed"?colors.green:status==="noshow"?colors.red:colors.gray} fillOpacity={.75}><title>{r.lead_name} · gestión {dhm(val)} · ST {dhm(valY)}</title></circle></a>)}
  <text x={width/2} y={height-5} textAnchor="middle" fontSize="12" fill="currentColor">Ingreso → primera gestión (dd:hh:mm; escala log)</text><text x="13" y="16" fontSize="11" fill="currentColor">ST espera</text>
 </svg></div><div className="timing-v3-legend"><span style={{color:colors.green}}>● Showed</span><span style={{color:colors.red}}>● Noshow</span><span style={{color:colors.gray}}>● Pendiente</span></div><p className="panel-note">Cada punto es una opportunity. Eje X = primer evento detectable (puede ser límite superior); eje Y = días de anticipación del ST. Clic para expediente.</p></>;
}
function Funnel({rows}: {rows:TimingV3Row[]}) {
 const parts=[
  ["Ingreso",rows.length],
  ["Gestión observable",rows.filter(r=>r.first_management_at).length],
  ["ST agendado",rows.filter(r=>r.school_tour_booked_at).length],
  ["ST asistido",rows.filter(r=>normalizedStatus(r.school_tour_status)==="showed").length],
  ["Pasadía agendada",rows.filter(r=>r.trial_day_booked_at).length],
  ["Pasadía asistida",rows.filter(r=>normalizedStatus(r.trial_day_status)==="showed").length],
  ["Cierre/Won",rows.filter(r=>r.closed_at||r.opportunity_status==="won").length]
 ] as Array<[string,number]>;
 return <div className="timing-funnel">{parts.map(([label,n],i)=><div className="timing-funnel-row" key={label}><span>{label}</span><div><span style={{width:`${Math.max(0,100*n/Math.max(1,rows.length))}%`,background:i===6?colors.gold:colors.green}}/></div><strong>{n}</strong></div>)}<p className="panel-note">Embudo de opportunities (no de citas). Los hitos se consultan por fecha histórica, pero no se atribuye causalidad ni se cambian los conteos oficiales de V2.</p></div>;
}
function Relations({rows}: {rows:TimingV3Row[]}) {
 const pairs=rows.flatMap(r=>{const mg=durationMinutes(r.lead_at,r.first_management_at),wait=durationMinutes(r.school_tour_booked_at,r.school_tour_scheduled_at);
   if(mg===null||wait===null||r.first_management_source!=="manual_outbound")return [];
   return [[mg,wait] as [number,number]];});
 const rho=spearman(pairs);
 const st=waitBands(rows,"st"),fast=st.filter((_,i)=>i<=1),slow=st.filter((_,i)=>i>1);
 const tally=(a:typeof st)=>a.reduce((acc,x)=>({showed:acc.showed+x.showed,noshow:acc.noshow+x.noshow}),{showed:0,noshow:0});
 const f=tally(fast),s=tally(slow),eligible=f.showed+f.noshow>=5&&s.showed+s.noshow>=5;
 const fCI=wilson(f.showed,f.showed+f.noshow),sCI=wilson(s.showed,s.showed+s.noshow);
 return <div className="timing-relations">
  <div className="timing-relation-card"><span>Spearman · gestión registrada vs espera hasta ST</span><strong>{rho===null?"Muestra insuficiente":rho.toFixed(2)}</strong><small>n={pairs.length} pares con comunicación manual registrada. No incluye tiempos estimados por stage/cita. Mínimo 8.</small></div>
  <div className="timing-relation-card"><span>Asistencia ST: 0–7 días vs 8+ días</span><strong>{eligible?`${(100*f.showed/(f.showed+f.noshow)).toFixed(0)}% vs ${(100*s.showed/(s.showed+s.noshow)).toFixed(0)}%`:"Muestra insuficiente"}</strong><small>Finalizados: {f.showed+f.noshow} / {s.showed+s.noshow}. {eligible?`IC95% rápido ${(fCI[0]*100).toFixed(0)}–${(fCI[1]*100).toFixed(0)}%; tardío ${(sCI[0]*100).toFixed(0)}–${(sCI[1]*100).toFixed(0)}%.`:"Se requieren al menos 5 resultados conocidos en cada grupo."}</small></div>
  <div className="timing-relation-card"><span>Anticipación de Pasadía → Closing</span><strong>Exploratorio</strong><small>{rows.filter(r=>r.closed_at||r.opportunity_status==="won").length} cierres entre los leads filtrados. No se estima un modelo predictivo sin suficientes cierres y pérdidas maduras.</small></div>
 </div>;
}
export function LeadTimingLab({rows,locale,metric:initialMetric,start,end,mode}:Props){
 const [metric,setMetric]=useState<TimingMetricKey>(initialMetric);
 const [period,setPeriod]=useState<Period>(start===end?"hour":"day");
 const points=useMemo(()=>rows.flatMap(row=>intervalPoints(row,metric).map(point=>mode==="cohort"?{...point,at:row.lead_at}:point)).filter(p=>mode!=="event"||(meridaStamp(p.at).day>=start&&meridaStamp(p.at).day<=end)),[rows,metric,start,end,mode]);
 const summary=useMemo(()=>describe(points),[points]);
 const trend=useMemo(()=>buckets(points,period),[points,period]);
 const covered=new Set(points.map(p=>p.id)).size;
 const excluded=rows.filter(r=>(r.school_tour_booked_at&&r.school_tour_scheduled_at&&durationMinutes(r.school_tour_booked_at,r.school_tour_scheduled_at)===null)||(r.trial_day_booked_at&&r.trial_day_scheduled_at&&durationMinutes(r.trial_day_booked_at,r.trial_day_scheduled_at)===null)).length;
 return <div className="timing-v3-lab">
   <section className="panel timing-v3-lab-heading"><div><p className="eyebrow">LABORATORIO ESTADÍSTICO · V3</p><h2>Distribuciones y comportamiento del embudo</h2><p className="panel-note">Misma población filtrada, independiente de las 50 filas visibles. Escala de duraciones: dd:hh:mm.</p></div><label>Métrica principal<select value={metric} onChange={e=>setMetric(e.target.value as TimingMetricKey)}>{TIMING_METRICS.map(m=><option key={m.key} value={m.key}>{locale==="en"?m.en:m.label}</option>)}</select></label></section>
   <MetricKpis summary={summary} covered={covered} total={rows.length}/>
   <section className="panel"><div className="timing-v3-heading"><div><h2>1 · Tendencia temporal</h2><p className="panel-note">Tiempo promedio, mínimo y máximo · agrupado por {mode==="cohort"?"fecha de ingreso del lead":"fecha del evento medido"}</p></div><div className="timing-v3-segment">{(start===end?["hour","day"]:["day","week","month"] as Period[]).map(p=><button type="button" key={p} onClick={()=>setPeriod(p)} className={period===p?"active":""}>{({hour:"Hora",day:"Día",week:"Semana",month:"Mes"})[p]}</button>)}</div></div><Trend groups={trend}/></section>
   <section className="panel"><h2>2 · Boxplots: intervalos y permanencia por stage</h2><p className="panel-note">Compara la dispersión de cada tramo del embudo y los movimientos reales registrados por stage.</p><BoxPlots rows={rows}/></section>
   <div className="timing-v3-twocol"><section className="panel"><h2>3 · Agendamiento vs asistencia</h2><WaitOutcomes rows={rows} kind="st"/><WaitOutcomes rows={rows} kind="trial"/></section><section className="panel"><h2>4 · Primer contacto vs anticipación de ST</h2><ScatterTemporal rows={rows}/></section></div>
   <div className="timing-v3-twocol"><section className="panel"><h2>5 · Embudo temporal</h2><Funnel rows={rows}/></section><section className="panel"><h2>6 · Relaciones estadísticas</h2><Relations rows={rows}/></section></div>
   <section className="panel"><h3>Calidad y alcance de datos</h3><p className="panel-note">{rows.filter(r=>r.first_management_at===null).length} opportunities sin evidencia de primera gestión · {rows.filter(r=>r.contact_opportunity_count>1).length} con contacto compartido · {excluded} con anticipación ST/Pasadía negativa o inconsistente. Estos tiempos negativos nunca entran en promedios. La comparación por stage excluye entradas iniciales importadas; no son evidencia de una interacción real.</p><p className="panel-note">Los resultados describen asociaciones, no causalidad. Las citas reprogramadas conservan la última fecha sincronizada y los estatus abiertos/pendientes no son fracasos. Los cambios de stage prueban gestión CRM, no el momento exacto de una llamada.</p></section>
 </div>;
}
