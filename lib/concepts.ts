import type { Locale } from "@/lib/locale";

const DEFINITIONS: Record<string, { en: string; es: string }> = {
  new_leads: {
    en: "New leads received during the selected period. System count is based on GHL opportunities; reported totals may include leads that never reached the pipeline.",
    es: "Leads nuevos recibidos durante el periodo seleccionado. El conteo del sistema usa opportunities de GHL; el total reportado puede incluir leads que nunca llegaron al pipeline.",
  },
  ads_leads: {
    en: "Leads the advisor reports as coming from paid advertising. Facebook or Instagram alone does not prove a lead was paid.",
    es: "Leads que la asesora reporta como provenientes de publicidad pagada. Que el source diga Facebook o Instagram por sí solo no demuestra que haya sido Ads.",
  },
  organic_leads: {
    en: "Leads the advisor reports as organic/non-paid. Kept separate from the raw GHL Source field.",
    es: "Leads que la asesora reporta como orgánicos/no pagados. Se mantiene separado del campo Source crudo de GHL.",
  },
  contacted_reported: {
    en: "Outbound contact attempts reported by the advisor across channels. A call plus a WhatsApp to the same lead counts as two attempts; this is not a unique-lead metric.",
    es: "Intentos de contacto salientes reportados por la asesora entre todos los canales. Una llamada y un WhatsApp al mismo lead cuentan como dos intentos; no es una métrica de leads únicos.",
  },
  responses_reported: {
    en: "Unique leads who replied or answered at least once during the reporting window, regardless of channel.",
    es: "Leads únicos que respondieron o contestaron al menos una vez durante la ventana reportada, sin importar el canal.",
  },
  qualified_leads: {
    en: "Qualified and Fit are the same milestone in Milhano. The system counts a lead as Qualified / Fit when it enters the GHL stage Fit.",
    es: "Qualified y Fit son el mismo hito en Milhano. El sistema cuenta un lead como Qualified / Fit cuando entra al stage Fit de GHL.",
  },
  fit: {
    en: "Qualified / Fit: the advisor determined that the lead meets the current qualification criteria. There is no separate Qualified stage in GHL.",
    es: "Qualified / Fit: la asesora determinó que el lead cumple los criterios actuales de calificación. No existe un stage Qualified separado en GHL.",
  },
  no_response: {
    en: "No Response: contact has been attempted but the lead has not replied yet. The lead remains active; this is not the same as Lost.",
    es: "No responde: ya hubo intentos de contacto pero el lead todavía no ha respondido. El lead sigue activo; no equivale a Lost.",
  },
  follow_up: {
    en: "Follow-up: there is a known next contact action or a reasonable reason to contact the lead later, such as a requested callback at another time or day. The lead remains active.",
    es: "Seguimiento: existe una próxima acción de contacto conocida o una razón válida para contactar al lead más tarde, por ejemplo porque pidió que le llamen en otro horario o día. El lead sigue activo.",
  },
  legacy_follow_up: {
    en: "Legacy combined stage used before No Response and Follow-up were separated. Existing records can remain for history, but current leads should be reclassified into the new stage that matches reality.",
    es: "Stage combinado legacy usado antes de separar No responde y Seguimiento. Los registros históricos pueden conservarse, pero los leads actuales deben reclasificarse al nuevo stage que corresponda.",
  },
  no_fit: {
    en: "No Fit: the lead does not meet a defined admissions criterion. This is different from not answering or simply needing follow-up.",
    es: "No Fit: el lead no cumple un criterio definido de admisiones. Es distinto de no responder o simplemente requerir seguimiento.",
  },
  lost: {
    en: "Lost / No Continuity: active pursuit has ended after a clear decision, explicit lack of continuity, or the team's follow-up criteria have been exhausted.",
    es: "Lost / Sin continuidad: la gestión activa terminó después de una decisión clara, falta explícita de continuidad o agotamiento de los criterios de seguimiento del equipo.",
  },
  school_tours_booked: {
    en: "Distinct leads that entered School Tour Booked during the selected period. A tour booked today may belong to a lead qualified on an earlier day.",
    es: "Leads únicos que entraron a School Tour agendado durante el periodo seleccionado. Un tour agendado hoy puede pertenecer a un lead calificado en un día anterior.",
  },
  school_tours_attended: {
    en: "Distinct leads recorded as having attended a School Tour during the selected period.",
    es: "Leads únicos registrados como asistentes a un School Tour durante el periodo seleccionado.",
  },
  school_tours_today: {
    en: "School Tours scheduled for the current local date in Mérida. This is a current schedule reading, not the total booked during the selected historical period.",
    es: "School Tours programados para la fecha local actual en Mérida. Es una lectura de agenda actual, no el total agendado durante el periodo histórico seleccionado.",
  },
  trial_days_booked: {
    en: "Distinct leads entering the Trial Day Booked stage during the selected period.",
    es: "Leads únicos que entraron al stage Pasadía agendada durante el periodo seleccionado.",
  },
  trial_days_showed: {
    en: "Distinct leads recorded as having attended their Trial Day during the selected period.",
    es: "Leads únicos registrados como asistentes a su Pasadía durante el periodo seleccionado.",
  },
  feedback: {
    en: "Post-visit or post-trial feedback stage used while admissions feedback is being gathered or reviewed.",
    es: "Stage posterior a la visita o pasadía usado mientras se obtiene o revisa la retroalimentación de admisiones.",
  },
  evaluation: {
    en: "Lead/application is under active admissions evaluation and has not yet reached enrollment in progress.",
    es: "El lead/solicitud está en evaluación activa de admisiones y todavía no llega a Inscripción en proceso.",
  },
  enrollment_process: {
    en: "Enrollment has started but is not yet considered fully enrolled/closed.",
    es: "El proceso de inscripción ya inició pero todavía no se considera completamente Inscrito/Closed.",
  },
  closed: {
    en: "Distinct leads entering the enrolled/closed stage during the selected period.",
    es: "Leads únicos que entraron al stage Inscrito/Closed durante el periodo seleccionado.",
  },
  number_of_dials: {
    en: "Outbound phone call attempts visible to GHL. WhatsApp calls or external phone calls may not be visible here.",
    es: "Intentos de llamada telefónica saliente visibles para GHL. Las llamadas de WhatsApp o llamadas externas pueden no aparecer aquí.",
  },
  unique_contacted_leads: {
    en: "Distinct admissions leads with at least one observable human outbound attempt: a GHL call attempt or a manual/countable outbound WhatsApp. This counts unique leads, not total contact attempts.",
    es: "Leads únicos de admisiones con al menos un intento humano saliente observable: una llamada GHL o un WhatsApp manual/contabilizable. Cuenta leads únicos, no intentos totales de contacto.",
  },
  responded_leads: {
    en: "Distinct admissions leads who gave a simple observable response: an inbound WhatsApp reply or a connected GHL call. A response does not imply that enough information was provided to qualify the lead.",
    es: "Leads únicos de admisiones que dieron una respuesta simple observable: un WhatsApp entrante o una llamada GHL conectada. Responder no significa que ya haya información suficiente para calificar al lead.",
  },
  meaningful_conversations: {
    en: "Unique leads who provided admissions-relevant information, even if the information is still insufficient to decide Fit vs No Fit. It can happen by WhatsApp or phone and is reported by the advisor; it is not inferred from call duration or message count.",
    es: "Leads únicos que proporcionaron información relevante para admisiones, aunque todavía sea insuficiente para decidir Fit vs No Fit. Puede ocurrir por WhatsApp o llamada y lo reporta la asesora; no se infiere por duración de llamada ni cantidad de mensajes.",
  },
  calls_3min: {
    en: "GHL calls lasting at least 3 minutes. This is a duration-based call metric only and is no longer treated as Meaningful Conversations.",
    es: "Llamadas de GHL con duración de al menos 3 minutos. Es únicamente una métrica de duración de llamadas y ya no se trata como Conversaciones Significativas.",
  },
  raw_source: {
    en: "Raw Source exactly as GHL provides it. Facebook/Instagram can be paid or organic unless campaign/UTM evidence explicitly identifies the acquisition type.",
    es: "Source crudo exactamente como lo entrega GHL. Facebook/Instagram puede ser Ads u orgánico salvo que campaña/UTM u otra evidencia identifique explícitamente el tipo de adquisición.",
  },
  system_value: {
    en: "What the automated GHL/Supabase data layer can prove for the metric.",
    es: "Lo que la capa automática GHL/Supabase puede demostrar para la métrica.",
  },
  reported_total: {
    en: "What the advisor says happened. It is stored as evidence and does not automatically overwrite GHL.",
    es: "Lo que la asesora afirma que ocurrió. Se guarda como evidencia y no sobrescribe automáticamente GHL.",
  },
  manual_extra: {
    en: "Activity verified to have happened outside GHL. Only this value is added to the operational total.",
    es: "Actividad verificada que ocurrió fuera de GHL. Solo este valor se suma al total operativo.",
  },
  operational_total: {
    en: "GHL/System plus verified activity outside GHL.",
    es: "GHL/System más actividad verificada fuera de GHL.",
  },
  gap: {
    en: "Reported Total minus Operational Total. A non-zero gap means the discrepancy is still unresolved.",
    es: "Total reportado menos Total operativo. Un gap distinto de cero significa que la discrepancia sigue sin resolverse.",
  },
  current_stage: {
    en: "The lead's current position in the GHL pipeline. Current-stage inventory is different from period activity.",
    es: "La posición actual del lead en el pipeline de GHL. El inventario de stages actuales es diferente de la actividad del periodo.",
  },
  whatsapp_messages: {
    en: "Raw WhatsApp message volume captured by the shared channel; it is not the same as unique replies or conversations.",
    es: "Volumen crudo de mensajes de WhatsApp capturado por el canal compartido; no equivale a respuestas o conversaciones únicas.",
  },
  inbound_calls: {
    en: "Incoming phone calls captured by GHL during the selected period.",
    es: "Llamadas telefónicas entrantes capturadas por GHL durante el periodo seleccionado.",
  },
  connected_calls: {
    en: "Outbound GHL calls that the platform classified as connected/answered. This does not include WhatsApp calls made outside GHL.",
    es: "Llamadas salientes de GHL que la plataforma clasificó como conectadas/contestadas. No incluye llamadas de WhatsApp realizadas fuera de GHL.",
  },
  recorded_call_time: {
    en: "Total call duration reported by GHL for the selected period. External or WhatsApp call duration may be absent.",
    es: "Duración total de llamadas reportada por GHL en el periodo seleccionado. La duración de llamadas externas o de WhatsApp puede no estar incluida.",
  },
  whatsapp_inbound: {
    en: "WhatsApp messages received by the institutional channel. Message count is not the same as unique people responding.",
    es: "Mensajes de WhatsApp recibidos por el canal institucional. El número de mensajes no equivale a personas únicas que respondieron.",
  },
  whatsapp_manual_outbound: {
    en: "WhatsApp messages sent manually by a person from the shared channel, excluding workflow automation where identifiable.",
    es: "Mensajes de WhatsApp enviados manualmente por una persona desde el canal compartido, excluyendo automatizaciones cuando pueden identificarse.",
  },
  whatsapp_automated: {
    en: "WhatsApp messages identified as sent by automated workflows rather than a person.",
    es: "Mensajes de WhatsApp identificados como enviados por workflows automatizados y no por una persona.",
  },
  whatsapp_conversations: {
    en: "Conversation activity observed in WhatsApp. Daily totals can repeat the same contact on different days and should not be read as unique monthly leads.",
    es: "Actividad de conversaciones observada en WhatsApp. Los totales diarios pueden repetir al mismo contacto en distintos días y no deben leerse como leads mensuales únicos.",
  },
  whatsapp_contacts: {
    en: "Distinct contacts observed within each daily WhatsApp aggregation. Summing days can count the same contact more than once across a period.",
    es: "Contactos distintos observados dentro de cada agregación diaria de WhatsApp. Al sumar varios días, un mismo contacto puede contarse más de una vez en el periodo.",
  },
};

