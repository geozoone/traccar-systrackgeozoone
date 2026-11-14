/**
 * Servicio Modular de Comandos Rápidos Protegidos (Estándar Wialon)
 * Ubicación: src/modules/quick-commands/commandService.js
 *
 * Responsabilidades:
 * 1. Verificar contraseña del usuario actual contra /api/session
 * 2. Enviar el comando a Traccar (/api/commands/send) con soporte inteligente de respaldo (ej. CalAmp)
 * 3. Registrar auditoría forense en /modulo/audit/command sin bloquear la operación
 */

const CUSTOM_PROTOCOL_FALLBACKS = {
  calamp: {
    engineStop: '!R,1,1',
    engineResume: '!R,1,0',
    rebootDevice: '!R1',
  },
};

/**
 * Paso 1: Verifica la contraseña del usuario activo contra Traccar.
 */
export const verifyUserPassword = async (email, password) => {
  if (!email || !password) return false;
  try {
    const credentials = btoa(unescape(encodeURIComponent(`${email}:${password}`)));
    const response = await fetch('/api/session', {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });
    return response.ok;
  } catch (err) {
    return false;
  }
};

/**
 * Paso 2: Envía el comando rápido a Traccar.
 * Si el protocolo del GPS (ej. CalAmp) solo soporta comando personalizado ('custom'),
 * aplica automáticamente la trama oficial del fabricante como respaldo.
 */
export const sendQuickCommand = async (device, position, actionType) => {
  if (!device || !device.id) {
    throw new Error('Dispositivo no válido.');
  }

  const protocol = String(position?.protocol || '').toLowerCase();
  const protocolFallbacks = CUSTOM_PROTOCOL_FALLBACKS[protocol];

  // Si es un protocolo como CalAmp que en Traccar no tiene encoder predefinido, usar trama directa
  const initialPayload = protocolFallbacks && protocolFallbacks[actionType]
    ? {
        deviceId: device.id,
        type: 'custom',
        attributes: { data: protocolFallbacks[actionType] },
      }
    : {
        deviceId: device.id,
        type: actionType,
        attributes: {},
      };

  const response = await fetch('/api/commands/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initialPayload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || 'El servidor rechazó el envío del comando.');
  }

  let savedResult = false;
  if (response.status === 202) {
    savedResult = true; // Encolado para entrega en cuanto el GPS reporte
  }

  return {
    queued: savedResult,
    status: response.status,
  };
};

/**
 * Paso 3: Registra el evento en la tabla de auditoría del conector (No bloqueante).
 */
export const logCommandAudit = async ({
  user,
  device,
  position,
  actionType,
  speedKmh,
  resultStatus,
}) => {
  try {
    await fetch('/modulo/audit/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user?.id || null,
        userEmail: user?.email || '',
        userName: user?.name || '',
        deviceId: device?.id || null,
        deviceName: device?.name || '',
        uniqueId: device?.uniqueId || '',
        commandType: actionType,
        speedKnots: Number(position?.speed || 0),
        speedFormatted: `${speedKmh} km/h`,
        latitude: position?.latitude || null,
        longitude: position?.longitude || null,
        resultStatus: resultStatus || 'SENT',
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // No interrumpir al usuario si el log de auditoría tarda o falla
  }
};
