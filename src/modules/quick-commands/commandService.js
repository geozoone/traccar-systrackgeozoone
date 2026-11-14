/**
 * Servicio Modular de Comandos Rápidos Protegidos (Estándar Wialon)
 * Ubicación: src/modules/quick-commands/commandService.js
 *
 * Responsabilidades:
 * 1. Verificar contraseña del usuario actual contra /api/session
 * 2. Gestionar plantillas de comandos por protocolo (CalAmp, GT06/J16, Coban, Teltonika, Syrus, etc.)
 * 3. Enviar el comando a Traccar (/api/commands/send) con respaldo automático por plantilla
 * 4. Registrar auditoría forense en /modulo/audit/command sin bloquear la operación
 */

export const CUSTOM_PROTOCOL_FALLBACKS = {
  calamp: {
    engineStop: '!R,1,1',
    engineResume: '!R,1,0',
    rebootDevice: '!R1',
  },
  gt06: {
    engineStop: 'RELAY,1#',
    engineResume: 'RELAY,0#',
    rebootDevice: 'RESET#',
  },
  gps103: {
    engineStop: 'stop123456',
    engineResume: 'resume123456',
    rebootDevice: 'reset123456',
  },
  coban: {
    engineStop: 'stop123456',
    engineResume: 'resume123456',
    rebootDevice: 'reset123456',
  },
  teltonika: {
    engineStop: 'setdigout 1',
    engineResume: 'setdigout 0',
    rebootDevice: 'cpureset',
  },
  syrus: {
    engineStop: '>SXP11<',
    engineResume: '>SXP10<',
    rebootDevice: '>SRT<',
  },
  meitrack: {
    rebootDevice: 'F00',
  },
  skypatrol: {
    rebootDevice: 'AT$RESET',
  },
};

/**
 * Determina si el dispositivo cuenta con plantilla de Reinicio (nativa en Traccar o por plantilla de protocolo).
 */
export const hasRebootTemplate = (position, nativeTypes = []) => {
  if (Array.isArray(nativeTypes) && nativeTypes.includes('rebootDevice')) {
    return true;
  }
  const protocol = String(position?.protocol || '').toLowerCase();
  if (protocol && CUSTOM_PROTOCOL_FALLBACKS[protocol]?.rebootDevice) {
    return true;
  }
  return false;
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
 * Primero intenta el comando nativo si Traccar lo soporta para ese protocolo;
 * si no (ej. rebootDevice en GT06/Teltonika o cualquier comando en CalAmp),
 * envía automáticamente la plantilla oficial del fabricante vía 'custom'.
 */
export const sendQuickCommand = async (device, position, actionType, nativeTypes = []) => {
  if (!device || !device.id) {
    throw new Error('Dispositivo no válido.');
  }

  const protocol = String(position?.protocol || '').toLowerCase();
  const protocolFallbacks = CUSTOM_PROTOCOL_FALLBACKS[protocol] || {};
  const isNativeSupported = Array.isArray(nativeTypes) && nativeTypes.includes(actionType);

  // Usar comando nativo si Traccar lo declara soportado; si no, usar plantilla custom del protocolo
  const payload = !isNativeSupported && protocolFallbacks[actionType]
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

  let response = await fetch('/api/commands/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Si falló el comando nativo y tenemos plantilla custom de respaldo, reintentar con la plantilla
  if (!response.ok && payload.type !== 'custom' && protocolFallbacks[actionType]) {
    response = await fetch('/api/commands/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: device.id,
        type: 'custom',
        attributes: { data: protocolFallbacks[actionType] },
      }),
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || 'El servidor rechazó el envío del comando.');
  }

  return {
    queued: response.status === 202,
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