const STAGE_DEFINITION_KEYS: Record<string, string> = {
  "Cliente potencial": "new_leads",
  "No responde": "no_response",
  "Seguimiento": "follow_up",
  "No responde / Seguimiento": "legacy_follow_up",
  "No fit": "no_fit",
  "Lost / Sin continuidad": "lost",
  Fit: "fit",
  Qualified: "fit",
  "School Tour agendado": "school_tours_booked",
  "School Tour atendido": "school_tours_attended",
  "Pasadía agendada": "trial_days_booked",
  "Pasadía asistida": "trial_days_showed",
  Retroalimentación: "feedback",
  "En evaluación": "evaluation",
  "Inscripción en proceso": "enrollment_process",
  Inscrito: "closed",
};

export function stageConceptDefinition(stage: string | null | undefined, locale: Locale): string | null {
  if (!stage) return conceptDefinition("current_stage", locale);
  const key = STAGE_DEFINITION_KEYS[stage];
  return key ? conceptDefinition(key, locale) : conceptDefinition("current_stage", locale);
}

export function conceptDefinition(key: string, locale: Locale): string | null {
  const value = DEFINITIONS[key];
  return value ? value[locale] : null;
}

export function metricLabel(key: string, locale: Locale, fallback?: string): string {
  const labels: Record<string, { en: string; es: string }> = {
    new_leads: { en: "New Leads", es: "Leads Totales" },
    number_of_dials: { en: "Number of Dials", es: "Llamadas" },
    unique_contacted_leads: { en: "Unique Contacted Leads", es: "Leads Únicos Contactados" },
    responded_leads: { en: "Responded", es: "Respondieron" },
    meaningful_conversations: { en: "Meaningful Conversations", es: "Conversaciones Significativas" },
    qualified_leads: { en: "Qualified / Fit", es: "Qualified / Fit" },
    school_tours_booked: { en: "School Tours Booked", es: "ST Booked" },
    school_tours_today: { en: "School Tours Today", es: "School Tours Hoy" },
    school_tours_attended: { en: "School Tours Attended", es: "ST Attended" },
    trial_days_booked: { en: "Trial Days Booked", es: "Pasadías Agendadas" },
    trial_days_showed: { en: "Trial Days Showed", es: "Pasadías Asistidas" },
    closed: { en: "Closed", es: "Inscritos / Closed" },
    ads_leads: { en: "Ads Leads", es: "Leads Ads" },
    organic_leads: { en: "Organic Leads", es: "Leads Orgánicos" },
    contacted_reported: { en: "Contact Attempts", es: "Contactados" },
    responses_reported: { en: "Responses", es: "# Respuestas" },
  };
  return labels[key]?.[locale] ?? fallback ?? key;
}
