export const grades = [
 {code:"p1",label:"1° de Primaria"},{code:"p2",label:"2° de Primaria"},{code:"p3",label:"3° de Primaria"},{code:"p4",label:"4° de Primaria"},{code:"p5",label:"5° de Primaria"},{code:"p6",label:"6° de Primaria"},
 {code:"s1",label:"1° de Secundaria"},{code:"s2",label:"2° de Secundaria"},{code:"s3",label:"3° de Secundaria"},{code:"h1",label:"1er semestre de Preparatoria"},{code:"h2",label:"2° semestre de Preparatoria"}
] as const;
export const dateLabel=(day:string)=>new Intl.DateTimeFormat("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(day+"T12:00:00Z"));
export const monthOptions=[{label:"Diciembre 2026",prefix:"2026-12",start:1,days:31},{label:"Enero 2027",prefix:"2027-01",start:4,days:31}] as const;
