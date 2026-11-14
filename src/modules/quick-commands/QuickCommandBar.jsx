import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useDeviceReadonly } from '../../common/util/permissions';
import {
  hasEngineCut,
  canExecuteQuickCommands,
} from '../core/deviceAdapter';
import { hasRebootTemplate } from './commandService';
import QuickCommandModal from './QuickCommandModal';

/**
 * Barra Modular de Comandos Rápidos Protegidos (Estilo Wialon)
 * Ubicación: src/modules/quick-commands/QuickCommandBar.jsx
 *
 * Reglas de visibilidad:
 * 1. Si el usuario es de solo lectura ("el primo"), no renderiza nada.
 * 2. Si el vehículo tiene "Sin especificar" o "Sin Corte (Solo Rastreo)", oculta Apagar/Encender.
 * 3. El botón "Reinicio GPS" solo se muestra si el equipo/protocolo tiene plantilla de reinicio.
 */
const QuickCommandBar = ({ device, position }) => {
  const currentUser = useSelector((state) => state.session.user);
  const deviceReadonly = useDeviceReadonly();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState('engineStop');
  const [nativeTypes, setNativeTypes] = useState([]);

  useEffect(() => {
    let active = true;
    if (!device?.id) {
      setNativeTypes([]);
      return () => {};
    }
    fetch(`/api/commands/types?${new URLSearchParams({ deviceId: device.id }).toString()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (active && Array.isArray(list)) {
          setNativeTypes(list.map((it) => it.type));
        }
      })
      .catch(() => {
        if (active) setNativeTypes([]);
      });
    return () => {
      active = false;
    };
  }, [device?.id, position?.protocol]);

  if (!device) return null;

  // Bloqueo para usuarios invitados / solo lectura
  if (!canExecuteQuickCommands(currentUser, deviceReadonly)) {
    return null;
  }

  const showMotorButtons = hasEngineCut(device);
  const showRebootButton = hasRebootTemplate(position, nativeTypes);

  if (!showMotorButtons && !showRebootButton) {
    return null;
  }

  const handleOpenCommand = (actionType) => {
    setSelectedAction(actionType);
    setModalOpen(true);
  };

  const btnBaseStyle = {
    flex: 1,
    padding: '6px 6px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    transition: 'opacity 0.15s ease',
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: '1px dashed #cbd5e1',
        }}
      >
        {showMotorButtons && (
          <>
            <button
              type="button"
              onClick={() => handleOpenCommand('engineStop')}
              style={{
                ...btnBaseStyle,
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
              }}
              title="Bloquear Motor (Requiere contraseña)"
            >
              🔒 Apagar
            </button>

            <button
              type="button"
              onClick={() => handleOpenCommand('engineResume')}
              style={{
                ...btnBaseStyle,
                backgroundColor: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0',
              }}
              title="Restaurar Motor (Requiere contraseña)"
            >
              🔓 Encender
            </button>
          </>
        )}

        {showRebootButton && (
          <button
            type="button"
            onClick={() => handleOpenCommand('rebootDevice')}
            style={{
              ...btnBaseStyle,
              backgroundColor: '#fffbeb',
              color: '#b45309',
              border: '1px solid #fde68a',
            }}
            title="Reiniciar Rastreador GPS (Requiere contraseña)"
          >
            🔄 Reinicio GPS
          </button>
        )}
      </div>

      <QuickCommandModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        device={device}
        position={position}
        actionType={selectedAction}
        nativeTypes={nativeTypes}
      />
    </>
  );
};

export default QuickCommandBar;
