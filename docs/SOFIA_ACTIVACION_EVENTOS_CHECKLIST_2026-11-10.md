# Sofía — activación por eventos (10 nov 2026)

## Estado ejecutado
- Supabase: extensiones pg_cron y pg_net habilitadas.
- Cron: `milhano-sofia-due-campaigns` cada minuto **solo en PostgreSQL**, sin consumo de n8n cuando no hay contactos pendientes.
- Función protegida: `sofia_internal.wake_due_campaigns()`. Si no hay trabajo, retorna `empty`; si la compuerta no está activada, `disabled`.
- Compuerta: `sofia_internal.scheduler_control.enabled=false` (intencionadamente).
- Hasta 20 contactos por invocación de WF06; cuando quedan pendientes, el próximo ciclo de SQL podrá solicitar otro bloque.
- Vault preparado: `milhano_sofia_wf06_webhook` y `milhano_sofia_wf06_token`. El secreto **no se guarda en GitHub**.
- WF06 en este repositorio: disparador Webhook POST autenticado (Header Auth); NO importar y activar sin asociar su credencial.
- WF07 en este repositorio: disparador Webhook POST autenticado; requiere credencial de ElevenLabs y que Post Call V2 invoque su webhook.
- No se enviaron autorizaciones ni se habilitaron nuevas llamadas durante la instalación.

## Paso indispensable en n8n (sin acceso API desde ChatGPT)
1. En WF06 publicado, sustituir `Schedule | Every Minute` por el webhook del JSON actualizado en GitHub (`POST /webhook/milhano-sofia-due-campaigns`). No duplicar el workflow como un segundo planificador activo.
2. En su Webhook seleccionar `Authentication: Header Auth`. Credencial: header `X-Milhano-Scheduler-Token` y valor que el administrador recupera en Supabase SQL Editor con:
   `select decrypted_secret from vault.decrypted_secrets where name='milhano_sofia_wf06_token';`
   No copiar el secreto a GitHub o a logs públicos.
3. Comprobar que el resto de WF06 conserva las credenciales existentes `Supabase Milhano` y `Milhano GHL PrivInt`, y que llama a WF03 existente. Publicarlo y verificar el webhook con una petición sin credencial: debe devolver 401, y con credencial y sin campañas: 200 sin llamadas.
4. WF07: sustituir el cron por el Webhook POST `/webhook/milhano-sofia-postcall-reconcile`, con Header Auth; asociar credenciales válidas `xi-api-key` de ElevenLabs en los dos nodos GET. No publicar sin testear credenciales.
5. WF04 Post Call V2 existente: añadir *una única* solicitud POST a WF07 **después** del procesamiento exitoso, enviando `{conversation_id:<id>}` con el Header Auth configurado. No crear un segundo webhook Post Call directamente en ElevenLabs.
6. Verificar por ejecución que WF07 obtiene la conversación, compara el agente/branch principal y llama a la RPC `milhano_ai_record_final_call`. No considerar `200` prueba de llamada; confirmar la fila en Supabase.
7. La API WhatsApp de ElevenLabs solicita permiso nuevo solamente si no está concedido; si ya está concedido, programa una llamada inmediata. Verificar este comportamiento con el contacto de prueba antes de usar la función de reintentos en un lote de familias.
8. Para activar el programador SQL, tras pasar pruebas y con **solo un WF06 receptor publicado**:
   `update sofia_internal.scheduler_control set enabled=true,updated_at=now() where singleton=true;`
9. En el dashboard, crear lote 20 con ventana futura. Comprobar registros `milhano_ai_dispatch_attempts`, `milhano_ai_campaign_members` y resultados `milhano_ai_call_insights` antes de lotes mayores.

## Cómo detener
`update sofia_internal.scheduler_control set enabled=false,updated_at=now() where singleton=true;`
La compuerta `public.milhano_ai_runtime_control.live_dispatch_enabled` controla también el despacho global. No deshabilitar WF03/WF04 productivos para detener solo las campañas.

## Límites y advertencias
- Sincronización de cambios GitHub -> n8n NO es automática.
- El archivo WF07 anteriormente apuntaba a auth HTTP mal definida; ahora exige credenciales explícitas.
- La recepción de eventos Post Call sin respuesta debe verificarse con casos reales; si ElevenLabs no emite Post Call para un intento, se necesitará una conciliación de recuperación de baja frecuencia.
- No hay pruebas demostrando todavía que WF03 permita segundo intento tras una primera llamada con permiso vigente; tampoco está verificado límite de timbrado 30-45 s.
- No eliminar backups hasta validar al menos un segundo intento y un lote.
