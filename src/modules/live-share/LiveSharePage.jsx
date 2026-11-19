import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { useBranding } from '../../common/util/useBranding';

dayjs.extend(relativeTime);
dayjs.locale('es');

const MAP_STYLES = {
  streets: {
    version: 8,
    sources: {
      googleRoad: {
        type: 'raster',
        tiles: [0, 1, 2, 3].map((i) => `https://mt${i}.google.com/vt/lyrs=m&hl=es&x={x}&y={y}&z={z}&s=Ga`),
        tileSize: 256,
        attribution: '© Google Maps',
      },
    },
    layers: [{ id: 'google-road-layer', type: 'raster', source: 'googleRoad' }],
  },
  satellite: {
    version: 8,
    sources: {
      googleSat: {
        type: 'raster',
        tiles: [0, 1, 2, 3].map((i) => `https://mt${i}.google.com/vt/lyrs=y&hl=es&x={x}&y={y}&z={z}&s=Ga`),
        tileSize: 256,
        attribution: '© Google Maps',
      },
    },
    layers: [{ id: 'google-sat-layer', type: 'raster', source: 'googleSat' }],
  },
};

function formatCountdown(totalSec) {
  if (totalSec <= 0) return 'Expirado';
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)} min`;
}

const LiveSharePage = () => {
  const { token } = useParams();
  const { branding } = useBranding();

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const markerElRef = useRef(null);
  const firstFixRef = useRef(false);

  const [data, setData] = useState(null);
  const [errorState, setErrorState] = useState(null); // { code, message, deviceName }
  const [loading, setLoading] = useState(true);
  const [mapMode, setMapMode] = useState('streets');
  const [autoFollow, setAutoFollow] = useState(true);
  const [remainingSec, setRemainingSec] = useState(null);

  const primaryColor = branding?.colorPrimary || '#0f172a';
  const brandTitle = branding?.title || 'Rastreo Satelital en Vivo';

  const fetchLivePosition = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/modulo/share/live/${encodeURIComponent(token)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorState({
          code: json.error || String(res.status),
          message: json.message || 'Enlace no disponible o expirado.',
          deviceName: json.deviceName || '',
        });
        setLoading(false);
        return;
      }
      setErrorState(null);
      setData(json);
      if (typeof json.remainingSeconds === 'number') {
        setRemainingSec(json.remainingSeconds);
      }
      setLoading(false);
    } catch {
      // Mantener última posición si hubo microcorte de señal móvil
      setLoading(false);
    }
  }, [token]);

  // Sondeo cada 8 segundos
  useEffect(() => {
    fetchLivePosition();
    const pollInterval = setInterval(fetchLivePosition, 8000);
    return () => clearInterval(pollInterval);
  }, [fetchLivePosition]);

  // Cuenta regresiva visual cada minuto
  useEffect(() => {
    const tick = setInterval(() => {
      setRemainingSec((prev) => (typeof prev === 'number' && prev > 0 ? prev - 1 : prev));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Inicializar mapa MapLibre
  useEffect(() => {
    if (errorState || !mapContainerRef.current || mapRef.current) return undefined;

    const mapInstance = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[mapMode],
      center: [-77.0428, -12.0464],
      zoom: 13,
      attributionControl: false,
    });

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    // Si el usuario arrastra el mapa manualmente, pausar seguimiento automático
    mapInstance.on('dragstart', () => {
      setAutoFollow(false);
    });

    mapRef.current = mapInstance;

    return () => {
      mapInstance.remove();
      mapRef.current = null;
      markerRef.current = null;
      firstFixRef.current = false;
    };
  }, [errorState]);

  // Cambiar estilo de mapa (Calles / Satélite)
  const toggleMapStyle = () => {
    const nextMode = mapMode === 'streets' ? 'satellite' : 'streets';
    setMapMode(nextMode);
    if (mapRef.current) {
      mapRef.current.setStyle(MAP_STYLES[nextMode]);
    }
  };

  // Actualizar marcador y rastro rojo cuando llegan nuevos datos
  useEffect(() => {
    const mapInstance = mapRef.current;
    const pos = data?.position;
    if (!mapInstance || !pos) return;

    const lngLat = [pos.longitude, pos.latitude];

    // Crear o actualizar el marcador HTML animado
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.pointerEvents = 'none';
      markerElRef.current = el;

      markerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(lngLat)
        .addTo(mapInstance);
    } else {
      markerRef.current.setLngLat(lngLat);
    }

    if (markerElRef.current) {
      const moving = pos.speedKmh > 2;
      const badgeBg = moving ? '#15803d' : '#0f172a';
      markerElRef.current.innerHTML = `
        <div style="
          background: ${badgeBg};
          color: #ffffff;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 3px 10px rgba(0,0,0,0.35);
          border: 2px solid #ffffff;
          margin-bottom: 5px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          ${data.deviceName} ${moving ? `• ${pos.speedKmh} km/h` : ''}
        </div>
        <div style="
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: ${moving ? '#16a34a' : '#2563eb'};
          border: 3px solid #ffffff;
          box-shadow: 0 0 0 6px ${moving ? 'rgba(22,163,74,0.28)' : 'rgba(37,99,235,0.28)'}, 0 4px 12px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(${pos.course || 0}deg);
          transition: transform 0.4s ease;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
      `;
    }

    // Dibujar o actualizar rastro rojo de los últimos 12 puntos
    const updateTrailLayer = () => {
      if (!mapInstance.isStyleLoaded()) return;
      const coords = Array.isArray(data.trail) && data.trail.length > 1
        ? data.trail
        : [lngLat];
      const geojson = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      };

      if (mapInstance.getSource('live-trail')) {
        mapInstance.getSource('live-trail').setData(geojson);
      } else {
        mapInstance.addSource('live-trail', { type: 'geojson', data: geojson });
        mapInstance.addLayer({
          id: 'live-trail-line',
          type: 'line',
          source: 'live-trail',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#dc2626', 'line-width': 4, 'line-opacity': 0.85 },
        });
      }
    };

    if (mapInstance.isStyleLoaded()) {
      updateTrailLayer();
    } else {
      mapInstance.once('styledata', updateTrailLayer);
    }

    if (!firstFixRef.current) {
      firstFixRef.current = true;
      mapInstance.jumpTo({ center: lngLat, zoom: 16 });
    } else if (autoFollow) {
      mapInstance.easeTo({ center: lngLat, duration: 800 });
    }
  }, [data, autoFollow, mapMode]);

  const handleRecenter = () => {
    setAutoFollow(true);
    if (mapRef.current && data?.position) {
      mapRef.current.flyTo({
        center: [data.position.longitude, data.position.latitude],
        zoom: 16.5,
        duration: 700,
      });
    }
  };

  // Pantalla de enlace expirado o inválido
  if (errorState) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          maxWidth: '420px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '28px 24px',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}>
          {branding?.logo && (
            <img
              src={branding.logo}
              alt={brandTitle}
              style={{ maxHeight: '56px', maxWidth: '200px', objectFit: 'contain', marginBottom: '16px' }}
            />
          )}
          <div style={{ fontSize: '42px', marginBottom: '10px' }}>
            {errorState.code === 'EXPIRED' ? '⏱️' : '🔒'}
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '19px', color: '#0f172a' }}>
            {errorState.code === 'EXPIRED' ? 'Enlace de Rastreo Expirado' : 'Enlace No Disponible'}
          </h2>
          {errorState.deviceName && (
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1', marginBottom: '8px' }}>
              Vehículo: {errorState.deviceName}
            </div>
          )}
          <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
            {errorState.message}
          </p>
          <p style={{ margin: '14px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Solicita un nuevo enlace al propietario o central de monitoreo.
          </p>
        </div>
      </div>
    );
  }

  const pos = data?.position;
  const gmapsDirections = pos
    ? `https://www.google.com/maps/dir/?api=1&destination=${pos.latitude},${pos.longitude}`
    : '#';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Mapa a pantalla completa */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Cabecera flotante Marca Blanca */}
      <div style={{
        position: 'fixed',
        top: 12,
        left: 12,
        right: 54,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(8px)',
          color: '#ffffff',
          padding: '8px 14px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          border: `1px solid ${primaryColor}`,
        }}>
          {branding?.logo ? (
            <img
              src={branding.logo}
              alt={brandTitle}
              style={{ maxHeight: '26px', maxWidth: '110px', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontWeight: 800, fontSize: '14px' }}>{brandTitle}</span>
          )}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(22, 163, 74, 0.2)',
            color: '#4ade80',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 700,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
            EN VIVO
          </span>
          {remainingSec != null && (
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
              ⏱️ {formatCountdown(remainingSec)}
            </span>
          )}
        </div>
      </div>

      {/* Tarjeta inferior flotante de telemetría (Estilo Uber / Wialon) */}
      <div style={{
        position: 'fixed',
        bottom: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '460px',
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '14px 16px',
        boxShadow: '0 14px 36px rgba(15, 23, 42, 0.28)',
        border: '1px solid #e2e8f0',
      }}>
        {loading && !data ? (
          <div style={{ textAlign: 'center', padding: '12px', color: '#475569', fontSize: '13px', fontWeight: 600 }}>
            🛰️ Conectando con ubicación en tiempo real...
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>
                🚛 {data?.deviceName || 'Vehículo'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {pos?.ignition === true && (
                  <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '999px' }}>
                    🟢 Motor ON
                  </span>
                )}
                {pos?.ignition === false && (
                  <span style={{ fontSize: '11px', fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '999px' }}>
                    🔴 Motor OFF
                  </span>
                )}
                <span style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  background: pos?.speedKmh > 0 ? '#dbeafe' : '#f1f5f9',
                  color: pos?.speedKmh > 0 ? '#1d4ed8' : '#475569',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}>
                  ⚡ {pos?.speedKmh ?? 0} km/h
                </span>
              </div>
            </div>

            <div style={{ fontSize: '12.5px', color: '#334155', marginBottom: '4px', lineHeight: 1.4 }}>
              <strong>📍 Ubicación:</strong> {pos?.address || (pos ? `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}` : 'Sin señal GPS reciente')}
            </div>

            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
              <strong>🕒 Último reporte:</strong>{' '}
              {pos?.fixTime ? `${dayjs(pos.fixTime).format('DD/MM/YYYY hh:mm:ss A')} (${dayjs(pos.fixTime).fromNow()})` : 'Esperando señal...'}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleRecenter}
                style={{
                  flex: 1,
                  background: autoFollow ? '#0f172a' : '#f1f5f9',
                  color: autoFollow ? '#ffffff' : '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px 6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🎯 Centrar
              </button>
              <button
                type="button"
                onClick={toggleMapStyle}
                style={{
                  flex: 1,
                  background: '#f8fafc',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px 6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {mapMode === 'streets' ? '🛰️ Satélite' : '🗺️ Calles'}
              </button>
              <a
                href={gmapsDirections}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1.2,
                  background: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '8px 6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                🧭 Cómo llegar
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LiveSharePage;

