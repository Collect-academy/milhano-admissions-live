"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";

type Daily = {local_date:string;calls_captured:number;human_answers:number;meaningful_conversations:number;booked_verified:number};
type Hourly = {local_weekday:number;local_hour:number;calls_captured:number;human_answers:number;meaningful_conversations:number;booked_verified:number};
type Reason = {reason:string;cases:number};
const nf=(n:number)=>new Intl.NumberFormat("es-MX",{maximumFractionDigits:1}).format(n);
function groupDaily(rows: Daily[]) {
  const map=new Map<string,{date:string;llamadas:number;respuestas:number;conversaciones:number;visitas:number}>();
  for(const r of rows) {
    const k=r.local_date; const value=map.get(k)??{date:k,llamadas:0,respuestas:0,conversaciones:0,visitas:0};
    value.llamadas+=Number(r.calls_captured)||0;value.respuestas+=Number(r.human_answers)||0;
    value.conversaciones+=Number(r.meaningful_conversations)||0;value.visitas+=Number(r.booked_verified)||0;map.set(k,value);
  }
  return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-45);
}
function groupHours(rows: Hourly[]) {
  const map=new Map<number,{hora:string,orden:number,llamadas:number,respuestas:number,tasa:number}>();
  for(const r of rows) {
    const k=Number(r.local_hour),v=map.get(k)??{hora:String(k).padStart(2,"0")+":00",orden:k,llamadas:0,respuestas:0,tasa:0};
    v.llamadas+=Number(r.calls_captured)||0;v.respuestas+=Number(r.human_answers)||0;map.set(k,v);
  }
  return [...map.values()].sort((a,b)=>a.orden-b.orden).map(v=>({...v,tasa:v.llamadas?v.respuestas/v.llamadas*100:0}));
}
export function SofiaPerformanceCharts({daily,hourly,disqualificationReasons,objections}:{
  daily:Daily[];hourly:Hourly[];disqualificationReasons:Reason[];objections:{category:string;cases:number}[];
}) {
  const trend=groupDaily(daily),hours=groupHours(hourly);
  const reasons=disqualificationReasons.slice(0,8).map(x=>({motivo:x.reason,casos:Number(x.cases)}));
  const objectionTotals=new Map<string,number>();
  for(const o of objections)objectionTotals.set(o.category,(objectionTotals.get(o.category)??0)+Number(o.cases));
  const objectionRows=[...objectionTotals].map(([motivo,casos])=>({motivo,casos})).sort((a,b)=>b.casos-a.casos).slice(0,8);
  return <div className="sofia-charts">
    <section className="panel sofia-chart-panel">
      <h2>Actividad y resultados · evolución diaria</h2>
      <p className="subtitle">Llamadas, respuestas y visitas confirmadas en la misma escala.</p>
      <div className="sofia-chart-canvas">{trend.length?<ResponsiveContainer width="100%" height={270}>
        <LineChart data={trend} margin={{top:10,right:12,left:-14,bottom:0}}>
          <CartesianGrid stroke="#e6ede8" strokeDasharray="3 5"/><XAxis dataKey="date" tick={{fontSize:10}} minTickGap={20}/>
          <YAxis allowDecimals={false} tick={{fontSize:11}}/>
          <Tooltip/><Legend/>
          <Line type="monotone" name="Llamadas" dataKey="llamadas" stroke="#406d91" strokeWidth={2} dot={false}/>
          <Line type="monotone" name="Respuestas" dataKey="respuestas" stroke="#176b52" strokeWidth={2.5} dot={false}/>
          <Line type="monotone" name="Visitas verificadas" dataKey="visitas" stroke="#bb8b2f" strokeWidth={2} dot={false}/>
        </LineChart>
      </ResponsiveContainer>:<p className="sofia-chart-empty">Los gráficos aparecerán cuando existan llamadas capturadas.</p>}</div>
    </section>
    <section className="panel sofia-chart-panel">
      <h2>Respuesta por hora local</h2><p className="subtitle">Mérida · llamadas y respuestas. La tasa es descriptiva, no causal.</p>
      <div className="sofia-chart-canvas">{hours.length?<ResponsiveContainer width="100%" height={270}>
        <BarChart data={hours} margin={{top:10,right:14,left:-14,bottom:0}}>
          <CartesianGrid stroke="#e6ede8" strokeDasharray="3 5"/><XAxis dataKey="hora" tick={{fontSize:11}}/>
          <YAxis allowDecimals={false} tick={{fontSize:11}}/><Tooltip/><Legend/>
          <Bar name="Intentos" dataKey="llamadas" fill="#aac5d0" radius={[4,4,0,0]}/>
          <Bar name="Respondieron" dataKey="respuestas" fill="#176b52" radius={[4,4,0,0]}/>
        </BarChart>
      </ResponsiveContainer>:<p className="sofia-chart-empty">No hay horarios registrados todavía.</p>}</div>
    </section>
    <section className="panel sofia-chart-panel">
      <h2>Motivos de descalificación</h2>
      <p className="subtitle">Únicamente motivos explícitos registrados por llamada.</p>
      <div className="sofia-chart-canvas">{reasons.length?<ResponsiveContainer width="100%" height={270}>
        <BarChart data={reasons} layout="vertical" margin={{top:10,right:14,left:10,bottom:0}}>
          <CartesianGrid stroke="#e6ede8" strokeDasharray="3 5"/>
          <XAxis type="number" allowDecimals={false}/><YAxis dataKey="motivo" type="category" width={175} tick={{fontSize:10}}/>
          <Tooltip formatter={(value)=>nf(Number(value))}/><Bar dataKey="casos" name="Casos" fill="#a64c4c" radius={[0,4,4,0]}/>
        </BarChart>
      </ResponsiveContainer>:<p className="sofia-chart-empty">Sin motivos verificados todavía.</p>}</div>
    </section>
    <section className="panel sofia-chart-panel">
      <h2>Objeciones registradas</h2><p className="subtitle">Agrupaciones exploratorias; no se infieren objeciones no mencionadas.</p>
      <div className="sofia-chart-canvas">{objectionRows.length?<ResponsiveContainer width="100%" height={270}>
        <BarChart data={objectionRows} layout="vertical" margin={{top:10,right:14,left:10,bottom:0}}>
          <CartesianGrid stroke="#e6ede8" strokeDasharray="3 5"/>
          <XAxis type="number" allowDecimals={false}/><YAxis dataKey="motivo" type="category" width={175} tick={{fontSize:10}}/>
          <Tooltip/><Bar dataKey="casos" name="Objeciones" fill="#406d91" radius={[0,4,4,0]}/>
        </BarChart>
      </ResponsiveContainer>:<p className="sofia-chart-empty">Todavía no hay objeciones capturadas.</p>}</div>
    </section>
    <section className="panel sofia-chart-panel">
      <h2>Embudo de Sofía</h2><p className="subtitle">Indicadores de resultados registrados; las llamadas no son leads únicos.</p>
      <div className="sofia-funnel">{[
        ["Intentos",daily.reduce((n,x)=>n+Number(x.calls_captured??0),0)],
        ["Respondieron",daily.reduce((n,x)=>n+Number(x.human_answers??0),0)],
        ["Conversación útil",daily.reduce((n,x)=>n+Number(x.meaningful_conversations??0),0)],
        ["ST confirmadas",daily.reduce((n,x)=>n+Number(x.booked_verified??0),0)]
      ].map(([label,count],i,arr)=>{
        const max=Math.max(1,...arr.map(r=>Number(r[1])));
        return <div className="sofia-funnel-row" key={String(label)}><div><strong>{label}</strong><span>{nf(Number(count))}</span></div><div className="sofia-funnel-track"><div style={{width:(Number(count)/max*100)+"%",background:["#aac5d0","#406d91","#176b52","#bb8b2f"][i]}}/></div></div>;
      })}</div>
    </section>
  </div>;
}
