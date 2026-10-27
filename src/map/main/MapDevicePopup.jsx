import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Draggable from 'react-draggable';
import { sessionActions } from '../../store';
import { formatTime } from '../../common/util/formatter';
import { usePreference } from '../../common/util/preferences';

// Función para resolver la dirección de calle usando Traccar o fallback a OpenStreetMap Nominatim
export async function resolveStreetAddress(lat, lon) {
  // 1. Probar primero con el endpoint interno de Traccar
  try {
    const resTraccar = await fetch(`/api/server/geocode?latitude=${lat}&longitude=${lon}`);
    if (resTraccar.ok) {
      const text = await resTraccar.text();
      if (text && text.trim().length > 0 && !text.toLowerCase().includes('error')) {
        return text.trim();
      }
    }
  } catch (e) {
    // Continuar a fallback
  }

  // 2. Fallback directo a OpenStreetMap (Nominatim en español)
  try {
    const resOsm = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'es' } }
    );
    if (resOsm.ok) {
      const data = await resOsm.json();
      if (data && data.address) {
        const a = data.address;
        const street = a.road || a.pedestrian || a.street || a.highway || a.path || '';
        const number = a.house_number ? ` ${a.house_number}` : '';
        const district = a.suburb || a.neighbourhood || a.city_district || a.village || a.town || '';
        const city = a.city || a.county || a.state || '';

        const parts = [
          street ? `${street}${number}` : '',
          district,
          city,
        ].filter(Boolean);

        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
      if (data.display_name) {
        return data.display_name.split(',').slice(0, 3).join(', ');
      }
    }
  } catch (e) {
    console.warn('No se pudo resolver la dirección:', e.message);
  }

  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

