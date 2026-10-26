/** Client/server-safe timing analytics; never mutates V2 or agent attribution. */
export type StageMove = { at: string; from_stage: string | null; to_stage: string | null };
export type TimingV3Row = {
  ghl_opportunity_id: string; ghl_contact_id: string | null;
  lead_name: string; lead_at: string; current_stage: string | null;
  pipeline_role: string; owner_name: string; opportunity_status: string | null; source: string | null;
  first_management_at: string | null; first_management_source: string | null;
  first_commercial_progress_at: string | null; first_real_stage_at: string | null;
  real_stage_followup_count: number; stage_history: StageMove[] | null;
  school_tour_booked_at: string | null; school_tour_scheduled_at: string | null; school_tour_status: string | null;
  trial_day_booked_at: string | null; trial_day_scheduled_at: string | null; trial_day_status: string | null;
  closed_at: string | null; contact_opportunity_count: number;
};

export type TimingMetricKey = "first_management" | "commercial" | "followup_gap" | "qualified_to_st" | "st_wait" | "st_to_trial" | "trial_wait" | "trial_to_close" | "stage_dwell";
export const TIMING_METRICS: {key:TimingMetricKey;label:string;en:string}[] = [
  {key:"first_management",label:"Ingreso → primera gestión",en:"Lead → first management"},
  {key:"commercial",label:"Ingreso → avance comercial",en:"Lead → commercial progress"},
  {key:"followup_gap",label:"Intervalos de seguimiento",en:"Follow-up intervals"},
  {key:"qualified_to_st",label:"Qualified → ST Booked",en:"Qualified → ST Booked"},
  {key:"st_wait",label:"ST agendado → programado",en:"ST booked → scheduled"},
  {key:"st_to_trial",label:"ST programado → Pasadía agendada",en:"ST scheduled → Trial booked"},
  {key:"trial_wait",label:"Pasadía agendada → programada",en:"Trial booked → scheduled"},
  {key:"trial_to_close",label:"Pasadía programada → cierre",en:"Trial scheduled → closing"},
  {key:"stage_dwell",label:"Tiempo dentro de un stage",en:"Time spent in stage"},
];
export type TimingPoint = { id:string; name:string; stage:string; at:string; minutes:number; estimated:boolean; outcome:string };
const M = 60_000;
export function durationMinutes(start?: string | null,end?:string|null):number|null {
  if (!start || !end) return null;
  const diff = (Date.parse(end)-Date.parse(start))/M;
  return Number.isFinite(diff) && diff>=0 ? diff : null;
}
export function dhm(minutes:number|null|undefined):string {
  if (minutes===null||minutes===undefined||!Number.isFinite(minutes)||minutes<0) return "—";
  const total = Math.floor(minutes); const d=Math.floor(total/1440),h=Math.floor(total%1440/60),m=total%60;
  return `${String(d).padStart(2,"0")}:${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
export function normalizedStatus(status:string|null|undefined):string {
  const s=(status??"").toLowerCase().trim();
  if (["showed","completed","show","attended"].includes(s))return "showed";
  if (["noshow","no-show","no show"].includes(s))return "noshow";
  return "pending";
}
export function outcomeOf(r:TimingV3Row):string {
  if (r.opportunity_status==="won" || r.closed_at) return "won";
  if (r.opportunity_status==="lost") return "lost";
  return "open";
}
const atMerida = new Intl.DateTimeFormat("en-GB",{timeZone:"America/Merida",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"});
export function meridaStamp(value:string):{day:string;hour:string} {
  const parts=Object.fromEntries(atMerida.formatToParts(new Date(value)).map(x=>[x.type,x.value]));
  return {day:`${parts.year}-${parts.month}-${parts.day}`,hour:parts.hour};
}
export function intervalPoints(r:TimingV3Row, metric:TimingMetricKey):TimingPoint[] {
  const id=r.ghl_opportunity_id,name=r.lead_name,outcome=outcomeOf(r);
  const out:TimingPoint[]=[];
  function add(start:string|null|undefined,end:string|null|undefined,stage:string,estimated=false){
    const minutes=durationMinutes(start,end);
    if(minutes!==null && end)out.push({id,name,stage,at:end,minutes,estimated,outcome});
  }
  const stages=[...(r.stage_history??[])].filter(x=>x.at&&x.to_stage).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  switch(metric){
    case "first_management":add(r.lead_at,r.first_management_at,r.current_stage??"—",r.first_management_source!=="manual_outbound");break;
    case "commercial":add(r.lead_at,r.first_commercial_progress_at,r.current_stage??"—",true);break;
    case "st_wait":add(r.school_tour_booked_at,r.school_tour_scheduled_at,"School Tour");break;
    case "trial_wait":add(r.trial_day_booked_at,r.trial_day_scheduled_at,"Pasadía");break;
    case "st_to_trial":add(r.school_tour_scheduled_at,r.trial_day_booked_at,"ST → Pasadía");break;
    case "trial_to_close":add(r.trial_day_scheduled_at,r.closed_at,"Pasadía → Closing");break;
    case "qualified_to_st":{
      const q=stages.find(s=>/^(qualified|fit|meaningful conversation|cliente potencial)$/i.test(s.to_stage??""));
      add(q?.at,r.school_tour_booked_at,"Qualified → ST",true);break;
    }
    case "followup_gap":{
      const followups=stages.filter(s=>/no answer|seguimiento|callback/i.test(s.to_stage??""));
      for(let i=1;i<followups.length;i++)add(followups[i-1].at,followups[i].at,followups[i-1].to_stage??"Seguimiento");
      break;
    }
    case "stage_dwell":{
      for(let i=1;i<stages.length;i++)add(stages[i-1].at,stages[i].at,stages[i-1].to_stage??"Sin stage");
      break;
    }
  }
  return out;
}
export function quantile(sorted:number[],q:number):number {
  if(!sorted.length)return 0;
  const pos=(sorted.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
  return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
}
export type Distribution={n:number;min:number;max:number;mean:number;median:number;p90:number;q1:number;q3:number;low:number;high:number;outliers:TimingPoint[]};
export function describe(points:TimingPoint[]):Distribution|null {
  if(!points.length)return null;
  const s=points.map(x=>x.minutes).sort((a,b)=>a-b);
  const q1=quantile(s,.25),q3=quantile(s,.75),iqr=q3-q1;
  const l=q1-1.5*iqr,h=q3+1.5*iqr;
  const inside=s.filter(x=>x>=l&&x<=h);
  return {n:s.length,min:s[0],max:s[s.length-1],mean:s.reduce((a,b)=>a+b,0)/s.length,
    median:quantile(s,.5),p90:quantile(s,.9),q1,q3,low:inside[0]??s[0],high:inside[inside.length-1]??s[s.length-1],
    outliers:points.filter(p=>p.minutes<l||p.minutes>h)};
}
function weekMonday(key:string):string {const d=new Date(`${key}T12:00:00Z`); const day=d.getUTCDay();d.setUTCDate(d.getUTCDate()-((day+6)%7));return d.toISOString().slice(0,10);}
export type Bucket={key:string;points:TimingPoint[];summary:Distribution};
export function buckets(points:TimingPoint[],granularity:"hour"|"day"|"week"|"month"):Bucket[] {
 const map=new Map<string,TimingPoint[]>();
 for(const p of points){const st=meridaStamp(p.at);const key=granularity==="month"?st.day.slice(0,7):granularity==="week"?weekMonday(st.day):granularity==="hour"?`${st.day} ${st.hour}:00`:st.day;
  if(!map.has(key))map.set(key,[]);map.get(key)!.push(p);
 }
 return [...map].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,arr])=>({key,points:arr,summary:describe(arr)!}));
}
export function wilson(success:number,total:number):[number,number] {
 if(!total)return [0,0];const z=1.96,p=success/total,denom=1+z*z/total,center=(p+z*z/(2*total))/denom;
 const margin=z*Math.sqrt((p*(1-p)+z*z/(4*total))/total)/denom;
 return [Math.max(0,center-margin),Math.min(1,center+margin)];
}
export function ranks(values:number[]):number[] {
 return values.map(v=>{let lower=0,equal=0;for(const x of values){if(x<v)lower++;if(x===v)equal++;}return lower+(equal+1)/2;});
}
export function spearman(pairs:Array<[number,number]>):number|null {
 if(pairs.length<8)return null;
 const x=ranks(pairs.map(p=>p[0])),y=ranks(pairs.map(p=>p[1]));
 const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
 let numerator=0,dx=0,dy=0;
 for(let i=0;i<x.length;i++){const a=x[i]-mx,b=y[i]-my;numerator+=a*b;dx+=a*a;dy+=b*b;}
 return dx>0&&dy>0?numerator/Math.sqrt(dx*dy):null;
}
export const WAIT_BANDS=[{label:"0–2 d",min:0,max:3},{label:"3–7 d",min:3,max:8},{label:"8–14 d",min:8,max:15},{label:"15–30 d",min:15,max:31},{label:">30 d",min:31,max:Infinity}];
export type WaitBand={label:string;total:number;showed:number;noshow:number;pending:number;members:TimingV3Row[];ci:[number,number]};
export function waitBands(rows:TimingV3Row[],kind:"st"|"trial"):WaitBand[] {
 return WAIT_BANDS.map(b=>{
  const members=rows.filter(r=>{const mins=durationMinutes(kind==="st"?r.school_tour_booked_at:r.trial_day_booked_at,kind==="st"?r.school_tour_scheduled_at:r.trial_day_scheduled_at);return mins!==null&&mins/1440>=b.min&&mins/1440<b.max;});
  const showed=members.filter(r=>normalizedStatus(kind==="st"?r.school_tour_status:r.trial_day_status)==="showed").length;
  const noshow=members.filter(r=>normalizedStatus(kind==="st"?r.school_tour_status:r.trial_day_status)==="noshow").length;
  const pending=members.length-showed-noshow;
  return {label:b.label,total:members.length,showed,noshow,pending,members,ci:wilson(showed,showed+noshow)};
 });
}
