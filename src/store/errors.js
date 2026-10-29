import { createSlice } from '@reduxjs/toolkit';

export const humanizeError = (payload) => {
  if (!payload) return 'Ocurrió un error inesperado.';
  let msg = typeof payload === 'string' ? payload : (payload.message || String(payload));

  // Trazas técnicas de Jetty / Java / Stack traces
  if (
    msg.includes('org.eclipse.jetty') || 
    msg.includes('QueuedThreadPool') || 
    msg.includes('SecurityException') ||
    msg.includes('java.base') ||
    msg.includes('Thread.run') ||
    msg.toLowerCase().includes('device limit') ||
    msg.toLowerCase().includes('devicelimit') ||
    msg.includes('Access denied') ||
    msg.includes('Forbidden')
  ) {
    if (msg.toLowerCase().includes('device limit') || msg.toLowerCase().includes('devicelimit')) {
      return 'Has alcanzado el límite máximo de vehículos permitidos para tu cuenta.';
    }
    return 'No tienes permisos para realizar esta acción. Esta función está reservada para el administrador o revendedor de tu cuenta.';
  }

  // Errores de duplicidad de IMEI o IDs
  if (msg.includes('Duplicate') || msg.includes('uniqueId') || msg.includes('already exists')) {
    return 'Ya existe un vehículo registrado con este identificador (IMEI o ID único).';
  }

  // Errores de conexión o timeout
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('504 Gateway') || msg.includes('Time-out')) {
    return 'Error de conexión con el servidor. Intenta nuevamente en unos momentos.';
  }

  // Si tiene salto de línea con trazas 'at org.' o 'at java.'
  if (msg.includes('\n\tat ') || msg.includes('\tat ')) {
    const firstLine = msg.split('\n')[0].replace(/^.*Exception:\s*/, '').trim();
    if (firstLine && !firstLine.includes('org.') && !firstLine.includes('java.')) {
      return firstLine;
    }
    return 'No tienes permisos para realizar esta acción por restricciones de tu perfil.';
  }

  return msg;
};

const { reducer, actions } = createSlice({
  name: 'errors',
  initialState: {
    errors: [],
  },
  reducers: {
    push(state, action) {
      state.errors.push(humanizeError(action.payload));
    },
    pop(state) {
      if (state.errors.length) {
        state.errors.shift();
      }
    },
  },
});

export { actions as errorsActions };
export { reducer as errorsReducer };