const MapDevicePopup = ({ onOpenDetails }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const addressCache = useRef(new Map());

  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const hours12 = usePreference('twelveHourFormat');

  const selectedDevice = devices[selectedDeviceId];
  const selectedPosition = positions[selectedDeviceId];

  // Estados visuales:
  // - hidden: si el usuario cerró la tarjeta, pero el vehículo SIGUE seleccionado y la ruta roja SIGUE visible.
  // - minimized: si el usuario la compactó a una barra delgada para ver la ruta sin obstrucción.
  const [hidden, setHidden] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [address, setAddress] = useState('');
  const [trailLoading, setTrailLoading] = useState(false);

  // Al cambiar de vehículo, restablecer visibilidad
  useEffect(() => {
    if (selectedDeviceId) {
      setHidden(false);
      setMinimized(false);
    }
  }, [selectedDeviceId]);

  // Resolver dirección cuando cambie la posición del vehículo seleccionado
  useEffect(() => {
    if (!selectedPosition) {
      setAddress('');
      return;
    }

    const { latitude, longitude } = selectedPosition;
    const coordKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

    if (selectedPosition.address) {
      setAddress(selectedPosition.address);
      addressCache.current.set(coordKey, selectedPosition.address);
      return;
    }

    if (addressCache.current.has(coordKey)) {
      setAddress(addressCache.current.get(coordKey));
      return;
    }

    setAddress('Obteniendo dirección...');
    resolveStreetAddress(latitude, longitude).then((res) => {
      if (res) {
        addressCache.current.set(coordKey, res);
        setAddress(res);
      }
    });
  }, [selectedPosition]);

  // Cargar/Refrescar rastro de 10 puntos (en rojo)
  const handleLoadTrail = (e) => {
    if (e) e.stopPropagation();
    if (!selectedDeviceId) return;
    setTrailLoading(true);
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const to = new Date().toISOString();
    fetch(`/api/positions?deviceId=${selectedDeviceId}&from=${from}&to=${to}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((items) => {
        if (items && items.length > 0) {
          const coordinates = items.slice(-10).map((p) => [p.longitude, p.latitude]);
          dispatch(sessionActions.setHistory({ deviceId: selectedDeviceId, coordinates }));
        }
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => setTrailLoading(false), 1200);
      });
  };

  // Si no hay vehículo seleccionado o no tiene posición, no mostrar nada
  if (!selectedDeviceId || !selectedDevice || !selectedPosition) {
    return null;
  }

  const speedKmh = selectedPosition.speed != null ? Math.round(selectedPosition.speed * 1.852) : 0;
  const ignition = selectedPosition.attributes?.ignition;
  const empresa = selectedDevice.attributes?.empresa
    || selectedDevice.attributes?.informacoes?.empresa
    || '';
  const battery = selectedPosition.attributes?.batteryLevel != null
    ? `${selectedPosition.attributes.batteryLevel}%`
    : (selectedPosition.attributes?.battery ? `${selectedPosition.attributes.battery}V` : null);
  const power = selectedPosition.attributes?.power != null
    ? `${Number(selectedPosition.attributes.power).toFixed(1)}V`
    : null;
  const totalDistance = selectedPosition.attributes?.totalDistance != null
    ? `${Math.round(selectedPosition.attributes.totalDistance / 1000).toLocaleString()} km`
    : null;
  const timeFormatted = formatTime(selectedPosition.fixTime, 'seconds', hours12);
  const gmapsLink = `https://www.google.com/maps?q=${selectedPosition.latitude},${selectedPosition.longitude}`;

  // -------------------------------------------------------------
  // CASO 1: Tarjeta Oculta temporalmente (Pastilla Flotante para reabrir)
  // -------------------------------------------------------------
  if (hidden) {
    return (
      <div
        onClick={() => setHidden(false)}
        style={{
          position: 'fixed',
          bottom: isMobile ? 16 : 24,
          right: isMobile ? 16 : 24,
          zIndex: 1250,
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '9999px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '13px',
          border: '1px solid rgba(255,255,255,0.2)',
          userSelect: 'none',
          animation: 'fadeIn 0.2s ease-in',
        }}
        title="Haz clic para volver a ver la ficha técnica del vehículo"
      >
        <span style={{ fontSize: '15px' }}>📍</span>
        <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedDevice.name}
        </span>
        <span style={{
          fontSize: '11px',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: speedKmh > 0 ? '#15803d' : '#475569',
          color: '#ffffff',
        }}>
          {speedKmh > 0 ? `${speedKmh} km/h` : 'Detenido'}
        </span>
        <span style={{ fontSize: '11px', color: '#38bdf8', marginLeft: '4px' }}>Ver datos ▲</span>
      </div>
    );
  }

  // -------------------------------------------------------------
  // CASO 2: Modo Móvil (Barra Inferior Estilo Google Maps)
  // -------------------------------------------------------------
  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1250,
          backgroundColor: '#ffffff',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -6px 25px rgba(0,0,0,0.2)',
          borderTop: '1px solid #e2e8f0',
          transition: 'all 0.25s ease-out',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          color: '#1e293b',
          maxHeight: minimized ? '72px' : '75vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Pestaña de arrastre / Toggle rápido */}
        <div
          onClick={() => setMinimized(!minimized)}
          style={{
            width: '100%',
            padding: '6px 0 2px',
            display: 'flex',
            justifyContent: 'center',
            cursor: 'pointer',
            background: '#f8fafc',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ width: 36, height: 4, backgroundColor: '#cbd5e1', borderRadius: 2 }} />
        </div>

        {/* Fila compacta superior (Siempre visible) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            gap: '8px',
          }}
        >
          <div
            onClick={() => setMinimized(!minimized)}
            style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🚛 {selectedDevice.name}
              </span>
              {ignition === true && (
                <span style={{ fontSize: '10px', background: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  ON
                </span>
              )}
              {ignition === false && (
                <span style={{ fontSize: '10px', background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  OFF
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {speedKmh > 0 ? `⚡ ${speedKmh} km/h` : '⏹️ Detenido'} • {address || 'Cargando lugar...'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setMinimized(!minimized)}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#475569',
              }}
              title={minimized ? 'Expandir detalle' : 'Minimizar a barra'}
            >
              {minimized ? '▲' : '▼'}
            </button>
            <button
              onClick={() => setHidden(true)}
              style={{
                background: '#fee2e2',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#b91c1c',
                fontWeight: 700,
              }}
              title="Ocultar ficha (La ruta roja permanece)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Contenido expandido con scroll si no está minimizado */}
        {!minimized && (
          <div style={{ padding: '0 14px 14px', overflowY: 'auto', flex: 1 }}>
            {empresa && (
              <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, marginBottom: '6px' }}>
                🏢 {empresa}
              </div>
            )}

            {/* Rejilla de métricas */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              backgroundColor: '#f8fafc',
              padding: '8px',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '10px',
              border: '1px solid #f1f5f9',
            }}>
              <div><strong>🔑 Motor:</strong> {ignition === true ? '🟢 Encendido' : (ignition === false ? '🔴 Apagado' : 'N/D')}</div>
              <div><strong>⚡ Velocidad:</strong> {speedKmh} km/h</div>
              {totalDistance && <div><strong>🛣️ Odómetro:</strong> {totalDistance}</div>}
              {power ? <div><strong>🔌 Voltaje:</strong> {power}</div> : (battery ? <div><strong>🔋 Batería:</strong> {battery}</div> : '')}
            </div>

            {/* Dirección y reporte */}
            <div style={{ fontSize: '12px', color: '#334155', marginBottom: '6px', lineHeight: 1.4 }}>
              <strong>📍 Dirección:</strong>{' '}
              <a href={gmapsLink} target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 500 }}>
                {address || 'Localizando...'} ↗
              </a>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
              <strong>🕒 Reporte:</strong> {timeFormatted}
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleLoadTrail}
                style={{
                  flex: 1,
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 10px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                }}
              >
                {trailLoading ? '✓ Rastro Rojo Activo' : '🗺️ Rastro 10 pts'}
              </button>
              <button
                onClick={() => { if (onOpenDetails) onOpenDetails(); }}
                style={{
                  flex: 1,
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 10px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                📋 Ficha Completa
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // CASO 3: Modo Escritorio / PC (Tarjeta Flotante HUD Arrastrable)
  // -------------------------------------------------------------
  return (
    <Draggable handle=".geozoone-drag-handle">
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1250,
          width: minimized ? '260px' : '330px',
          backgroundColor: 'rgba(255, 255, 255, 0.97)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.22)',
          border: '1px solid #e2e8f0',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          color: '#1e293b',
          fontSize: '13px',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
          userSelect: 'none',
        }}
      >
        {/* Cabecera / Barra de arrastre */}
        <div
          className="geozoone-drag-handle"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            cursor: 'move',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>⠿</span>
            <span style={{ fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              🚛 {selectedDevice.name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
              title={minimized ? 'Maximizar ficha' : 'Minimizar a pastilla'}
            >
              {minimized ? '🗖' : '—'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setHidden(true); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f87171',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 700,
              }}
              title="Ocultar ficha (La ruta roja NO se borra)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Contenido en modo minimizado */}
        {minimized && (
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
            <span style={{ fontSize: '12px', color: '#475569' }}>
              {ignition ? '🟢 ON' : '🔴 OFF'} • {speedKmh > 0 ? `⚡ ${speedKmh} km/h` : '⏹️ 0 km/h'}
            </span>
            <button
              onClick={() => setMinimized(false)}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Expandir ▲
            </button>
          </div>
        )}

        {/* Contenido Completo de la Tarjeta */}
        {!minimized && (
          <div style={{ padding: '12px' }}>
            {empresa && (
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                🏢 {empresa}
              </div>
            )}

            {/* Métrica de Estado y Motor */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              backgroundColor: '#f8fafc',
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '10px',
              border: '1px solid #f1f5f9',
            }}>
              <div><strong>🔑 Motor:</strong> {ignition === true ? '🟢 ON' : (ignition === false ? '🔴 OFF' : 'N/D')}</div>
              <div><strong>📊 Velocidad:</strong> {speedKmh > 0 ? `⚡ ${speedKmh} km/h` : '⏹️ 0 km/h'}</div>
              {totalDistance && <div><strong>🛣️ Odómetro:</strong> {totalDistance}</div>}
              {power ? <div><strong>🔌 Voltaje:</strong> {power}</div> : (battery ? <div><strong>🔋 Batería:</strong> {battery}</div> : '')}
            </div>

            {/* Dirección con enlace a Google Maps */}
            <div style={{ fontSize: '12px', color: '#334155', marginBottom: '6px', lineHeight: 1.4 }}>
              <strong>📍 Lugar:</strong>{' '}
              <a
                href={gmapsLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 500 }}
                title="Abrir en Google Maps"
              >
                {address || 'Localizando dirección...'} ↗
              </a>
            </div>

            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
              <strong>🕒 Último reporte:</strong> {timeFormatted}
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              <button
                onClick={handleLoadTrail}
                style={{
                  flex: 1,
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 8px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
                title="Recargar los últimos 10 puntos en rojo"
              >
                {trailLoading ? '✓ Rastro Rojo' : '🗺️ Rastro 10 pts'}
              </button>

              <button
                onClick={() => { if (onOpenDetails) onOpenDetails(); }}
                style={{
                  flex: 1,
                  backgroundColor: '#f1f5f9',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  padding: '7px 8px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                📋 Ficha Completa
              </button>
            </div>
          </div>
        )}
      </div>
    </Draggable>
  );
};

export default MapDevicePopup;
