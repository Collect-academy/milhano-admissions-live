import {publicFormResponse,legacyCommon} from "@/lib/open-house-legacy-html";
export const dynamic="force-dynamic";
const body="<p class=\"kicker\">OPEN HOUSE · RETROALIMENTACIÓN</p><div id=\"booking\"><h1>Agenda tu retroalimentación</h1><p>Elige el día y horario de tu reunión de retroalimentación después de la pasadía.</p><form id=\"trialForm\" autocomplete=\"on\"><fieldset id=\"trialFields\"><label for=\"child\">Nombre completo del alumno</label><input id=\"child\" maxlength=\"150\" required><label for=\"grade\">Grado o semestre</label><select id=\"grade\" required><option value=\"\">Selecciona el grado</option><option value=\"p1\">1° de Primaria</option><option value=\"p2\">2° de Primaria</option><option value=\"p3\">3° de Primaria</option><option value=\"p4\">4° de Primaria</option><option value=\"p5\">5° de Primaria</option><option value=\"p6\">6° de Primaria</option><option value=\"s1\">1° de Secundaria</option><option value=\"s2\">2° de Secundaria</option><option value=\"s3\">3° de Secundaria</option><option value=\"h1\">1er semestre de Preparatoria</option><option value=\"h2\">2° semestre de Preparatoria</option></select><label for=\"phone\">WhatsApp del tutor (10 dígitos)</label><input id=\"phone\" type=\"tel\" inputmode=\"numeric\" autocomplete=\"tel-national\" maxlength=\"16\" required placeholder=\"999 000 0000\"><p class=\"hint\">Escribe tu WhatsApp para encontrar tu registro.</p><button type=\"button\" id=\"lookup\" class=\"secondary\">Buscar familia</button><p id=\"profileMsg\" class=\"message\" role=\"status\"></p><div id=\"familyChoice\" class=\"subtle hidden\"><strong>Familias encontradas</strong><div id=\"familyResults\"></div><button type=\"button\" id=\"manual\" class=\"secondary\">Escribir otros datos</button></div><label for=\"guardian\">Nombre completo del tutor</label><input id=\"guardian\" autocomplete=\"name\" maxlength=\"150\" required><label for=\"email\">Correo electrónico (opcional, oculto si ya está registrado)</label><input id=\"email\" type=\"email\" autocomplete=\"email\" maxlength=\"254\"><label for=\"mode\">Situación de la pasadía</label><select id=\"mode\" required><option value=\"\">Selecciona una opción</option><option value=\"prior\">Ya realizamos la pasadía</option><option value=\"scheduled\">Ya tenemos una pasadía agendada</option></select><button id=\"dates\" type=\"button\" class=\"secondary\">Ver fechas disponibles</button><p id=\"dateStatus\" class=\"message\" role=\"status\"></p><div id=\"calendar\" class=\"calendar hidden\"><div class=\"calhead\"><strong id=\"monthLabel\"></strong><div class=\"calnav\"><button type=\"button\" class=\"secondary\" id=\"prev\" aria-label=\"Mes anterior\">‹</button><button type=\"button\" class=\"secondary\" id=\"next\" aria-label=\"Mes siguiente\">›</button></div></div><table aria-label=\"Calendario de retroalimentación\"><thead><tr><th>L</th><th>M</th><th>M</th><th>J</th><th>V</th><th>S</th><th>D</th></tr></thead><tbody id=\"calendarDays\"></tbody></table><p class=\"hint\" id=\"calendarMsg\" role=\"status\"></p><button type=\"button\" class=\"secondary hidden\" id=\"reload\">Reintentar consulta</button></div><div id=\"timePanel\" class=\"hidden\"><label for=\"time\">Horario disponible (Mérida)</label><select id=\"time\"><option value=\"\">Selecciona un horario</option></select></div><div class=\"notice\">La retroalimentación debe ser posterior a la pasadía. Duración: 60 minutos. Los horarios se consultan en tiempo real.</div><p id=\"bookMsg\" class=\"message\" role=\"alert\"></p><button id=\"book\" type=\"submit\" disabled>Confirmar retroalimentación</button></fieldset></form><p class=\"hint\">Los datos se utilizarán para organizar la retroalimentación. Una reserva activa por alumno; la fecha se valida al guardar.</p></div><div id=\"confirmation\" class=\"hidden\"><div class=\"success\">✓</div><h1>¡Retroalimentación confirmada!</h1><p id=\"confirmationDetails\"></p><div class=\"notice\">Tu reunión quedó registrada en el calendario de admisiones. Guarda tu referencia.</div><p id=\"reference\" class=\"hint\"></p><button id=\"another\" type=\"button\">Agendar para otro alumno</button></div><noscript>Activa JavaScript en tu navegador o acércate al equipo de admisiones.</noscript>";
const script=String.raw`
var api="/api/open-house/retroalimentacion",month=0,months=[{name:"Diciembre 2026",prefix:"2026-12",offset:1},{name:"Enero 2027",prefix:"2027-01",offset:4}],days={},timeSlots={},chosen="",requestId="",loading=false,saving=false,availabilitySeq=0,profileSeq=0,phoneTimer=null,profileBusy=false,autoFilled=false,lastPhone="",selectedFamily=null,familyMatches=[];
function updateButton(){el("book").disabled=loading||saving||!chosen||!el("time").value||!requestId||phone10(el("phone").value).length!==10||profileBusy;}
function render(){var m=months[month],body=el("calendarDays"),r,c,i,n,d,b,small,a;clear(body);text(el("monthLabel"),m.name);el("prev").disabled=month===0;el("next").disabled=month===1;
 for(r=0;r<6;r++){var tr=document.createElement("tr");for(c=0;c<7;c++){i=r*7+c;n=i-m.offset+1;var td=document.createElement("td");if(n>=1&&n<=31){d=m.prefix+"-"+pad(n);a=days[d];b=document.createElement("button");b.type="button";b.disabled=loading||saving||!a;b.className=chosen===d?"selected":"";b.setAttribute("data-date",d);b.setAttribute("aria-label",dateLabel(d)+(a?" · Disponible":" · No disponible"));text(b,n);small=document.createElement("small");text(small,a?"Disponible":"—");b.appendChild(small);listen(b,"click",function(){chosen=this.getAttribute("data-date");renderTimes();render();});td.appendChild(b);}tr.appendChild(td);}body.appendChild(tr);}
 text(el("calendarMsg"),loading?"Consultando fechas…":chosen?"Seleccionaste "+dateLabel(chosen):"Selecciona un día habilitado. Los días restringidos están deshabilitados.");updateButton();}
function renderTimes(){var select=el("time");clear(select);var opt=document.createElement("option");opt.value="";text(opt,"Selecciona un horario");select.appendChild(opt);var a=timeSlots[chosen]||[];for(var i=0;i<a.length;i++){opt=document.createElement("option");opt.value=a[i].start_at;text(opt,a[i].label);select.appendChild(opt);}select.value="";hide(el("timePanel"),!chosen||!a.length);updateButton();}
listen(el("time"),"change",updateButton);
function invalidateDates(){availabilitySeq++;days={};timeSlots={};chosen="";renderTimes();requestId="";loading=false;hide(el("calendar"),true);message("dateStatus","",false);updateButton();}
function availability(){
 var grade=el("grade").value,phone=phone10(el("phone").value),child=el("child").value,mode=el("mode").value,seq=++availabilitySeq;
 days={};timeSlots={};chosen="";renderTimes();requestId="";hide(el("reload"),true);
 if(!grade||phone.length!==10||child.trim().length<3||!mode){loading=false;hide(el("calendar"),true);message("dateStatus","Completa alumno, grado, WhatsApp y situación de pasadía.",true);updateButton();return;}
 loading=true;hide(el("calendar"),false);message("dateStatus","Consultando fechas…",false);render();
 post(api,{action:"availability",grade:grade,phone:phone,child:child,mode:mode},function(err,d){
 if(seq!==availabilitySeq)return;loading=false;
 if(err||!d||d.error||!d.days||!d.request_id){render();message("dateStatus",err||(d&&d.error)||"No pudimos consultar las fechas. Intenta de nuevo.",true);hide(el("calendar"),true);return;}
 requestId=d.request_id;for(var i=0;i<d.days.length;i++){days[d.days[i].date]=d.days[i].remaining;timeSlots[d.days[i].date]=d.days[i].slots||[];}
 month=d.days.length&&d.days[0].date.indexOf("2027-01")===0?1:0;
 message("dateStatus",d.days.length?"":"No hay fechas habilitadas para esta pasadía dentro del periodo.",false);render();
 });
}
function clearFamily(keepValues){
 selectedFamily=null;autoFilled=false;el("guardian").disabled=false;el("guardian").required=true;el("email").disabled=false;el("guardian").placeholder="";el("email").placeholder="";
 if(!keepValues){el("guardian").value="";el("email").value="";}
}
function applyFamily(f){
 selectedFamily=f.id;autoFilled=true;el("guardian").value=f.guardian||f.label||"";
 el("email").value="";
 el("guardian").disabled=true;el("guardian").required=false;el("email").disabled=true;
 el("guardian").placeholder="";el("email").placeholder=f.email_label||"Sin correo registrado";
 message("profileMsg","Familia seleccionada. Usaremos sus datos registrados al confirmar.",false);
 updateButton();
}
function renderMatches(){
 var root=el("familyResults");clear(root);hide(el("familyChoice"),familyMatches.length===0);
 for(var i=0;i<familyMatches.length;i++){
  var f=familyMatches[i],label=document.createElement("label"),input=document.createElement("input"),span=document.createElement("span");
  label.className="match";input.type="radio";input.name="family_match";input.value=f.id;input.checked=selectedFamily===f.id;
  listen(input,"change",function(){for(var j=0;j<familyMatches.length;j++)if(familyMatches[j].id===this.value){applyFamily(familyMatches[j]);break;}});
  label.appendChild(input);text(span,(f.guardian||f.label)+(f.email_label?" · "+f.email_label:""));label.appendChild(span);root.appendChild(label);
 }
}
function profile(){
 var p=phone10(el("phone").value);if(p.length!==10||saving)return;var seq=++profileSeq;
 profileBusy=true;updateButton();message("profileMsg","Buscando familia…",false);
 post(api,{action:"profile",phone:p},function(err,d){
  if(seq!==profileSeq||phone10(el("phone").value)!==p)return;profileBusy=false;
  if(err||!d||d.error){message("profileMsg",err||(d&&d.error)||"Completa tus datos manualmente.",true);updateButton();return;}
  familyMatches=d.matches||[];if(autoFilled)clearFamily(false);else clearFamily(true);
  if(familyMatches.length===1)applyFamily(familyMatches[0]);
  else message("profileMsg",familyMatches.length?"Selecciona tu familia de la lista.":"No encontramos un registro. Completa tus datos manualmente.",false);
  renderMatches();updateButton();
 });
}
function changedPhone(){
 var normalized=phone10(el("phone").value);if(normalized===lastPhone)return;lastPhone=normalized;invalidateDates();profileSeq++;profileBusy=false;
 if(phoneTimer)clearTimeout(phoneTimer);if(autoFilled)clearFamily(false);else clearFamily(true);familyMatches=[];renderMatches();
 message("profileMsg","",false);updateButton();if(normalized.length===10)phoneTimer=setTimeout(profile,450);
}
listen(el("phone"),"input",changedPhone);listen(el("phone"),"change",changedPhone);
function manualEdit(){profileSeq++;profileBusy=false;clearFamily(true);renderMatches();updateButton();}
listen(el("guardian"),"input",manualEdit);listen(el("email"),"input",manualEdit);
listen(el("manual"),"click",function(){profileSeq++;profileBusy=false;clearFamily(false);renderMatches();message("profileMsg","Escribe los datos de contacto que deseas utilizar.",false);updateButton();});
listen(el("lookup"),"click",function(){if(phoneTimer)clearTimeout(phoneTimer);if(phone10(el("phone").value).length!==10){message("profileMsg","Escribe un WhatsApp válido de 10 dígitos.",true);return;}profile();});
listen(el("grade"),"change",invalidateDates);listen(el("child"),"input",invalidateDates);listen(el("mode"),"change",invalidateDates);listen(el("dates"),"click",availability);listen(el("reload"),"click",availability);listen(el("prev"),"click",function(){month=0;render();});listen(el("next"),"click",function(){month=1;render();});
listen(el("trialForm"),"submit",function(e){e.preventDefault();if(saving||profileBusy||!chosen||!el("time").value||!requestId)return;var p=phone10(el("phone").value);if(p.length!==10||el("child").value.trim().length<3||(!selectedFamily&&el("guardian").value.trim().length<3)){message("bookMsg","Completa el nombre del alumno, tutor y WhatsApp.",true);return;}
 profileSeq++;if(phoneTimer)clearTimeout(phoneTimer);saving=true;el("trialFields").disabled=true;message("bookMsg","Registrando fecha…",false);
 post(api,{action:"book",grade:el("grade").value,date:chosen,start_at:el("time").value,child:el("child").value,guardian:el("guardian").value,phone:p,email:el("email").value,family_id:selectedFamily,mode:el("mode").value,request_id:requestId},function(err,d){saving=false;el("trialFields").disabled=false;if(err||!d||!d.ok){message("bookMsg",err||(d&&d.error)||"No se confirmó. Intenta con los mismos datos.",true);if(d&&(d.code==="full"||d.code==="date_unavailable")){availability();el("bookMsg").scrollIntoView(false);}else if(d&&d.code==="family_changed"){clearFamily(false);familyMatches=[];renderMatches();updateButton();}else updateButton();return;}hide(el("booking"),true);hide(el("confirmation"),false);text(el("confirmationDetails"),dateLabel(d.date)+" · "+new Date(Date.parse(d.start_at)-21600000).toISOString().slice(11,16)+" h · "+el("child").value);text(el("reference"),"Referencia: "+String(d.reference).slice(0,8).toUpperCase()+". Guarda una captura. Para cambios, contacta al equipo.");window.scrollTo(0,0);});});
listen(el("another"),"click",function(){el("child").value="";el("grade").value="";hide(el("confirmation"),true);hide(el("booking"),false);message("bookMsg","",false);el("mode").value="";invalidateDates();window.scrollTo(0,0);});
render();
`;
export function GET(){return publicFormResponse("Agenda tu retroalimentación | Milhano",body,legacyCommon.replace("xhr.timeout=18000","xhr.timeout=45000")+script);}
