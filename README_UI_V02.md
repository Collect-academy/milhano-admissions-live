# Milhano Ticketing UI V0.2 — parche incremental

Este ZIP se superpone en el repositorio existente (rama de Preview). No es un proyecto independiente.

## Cambios
- Mejoras en `app/boletos/page.tsx` y `app/boletos/ticketing.css`.
- Mantiene los endpoints del parche integrado anterior, proxy y dependencias.
- Añade **demostración visual local** cuando la taquilla está cerrada: no autentica, no reserva, no paga, no accede a información privada.
- Plano responsive desplazable de 210 posiciones y dos bloques separados visualmente.
- Compra sandbox REAL aún requiere datos, apertura de evento controlada y autorizaciones backend.

## Seguridad y límites
- Vista de demostración no representa asientos reales. Es ilustrativa.
- NO activar Stripe productivo ni abrir ventas con este parche. Deben completarse concilación de Stripe, carga de inventario, pruebas de concurrencia y auditoría de permisos.
- **No copiar tokens PIN a repositorio** ni exponer DATABASE_URL en navegador.
- No instalar todo el ZIP sin comparar `proxy.ts` y `package.json` con el commit actual de producción.

## Instrucciones
1. Crear rama `feature/ticketing-ui-v02`.
2. Superponer los archivos; si ya se instaló V0.1, basta copiar los dos archivos de `app/boletos/`.
3. Revisar diff; `npm install`, `npm run build`.
4. Subir rama y desplegar Preview en Vercel.
5. Abrir `/boletos` y seleccionar «Ver demostración del selector».
