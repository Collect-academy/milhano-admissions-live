import {PDFDocument,StandardFonts,rgb,type PDFFont,type PDFPage} from "pdf-lib";
import {stations,leaders,rounds,timePlus} from "./open-house-rotation";
type Member={id:string;name:string;attendance:string;actual_slot:string|null;coordinator:string|null;fields?:Record<string,unknown>;actual_adults?:number|null;actual_children?:number|null;actual_total?:number|null};
type Input={slot:string;start:string;duration:number;transition:number;rows:Member[]};
const green=rgb(.13,.34,.25), pale=rgb(.93,.96,.93),ink=rgb(.12,.19,.15),muted=rgb(.32,.4,.35);
function clean(value:unknown,font:PDFFont){const s=String(value??"").replace(/[\r\n\t]+/g," ");return Array.from(s).map(ch=>{try{font.encodeText(ch);return ch;}catch{return "?";}}).join("");}
function wrap(value:unknown,font:PDFFont,size:number,width:number){const s=clean(value,font);const lines:string[]=[];let line="";for(const word of s.split(/\s+/)){const next=line?line+" "+word:word;if(font.widthOfTextAtSize(next,size)<=width){line=next;continue;}if(line)lines.push(line);line="";for(const ch of word){if(line&&font.widthOfTextAtSize(line+ch,size)>width){lines.push(line);line="";}line+=ch;}}if(line)lines.push(line);return lines.length?lines:[""];}
async function makePdf(input:Input,group:number|null){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const W=841.89,H=595.28,M=32;let page:PDFPage,y=0;const cols=group===null?[0,1,2]:[group];const title=group===null?"Documento general":leaders[group];
 const members=(i:number)=>input.rows.filter(f=>f.attendance==="present"&&f.actual_slot===input.slot&&f.coordinator===leaders[i]);
 function txt(value:unknown,x:number,top:number,size=11,weight=false,color=ink){page.drawText(clean(value,weight?bold:font),{x,y:top-size,size,font:weight?bold:font,color});}
 function newPage(){page=doc.addPage([W,H]);page.drawRectangle({x:0,y:H-11,width:W,height:11,color:green});txt("MILHANO INTERNATIONAL SCHOOL",M,H-27,10,true,green);txt("Open House · "+title,M,H-45,22,true);txt("27/11/2026 · Turno "+input.slot+" · Inicio "+input.start+" · "+input.duration+" min por estación · "+input.transition+" min traslado",M,H-76,11,false,muted);y=H-103;}
 function space(n:number){if(y-n<M){newPage();}}
 newPage();
 const widths=[45,105,...cols.map(()=> (W-2*M-150)/cols.length)];
 function row(values:string[],header=false){const lines=values.map((v,i)=>wrap(v,header?bold:font,10,widths[i]-12));const height=Math.max(27,...lines.map(x=>x.length*13+10));space(height);let x=M;for(let i=0;i<values.length;i++){page.drawRectangle({x,y:y-height,width:widths[i],height,color:header?green:pale,borderColor:rgb(.85,.89,.85),borderWidth:.5});lines[i].forEach((l,j)=>txt(l,x+6,y-6-j*13,10,header,header?rgb(1,1,1):ink));x+=widths[i];}y-=height;}
 row(["Ronda","Horario",...cols.map(i=>leaders[i])],true);
 rounds.forEach((r,i)=>row([String(i+1),timePlus(input.start,i*(input.duration+input.transition))+"–"+timePlus(input.start,i*(input.duration+input.transition)+input.duration),...cols.map(j=>String(r[j]+1)+". "+stations[r[j]])]));
 row(["7",timePlus(input.start,6*(input.duration+input.transition))+" en adelante",...cols.map(()=>"Cierre conjunto")]);y-=18;
 for(const i of cols){const list=members(i);space(45);txt(leaders[i]+" · "+list.length+" familias presentes",M,y,14,true,green);y-=24;if(!list.length){txt("Sin familias asignadas.",M,y);y-=20;}
 for(const f of list){const total=f.actual_total??(f.actual_adults!=null&&f.actual_children!=null?f.actual_adults+f.actual_children:null);const count=total!=null?total+" asistentes reales":f.actual_adults!=null||f.actual_children!=null?(f.actual_adults??"—")+" adultos / "+(f.actual_children??"—")+" niños":f.fields?.personas!=null?String(f.fields.personas)+" previstos":"Total no capturado";const lines=wrap("• "+f.name+"  |  "+String(f.fields?.nivel??"Grado no registrado")+"  |  "+count,font,11,W-2*M-14);for(const line of lines){space(17);txt(line,M+7,y);y-=16;}}
 y-=12;}
 const pages=doc.getPages();pages.forEach((p,i)=>p.drawText("Uso interno · Turno "+input.slot+" · "+(i+1)+"/"+pages.length,{x:M,y:16,size:9,font,color:muted}));return doc.save();
}
// ZIP store method (no new dependencies, one download avoids browser multi-download blocking).
export function zipFiles(files:{name:string;bytes:Uint8Array}[]){
 const enc=new TextEncoder();const parts:Uint8Array<ArrayBuffer>[]=[];const central:Uint8Array<ArrayBuffer>[]=[];let offset=0;
 function crc(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
 for(const file of files){const name=enc.encode(file.name),data=new Uint8Array(file.bytes),checksum=crc(data);const local=new Uint8Array(30+name.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint32(14,checksum,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);const dir=new Uint8Array(46+name.length),v=new DataView(dir.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint32(16,checksum,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);dir.set(name,46);central.push(dir);offset+=local.length+data.length;}
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,central.reduce((sum,b)=>sum+b.length,0),true);e.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:"application/zip"});
}
export async function downloadRotationBundle(input:Input){
 const stamp=input.slot.replace(":","h"),base="Open-House_2026-11-27_"+stamp;
 const names=["General","Jose-Lugo","Miguel","Aurora"];
 const files=await Promise.all([null,0,1,2].map(async(group,i)=>({name:base+"_"+names[i]+".pdf",bytes:await makePdf(input,group)})));
 const url=URL.createObjectURL(zipFiles(files));const a=document.createElement("a");a.href=url;a.download=base+"_Recorridos.zip";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
