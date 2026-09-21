export type StudentFormCode = "form_1" | "form_2" | "form_3" | "form_4" | "form_5";
export type StudentDefinitionCode =
  | "form_1_profile"
  | "form_2_observation"
  | "form_3_evaluation"
  | "form_4_piap"
  | "form_4_review"
  | "form_5_interview";

export type StudentFormStatus = "none" | "incomplete" | "complete";

export type AbcEntry = {
  time: string;
  antecedent: string;
  behavior: string;
  consequence: string;
};

export type StudentFieldValue = string | number | boolean | string[] | AbcEntry[] | null;
export type StudentPayload = Record<string, StudentFieldValue>;

export type StudentFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "select"
  | "scale"
  | "checkboxGroup"
  | "abc";

export type StudentFormField = {
  key: string;
  label: string;
  labelEn?: string;
  type: StudentFieldType;
  placeholder?: string;
  options?: string[];
  allowOther?: boolean;
  otherPlaceholder?: string;
  helper?: string;
  span?: "full" | "half";
};

export type StudentFormSection = {
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  fields: StudentFormField[];
};

export type StudentFormDefinition = {
  code: StudentDefinitionCode;
  formCode: StudentFormCode;
  title: string;
  titleEn?: string;
  shortTitle: string;
  shortTitleEn?: string;
  confidential: boolean;
  multiple: boolean;
  sections: StudentFormSection[];
};

const scaleOptions = ["1 · Nunca / casi nunca", "2 · En ocasiones", "3 · Frecuentemente", "4 · Constantemente / siempre"];

