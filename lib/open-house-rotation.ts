export const stations=["Padres","Educación personalizada","Global mindset","Habilidades para la vida","Bienestar","Emprendimiento"] as const;
export const leaders=["José Lugo","Miguel","Aurora"] as const;
export const rounds=Array.from({length:6},(_,r)=>[0,2,4].map(o=>(r+o)%6));
export function timePlus(start:string,mins:number){const [h,m]=start.split(":").map(Number);const t=h*60+m+mins;return String(Math.floor(t/60)%24).padStart(2,"0")+":"+String(t%60).padStart(2,"0");}