export const studentFormDefinitions: Record<StudentDefinitionCode, StudentFormDefinition> = {
  form_1_profile: {
    code: "form_1_profile",
    formCode: "form_1",
    title: "Formato digital del alumno",
    shortTitle: "Formato 1",
    confidential: false,
    multiple: false,
    sections: [
      {
        title: "1. Datos Generales e Identificación",
        fields: [
          { key: "full_name", label: "Nombre completo", type: "text" },
          { key: "age", label: "Edad", type: "number", span: "half" },
          { key: "grade", label: "Grado", type: "text", span: "half" },
          { key: "group", label: "Grupo", type: "text", span: "half" },
          { key: "photo_recent", label: "Foto reciente", type: "text" },
          { key: "languages", label: "Idioma(s) y nivel", type: "textarea" },
          { key: "medical_alerts", label: "Alertas de salud / médicas", type: "textarea" },
        ],
      },
      {
        title: "2. Perfil Académico y Diagnóstico de Entrada",
        fields: [
          { key: "performance_level", label: "Nivel de desempeño", type: "select", options: ["Avanzado", "En desarrollo", "Requiere apoyo prioritario"] },
          { key: "academic_strengths", label: "Fortalezas académicas", type: "textarea" },
          { key: "opportunity_areas", label: "Áreas de oportunidad", type: "textarea" },
          { key: "performance_history", label: "Historial de desempeño", type: "textarea" },
          { key: "diagnosis_status", label: "Diagnóstico psicopedagógico, neurológico o psicológico", type: "select", options: ["Sí", "No", "En proceso de evaluación"] },
          { key: "diagnosis_detail", label: "Especificación del diagnóstico / estado", type: "textarea", helper: "Para esta V1 todos los campos son requeridos. Si no aplica, registrar “No aplica”." },
        ],
      },
      {
        title: "3. Estilo de Aprendizaje y Dinámica de Trabajo",
        fields: [
          { key: "preferred_learning_channel", label: "Canal / estrategia predilecta", type: "checkboxGroup", options: ["Visual", "Auditivo", "Kinestésico", "Práctico"] },
          { key: "work_pace", label: "Ritmo de trabajo", type: "select", options: ["Rápido", "Promedio", "Requiere tiempo adicional"] },
          { key: "autonomy_level", label: "Nivel de autonomía", type: "select", options: ["Independiente", "Requiere supervisión periódica", "Alto seguimiento"] },
          { key: "ideal_work_mode", label: "Modalidad ideal de trabajo", type: "select", options: ["Individual", "En parejas", "Pequeños grupos"] },
          { key: "attention_level", label: "Atención y funciones ejecutivas", type: "textarea" },
          { key: "strategies_that_work", label: "Estrategias que funcionan con el alumno", type: "textarea" },
        ],
      },
      {
        title: "4. Perfil Personal y Socioemocional",
        fields: [
          { key: "personality_interests", label: "Personalidad, intereses, pasatiempos y talentos", type: "textarea" },
          { key: "motivators_goals", label: "Motivadores y objetivos", type: "textarea" },
          { key: "frustration_tolerance", label: "Tolerancia a la frustración", type: "textarea" },
          { key: "self_esteem_level", label: "Nivel de autoestima", type: "textarea" },
          { key: "sensitive_factors", label: "Factores de estrés o temas sensibles", type: "textarea" },
          { key: "emotional_self_regulation_strategies", label: "Estrategias de autorregulación emocional efectivas", type: "textarea" },
        ],
      },
      {
        title: "5. Red de Relaciones y Entorno Social",
        fields: [
          { key: "family_dynamics", label: "Dinámica familiar", type: "textarea" },
          { key: "school_interaction", label: "Interacción escolar", type: "textarea" },
          { key: "authority_relationship", label: "Relación con figuras de autoridad", type: "textarea" },
          { key: "significant_relationships", label: "Relaciones interpersonales significativas", type: "textarea" },
        ],
      },
      {
        title: "6. Plan de Apoyo y Vinculación Externa",
        fields: [
          { key: "external_professional_name", label: "Centro o profesional externo", type: "text" },
          { key: "external_professional_contact", label: "Datos de contacto", type: "text" },
          { key: "family_authorization", label: "Autorización de la familia para solicitar / compartir reportes", type: "select", options: ["Sí", "No", "Pendiente"] },
          { key: "external_specialist_suggestions", label: "Sugerencias e indicaciones del especialista externo", type: "textarea" },
        ],
      },
    ],
  },
  form_2_observation: {
    code: "form_2_observation",
    formCode: "form_2",
    title: "Protocolo de Observación Conductual en Aula",
    shortTitle: "Formato 2",
    confidential: true,
    multiple: true,
    sections: [
      {
        title: "1. Datos Generales de la Observación",
        fields: [
          { key: "observation_date", label: "Fecha", type: "date", span: "half" },
          { key: "observation_time", label: "Hora", type: "time", span: "half" },
          { key: "grade_group", label: "Grado y grupo", type: "text" },
          { key: "subject_activity", label: "Materia / actividad", type: "text" },
          { key: "teacher_in_charge", label: "Docente a cargo", type: "text" },
          { key: "observation_type", label: "Tipo de observación", type: "select", options: ["Grupal exploratoria", "Seguimiento individual", "Solicitada por docente"], allowOther: true, otherPlaceholder: "Especifica el tipo de observación…" },
          { key: "session_objective", label: "Objetivo de la sesión", type: "textarea" },
        ],
      },
      {
        title: "2A. Adaptación y Autorregulación",
        fields: [
          { key: "adaptation_frustration_scale", label: "Tolerancia a la frustración", type: "scale", options: scaleOptions },
          { key: "wait_turns_scale", label: "Manejo de tiempos de espera y turnos", type: "scale", options: scaleOptions },
          { key: "instructions_limits_scale", label: "Respuesta ante instrucciones o límites", type: "scale", options: scaleOptions },
          { key: "adaptation_observations", label: "Observaciones / conductas concretas", type: "textarea" },
        ],
      },
      {
        title: "2B. Atención y Trabajo Académico",
        fields: [
          { key: "attention_sustained_scale", label: "Mantenimiento de la atención sostenida", type: "scale", options: scaleOptions },
          { key: "task_start_finish_scale", label: "Inicio y terminación de tareas en tiempo", type: "scale", options: scaleOptions },
          { key: "materials_organization_scale", label: "Organización de materiales de trabajo", type: "scale", options: scaleOptions },
          { key: "academic_observations", label: "Observaciones / conductas concretas", type: "textarea" },
        ],
      },
      {
        title: "2C. Interacción Social y Convivencia",
        fields: [
          { key: "group_integration_scale", label: "Integración en actividades grupales", type: "scale", options: scaleOptions },
          { key: "peer_relationship_scale", label: "Relación con pares", type: "scale", options: scaleOptions },
          { key: "authority_attitude_scale", label: "Relación y actitud hacia la autoridad", type: "scale", options: scaleOptions },
          { key: "social_observations", label: "Observaciones / conductas concretas", type: "textarea" },
        ],
      },
      {
        title: "2D. Dinámica Ambiental y Contexto",
        fields: [
          { key: "noise_distribution_scale", label: "Nivel de ruido y distribución del aula", type: "scale", options: scaleOptions },
          { key: "instruction_clarity_scale", label: "Claridad de las instrucciones del docente", type: "scale", options: scaleOptions },
          { key: "activity_type_scale", label: "Tipo de actividad / adecuación al contexto", type: "scale", options: scaleOptions },
          { key: "environment_observations", label: "Observaciones del contexto", type: "textarea" },
        ],
      },
      {
        title: "3. Registro A-B-C",
        description: "Agregar las conductas disruptivas o atípicas que requieran análisis funcional.",
        fields: [
          { key: "abc_entries", label: "Registros A-B-C", type: "abc" },
        ],
      },
      {
        title: "Análisis Post-Observación",
        fields: [
          { key: "finding_classification", label: "Clasificación del hallazgo", type: "select", options: ["Verde · Evento puntual / aislado", "Amarillo · Alerta temprana / en monitoreo", "Rojo · Patrón confirmado / caso prioritario"] },
          { key: "case_meeting_applicable", label: "¿Reunión de caso aplica?", type: "select", options: ["Sí", "No", "Por definir"] },
          { key: "case_meeting_notes", label: "Notas / acuerdos de reunión de caso", type: "textarea" },
        ],
      },
    ],
  },
  form_3_evaluation: {
    code: "form_3_evaluation",
    formCode: "form_3",
    title: "Protocolo de Evaluación Psicopedagógica Individual",
    shortTitle: "Formato 3",
    confidential: true,
    multiple: true,
    sections: [
      {
        title: "1. Entrevista / Conversación Clínico-Educativa",
        fields: [
          { key: "evaluation_date", label: "Fecha de evaluación", type: "date", span: "half" },
          { key: "evaluation_type", label: "Tipo", type: "select", options: ["Evaluación inicial", "Reevaluación"], span: "half" },
          { key: "school_perception", label: "Percepción de la escuela", type: "textarea" },
          { key: "self_concept_self_efficacy", label: "Autoconcepto y autoeficacia", type: "textarea" },
          { key: "social_dynamics_peers", label: "Dinámica social y pares", type: "textarea" },
          { key: "family_environment_routines", label: "Entorno familiar y rutinas", type: "textarea" },
          { key: "level_adjustment_notes", label: "Ajustes según el nivel / notas de aplicación", type: "textarea" },
        ],
      },
      {
        title: "2. Áreas a Evaluar",
        fields: [
          { key: "socioemotional_conductual_findings", label: "A. Socioemocional y conductual", type: "textarea" },
          { key: "cognitive_executive_findings", label: "B. Cognitiva y funciones ejecutivas", type: "textarea" },
          { key: "academic_learning_findings", label: "C. Disposición académica y aprendizaje", type: "textarea" },
          { key: "family_contextual_findings", label: "D. Dinámica familiar y contextual", type: "textarea" },
        ],
      },
      {
        title: "3A. Información requerida del Docente",
        fields: [
          { key: "performance_vs_group", label: "Desempeño respecto a la media del grupo", type: "select", options: ["Alto", "Medio", "Bajo"] },
          { key: "task_class_exam_compliance", label: "Cumplimiento de tareas, trabajos en clase y exámenes", type: "textarea" },
          { key: "oral_written_instructions", label: "Capacidad de seguir instrucciones orales y escritas", type: "textarea" },
          { key: "pedagogical_strategies_tried", label: "Estrategias pedagógicas probadas y efectividad", type: "textarea" },
        ],
      },
      {
        title: "3B. Información requerida de Padres / Tutores",
        fields: [
          { key: "development_history", label: "Antecedentes del desarrollo", type: "textarea" },
          { key: "family_structure_dynamics", label: "Estructura y dinámica familiar", type: "textarea" },
          { key: "home_habits", label: "Hábitos en casa", type: "textarea" },
          { key: "prior_school_history", label: "Historial escolar previo", type: "textarea" },
        ],
      },
      {
        title: "4. Fortalezas, Necesidades y Prioridades",
        fields: [
          { key: "strengths", label: "Fortalezas", type: "textarea" },
          { key: "needs", label: "Necesidades", type: "textarea" },
          { key: "intervention_priorities", label: "Prioridades de intervención", type: "textarea" },
          { key: "priority_level", label: "Nivelación de prioridades", type: "select", options: ["Nivel 1 · Inmediata / Aula", "Nivel 2 · Acompañamiento Escolar Interno", "Nivel 3 · Derivación y Canalización Externa"] },
          { key: "classroom_accommodations", label: "Adecuaciones en el aula", type: "textarea" },
          { key: "internal_support_plan", label: "Plan de acompañamiento escolar interno", type: "textarea" },
          { key: "external_referral_plan", label: "Plan de derivación / canalización externa", type: "textarea" },
        ],
      },
      {
        title: "5. Documentación Precisa de Resultados",
        fields: [
          { key: "documentation_outputs", label: "Documentos derivados", type: "checkboxGroup", options: ["Reporte de observaciones psicopedagógico", "Carta compromiso alumno/padres", "Acuerdos académicos", "Acta de hechos", "Canalización psicológica"] },
        ],
      },
    ],
  },
  form_4_piap: {
    code: "form_4_piap",
    formCode: "form_4",
    title: "Plan de Intervención y Acompañamiento Psicopedagógico",
    shortTitle: "Formato 4",
    confidential: false,
    multiple: true,
    sections: [
      {
        title: "I. Datos Generales y Semaforización",
        fields: [
          { key: "elaboration_date", label: "Fecha de elaboración", type: "date", span: "half" },
          { key: "student_name", label: "Nombre del alumno", type: "text" },
          { key: "grade_group", label: "Grado y grupo", type: "text", span: "half" },
          { key: "level", label: "Nivel", type: "select", options: ["Primaria", "Secundaria", "Preparatoria"], span: "half" },
          { key: "teacher_tutor", label: "Tutor/a docente", type: "text" },
          { key: "psychologist_in_charge", label: "Psicólogo a cargo", type: "text" },
          { key: "priority_level", label: "Nivel de prioridad / semaforización", type: "select", options: ["Nivel 1 · Amarillo / Preventivo", "Nivel 2 · Naranja / Moderado", "Nivel 3 · Rojo / Alto"] },
        ],
      },
      {
        title: "II. Diagnóstico Operativo",
        fields: [
          { key: "identified_need", label: "Situación / necesidad identificada", type: "textarea" },
          { key: "smart_objective", label: "Objetivo específico SMART", type: "textarea" },
        ],
      },
      {
        title: "III.1 Adaptaciones y Acciones del Docente",
        fields: [
          { key: "strategic_location", label: "Ubicación estratégica", type: "checkboxGroup", options: ["Asiento al frente / cerca del docente", "Lejos de distracciones", "Junto a un compañero tutor / positivo"] },
          { key: "pedagogical_accommodations", label: "Acomodaciones pedagógicas", type: "checkboxGroup", options: ["Segmentar instrucciones y verificar comprensión", "Tiempo adicional 20-30%", "Apoyos visuales", "Pausas activas breves"] },
          { key: "teacher_action_1", label: "Acción concreta del profesor 1", type: "textarea" },
          { key: "teacher_action_2", label: "Acción concreta del profesor 2", type: "textarea" },
        ],
      },
      {
        title: "III.2 Acciones de Psicología / Psicopedagogía",
        fields: [
          { key: "support_session_frequency", label: "Sesiones de acompañamiento", type: "select", options: ["Semanales", "Quincenales", "Mensuales"] },
          { key: "student_strategies", label: "Estrategias a trabajar con el alumno", type: "checkboxGroup", options: ["Autoinstrucciones y autorregulación / respiración", "Organización y gestión del tiempo", "Manejo de frustración e identificación emocional", "Habilidades sociales y asertividad"] },
          { key: "external_referral_type", label: "Derivación externa", type: "checkboxGroup", options: ["Neuropediatría / Psiquiatría", "Terapia Psicológica Externa", "Paidopsiquiatría", "Otro / especificar en notas"] },
          { key: "referral_status", label: "Estatus de la canalización", type: "select", options: ["A considerar", "Necesaria para un buen rendimiento académico y personal", "No aplica"] },
        ],
      },
      {
        title: "III.3 Acciones de Padres / Tutores",
        fields: [
          { key: "homework_start_time", label: "Inicio de horario fijo para tareas", type: "time", span: "half" },
          { key: "homework_end_time", label: "Fin de horario fijo para tareas", type: "time", span: "half" },
          { key: "backpack_agenda_monitoring", label: "Monitoreo de mochila y agenda", type: "select", options: ["Sí", "No", "Por implementar"] },
          { key: "bedtime", label: "Hora objetivo de sueño", type: "time", span: "half" },
          { key: "positive_reinforcement", label: "Refuerzo positivo acordado", type: "textarea" },
          { key: "family_action_1", label: "Acción concreta de la familia 1", type: "textarea" },
          { key: "family_action_2", label: "Acción concreta de la familia 2", type: "textarea" },
        ],
      },
      {
        title: "IV. Seguimiento y Evaluación de Progreso",
        fields: [
          { key: "progress_indicators", label: "Indicadores medibles de progreso", type: "textarea" },
          { key: "tracking_frequency", label: "Frecuencia de seguimiento", type: "select", options: ["Semanal", "Quincenal", "Mensual"] },
          { key: "measurement_evidence", label: "Evidencias / instrumentos de medición", type: "checkboxGroup", options: ["Registro de tareas en plataforma / bitácora", "Escala de observación rápida semanal", "Muestras de trabajo en clase", "Bitácora de sesiones de Psicología"] },
          { key: "first_review_date", label: "Fecha programada para primera revisión", type: "date" },
        ],
      },
      {
        title: "VI. Compromisos y Firmas",
        fields: [
          { key: "direction_name", label: "Nombre de Dirección General", type: "text" },
          { key: "psychologist_name", label: "Nombre de Psicología", type: "text" },
          { key: "teacher_name", label: "Nombre de maestra(o) titular", type: "text" },
          { key: "tutor_received_name", label: "Nombre de recibido del tutor", type: "text" },
        ],
      },
    ],
  },
  form_4_review: {
    code: "form_4_review",
    formCode: "form_4",
    title: "Revisión de PIAP",
    shortTitle: "Revisión PIAP",
    confidential: false,
    multiple: true,
    sections: [
      {
        title: "Seguimiento de PIAP",
        fields: [
          { key: "review_date", label: "Fecha de revisión", type: "date" },
          { key: "progress_observations", label: "Bitácora / observaciones de progreso", type: "textarea" },
          { key: "decision", label: "Decisión posterior", type: "select", options: ["Objetivo alcanzado", "En progreso · Mantener", "Ajuste de estrategias", "Escalamiento"] },
          { key: "decision_notes", label: "Decisiones, ajustes y notas", type: "textarea" },
          { key: "next_review_date", label: "Próxima fecha de revisión", type: "date" },
        ],
      },
    ],
  },

  form_5_interview: {
    code: "form_5_interview",
    formCode: "form_5",
    title: "Entrevista del Alumno",
    titleEn: "Student Interview",
    shortTitle: "Formato 5",
    shortTitleEn: "Form 5",
    confidential: false,
    multiple: true,
    sections: [
      {
        title: "1. Tu forma de aprender y trabajar (Estilo de Aprendizaje y Dinámica)",
        titleEn: "1. How you learn and work (Learning Style and Dynamics)",
        description: "¿Cómo sientes que aprendes mejor y qué te ayuda a trabajar a tu gusto?",
        descriptionEn: "How do you feel you learn best, and what helps you work comfortably?",
        fields: [
          { key: "learning_understanding", label: "1. ¿De qué manera sientes que entiendes más rápido los temas: cuando te los explican hablando, cuando ves dibujos y videos, ¿o cuando haces actividades prácticas y te mueves (kinestésico)?", labelEn: "1. How do you feel you understand topics more quickly: when they are explained verbally, when you see drawings and videos, or when you do hands-on activities and move around (kinesthetic)?", type: "textarea", span: "full" },
          { key: "class_pace", label: "2. ¿Cómo te sientes con el tiempo de las clases? ¿Sientes que el ritmo de trabajo va muy rápido, muy lento o justo a tu medida?", labelEn: "2. How do you feel about the pace of classes? Does the work feel too fast, too slow, or just right for you?", type: "textarea", span: "full" },
          { key: "work_preference", label: "3. ¿Cómo prefieres hacer tus tareas y actividades: tú solo/a, con un compañero/a o en un equipo pequeño?", labelEn: "3. How do you prefer to do your assignments and activities: by yourself, with a partner, or in a small group?", type: "textarea", span: "full" },
          { key: "attention_distractors", label: "4. ¿Qué tan fácil o difícil te resulta mantener la atención en clase? ¿Hay cosas en el salón que te distraen con frecuencia?", labelEn: "4. How easy or difficult is it for you to stay focused in class? Are there things in the classroom that often distract you?", type: "textarea", span: "full" },
          { key: "teacher_supports", label: "5. De las cosas que hace el maestro o maestra para explicarte (como dar indicaciones paso a paso o poner recordatorios en el pizarrón), ¿qué es lo que sientes que más te ayuda?", labelEn: "5. Of the things your teacher does to explain something to you (such as giving step-by-step instructions or putting reminders on the board), what do you feel helps you the most?", type: "textarea", span: "full" },
        ],
      },
      {
        title: "2. Tus emociones y cómo te sientes en la escuela (Perfil Socioemocional)",
        titleEn: "2. Your emotions and how you feel at school (Socioemotional Profile)",
        description: "¿Cómo te sientes contigo mismo/a y qué pasa cuando las cosas se ponen difíciles?",
        descriptionEn: "How do you feel about yourself, and what happens when things get difficult?",
        fields: [
          { key: "academic_feelings", label: "6. ¿Cómo te sientes con tus calificaciones y tus trabajos escolares? ¿Hay alguna materia que sientas que te cuesta más trabajo o te preocupe?", labelEn: "6. How do you feel about your grades and schoolwork? Is there a subject that feels more difficult or worries you?", type: "textarea", span: "full" },
          { key: "school_motivators", label: "7. ¿Qué actividades o temas te hacen sentir feliz, entusiasmado/a y con ganas de participar en la escuela?", labelEn: "7. What activities or topics make you feel happy, excited, and eager to participate at school?", type: "textarea", span: "full" },
          { key: "mistake_reaction", label: "8. Cuando un ejercicio no te sale a la primera o te equivocas, ¿qué sientes en ese momento?", labelEn: "8. When you do not get an exercise right the first time or make a mistake, what do you feel in that moment?", type: "textarea", span: "full" },
          { key: "school_stressors", label: "9. ¿Hay situaciones en el salón o en la escuela que te hagan sentir estresado/a, triste o molesto/a?", labelEn: "9. Are there situations in the classroom or at school that make you feel stressed, sad, or upset?", type: "textarea", span: "full" },
          { key: "self_regulation", label: "10. Cuando te sientes abrumado/a, enojado/a o con mucha ansiedad, ¿qué cosas o actividades te ayudan a calmarte y volver a sentirte bien?", labelEn: "10. When you feel overwhelmed, angry, or very anxious, what things or activities help you calm down and feel better again?", type: "textarea", span: "full" },
        ],
      },
      {
        title: "3. Tus relaciones con los demás (Red de Relaciones y Entorno Social)",
        titleEn: "3. Your relationships with others (Relationship Network and Social Environment)",
        description: "¿Cómo te sientes al convivir con tus compañeros, maestros y familia?",
        descriptionEn: "How do you feel when interacting with classmates, teachers, and family?",
        fields: [
          { key: "peer_integration", label: "11. ¿Cómo te sientes en el recreo y en los trabajos en equipo con tus compañeros? ¿Sientes que te integras con facilidad o prefieres estar solo/a?", labelEn: "11. How do you feel during recess and group work with your classmates? Do you feel you integrate easily, or do you prefer to be by yourself?", type: "textarea", span: "full" },
          { key: "conflict_resolution", label: "12. Cuando surge algún problema o discusión con un compañero/a, ¿cómo te sientes para resolverlo?", labelEn: "12. When a problem or disagreement comes up with a classmate, how do you feel about resolving it?", type: "textarea", span: "full" },
          { key: "teacher_trust", label: "13. ¿Cómo sientes la confianza y la relación con tus maestros? ¿Te sientes cómodo/a pidiéndoles ayuda cuando no entiendes algo o te sientes mal?", labelEn: "13. How do you feel about the trust and relationship you have with your teachers? Do you feel comfortable asking them for help when you do not understand something or do not feel well?", type: "textarea", span: "full" },
          { key: "home_support", label: "14. ¿Cómo te sientes con el apoyo que recibes en casa para hacer tus tareas o estudiar?", labelEn: "14. How do you feel about the support you receive at home for homework or studying?", type: "textarea", span: "full" },
        ],
      },
      {
        title: "4. Salud y apoyos externos (Salud y Vinculación Externa)",
        titleEn: "4. Health and external support (Health and External Coordination)",
        description: "¿Cómo te sientes respecto a tus cuidados diarios o visitas a especialistas?",
        descriptionEn: "How do you feel about your daily care or visits with specialists?",
        fields: [
          { key: "health_safety", label: "15. Si tienes alguna alergia o condición médica, ¿te sientes seguro/a y bien cuidado/a en la escuela?", labelEn: "15. If you have an allergy or medical condition, do you feel safe and well cared for at school?", type: "textarea", span: "full" },
          { key: "external_professional_support", label: "16. Si acudes con un profesional fuera de la escuela (como un psicólogo, regularizador o doctor), ¿cómo te sientes en esas sesiones y qué tanto sientes que te ayudan en tu día a día?", labelEn: "16. If you see a professional outside school (such as a psychologist, tutor, or doctor), how do you feel during those sessions and how much do you feel they help you in your daily life?", type: "textarea", span: "full" },
        ],
      },
    ],
  },
};

export function formDefinitionForCode(code: string): StudentFormDefinition | null {
  return studentFormDefinitions[code as StudentDefinitionCode] ?? null;
}

export function allFields(definition: StudentFormDefinition): StudentFormField[] {
  return definition.sections.flatMap((section) => section.fields);
}

export function valueIsFilled(value: StudentFieldValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function completionProgress(definition: StudentFormDefinition, payload: StudentPayload) {
  const fields = allFields(definition);
  const completed = fields.filter((field) => valueIsFilled(payload[field.key])).length;
  return { completed, total: fields.length };
}

export function statusLabel(status: StudentFormStatus | "empty") {
  if (status === "complete") return "Completo";
  if (status === "incomplete") return "Incompleto";
  return "Sin iniciar";
}
