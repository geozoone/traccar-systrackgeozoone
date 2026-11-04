import React, { useId, useEffect, useState, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useAttributePreference } from '../../common/util/preferences';
import { map } from '../core/MapView';
import useMapOverlays from './useMapOverlays';

const h = React.createElement;

const findFirstOverlayBeforeLayer = () => {
  try {
    const layers = map.getStyle()?.layers || [];
    for (const l of layers) {
      if (
        l.id === 'geofences-fill'
        || l.id === 'geofences-line'
        || l.id === 'clusters'
        || l.id === 'background'
        || l.type === 'symbol'
        || l.type === 'circle'
        || l.type === 'line'
      ) {
        return l.id;
      }
    }
  } catch (e) {
    // ignore
  }
  return undefined;
};

const MapOverlay = () => {
  const id = useId();

  const mapOverlays = useMapOverlays();
  const preferenceOverlay = useAttributePreference('selectedMapOverlay');
  const tomTomKey = useAttributePreference('tomTomKey');

  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);
  const selectedPosition = selectedDeviceId ? positions[selectedDeviceId] : null;

  // Modo de tráfico elegido desde el botón flotante 🚦 ('none' | 'googleTraffic' | 'tomTomFlow')
  const [trafficMode, setTrafficMode] = useState(() => {
    const saved = window.localStorage.getItem('geozoone_traffic_mode');
    if (saved) return saved;
    return '';
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [wazeOpen, setWazeOpen] = useState(false);
  const [wazeCenter, setWazeCenter] = useState({ lat: -12.0464, lng: -77.0428 });

  const effectiveOverlayId = useMemo(() => {
    if (trafficMode === 'none') return '';
    if (trafficMode) return trafficMode;
    return preferenceOverlay || '';
  }, [trafficMode, preferenceOverlay]);

  const activeOverlay = useMemo(
    () => mapOverlays.filter((overlay) => overlay.available).find((overlay) => overlay.id === effectiveOverlayId),
    [mapOverlays, effectiveOverlayId],
  );

  const isTrafficActive = Boolean(
    activeOverlay && (activeOverlay.id === 'googleTraffic' || activeOverlay.id === 'tomTomFlow' || activeOverlay.id === 'hereFlow'),
  );

  const selectTrafficMode = (mode) => {
    setTrafficMode(mode);
    window.localStorage.setItem('geozoone_traffic_mode', mode);
    setMenuOpen(false);
  };

  const openWazeHere = () => {
    if (selectedPosition && selectedPosition.latitude && selectedPosition.longitude) {
      setWazeCenter({ lat: selectedPosition.latitude, lng: selectedPosition.longitude });
    } else {
      try {
        const c = map.getCenter();
        if (c) setWazeCenter({ lat: c.lat, lng: c.lng });
      } catch (e) {}
    }
    setWazeOpen(true);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (wazeOpen && selectedPosition && selectedPosition.latitude && selectedPosition.longitude) {
      setWazeCenter({ lat: selectedPosition.latitude, lng: selectedPosition.longitude });
    }
  }, [wazeOpen, selectedPosition?.latitude, selectedPosition?.longitude]);

  const toggleMenuRef = useRef(() => {});
  toggleMenuRef.current = () => {
    setMenuOpen((prev) => !prev);
  };

  // Control nativo MapLibre 🚦 (se monta una sola vez, nunca se destruye en re-renders)
  useEffect(() => {
    const ctrl = {
      onAdd() {
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'geozoone-traffic-ctrl-btn';
        this.button.title = 'Tráfico en Vivo (Clic para desplegar opciones)';
        this.button.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;width:29px;height:29px;';
        this.button.innerHTML = '🚦';
        this.button.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleMenuRef.current();
        });

        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl-group maplibregl-ctrl';
        this.container.appendChild(this.button);
        return this.container;
      },
      onRemove() {
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
      },
    };

    map.addControl(ctrl, 'top-right');

    return () => {
      try {
        map.removeControl(ctrl);
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    const btn = document.querySelector('.geozoone-traffic-ctrl-btn');
    if (btn) {
      if (isTrafficActive || wazeOpen) {
        btn.style.backgroundColor = '#dcfce7';
        btn.style.boxShadow = 'inset 0 0 0 2px #16a34a';
      } else {
        btn.style.backgroundColor = '';
        btn.style.boxShadow = '';
      }
    }
  }, [isTrafficActive, wazeOpen]);

  // Montar capa de tráfico sobre el mapa pero DEBAJO de los vehículos y geocercas
  useEffect(() => {
    if (!activeOverlay) return undefined;

    const sourceId = `${id}-${activeOverlay.id}`;
    const layerId = `${id}-layer-${activeOverlay.id}`;

    try {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, activeOverlay.source);
      }
      if (!map.getLayer(layerId)) {
        const beforeId = findFirstOverlayBeforeLayer();
        map.addLayer(
          {
            id: layerId,
            type: 'raster',
            source: sourceId,
            layout: {
              visibility: 'visible',
            },
            paint: {
              'raster-opacity': activeOverlay.id === 'googleTraffic' ? 0.95 : 0.88,
              'raster-fade-duration': 0,
            },
          },
          beforeId,
        );
      }
    } catch (err) {
      console.warn('[MapOverlay] Error agregando capa:', err);
    }

    return () => {
      try {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      } catch (e) {}
    };
  }, [id, activeOverlay?.id, tomTomKey]);

  const Dot = (color) => h('span', {
    style: { width: 9, height: 9, borderRadius: '50%', backgroundColor: color, display: 'inline-block' },
  });

  return h(
    React.Fragment,
    null,
    menuOpen && h(
      'div',
      {
        style: {
          position: 'fixed',
          top: 145,
          right: 50,
          zIndex: 1400,
          backgroundColor: '#ffffff',
          borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
          border: '1px solid #e2e8f0',
          width: 280,
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        },
      },
      h(
        'div',
        {
          style: {
            padding: '10px 14px',
            background: '#0f172a',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        },
        h('span', null, '🚦 Tráfico en Tiempo Real'),
        h(
          'button',
          {
            type: 'button',
            onClick: () => setMenuOpen(false),
            style: {
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '15px',
              lineHeight: 1,
            },
          },
          '✕',
        ),
      ),
      h(
        'div',
        { style: { padding: 6, display: 'flex', flexDirection: 'column', gap: 4 } },
        h(
          'button',
          {
            type: 'button',
            onClick: () => selectTrafficMode('googleTraffic'),
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 7,
              border: effectiveOverlayId === 'googleTraffic' ? '2px solid #16a34a' : '1px solid transparent',
              backgroundColor: effectiveOverlayId === 'googleTraffic' ? '#f0fdf4' : '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            },
          },
          h('span', { style: { fontSize: 18 } }, '🟢'),
          h(
            'div',
            null,
            h('div', { style: { fontWeight: 600, fontSize: '0.82rem', color: '#0f172a' } }, 'Tráfico en Avenidas (Recomendado)'),
            h('div', { style: { fontSize: '0.72rem', color: '#64748b' } }, 'Verde, amarillo y rojo sobre el mapa'),
          ),
        ),
        tomTomKey && h(
          'button',
          {
            type: 'button',
            onClick: () => selectTrafficMode('tomTomFlow'),
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 7,
              border: effectiveOverlayId === 'tomTomFlow' ? '2px solid #16a34a' : '1px solid transparent',
              backgroundColor: effectiveOverlayId === 'tomTomFlow' ? '#f0fdf4' : '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            },
          },
          h('span', { style: { fontSize: 18 } }, '🚗'),
          h(
            'div',
            null,
            h('div', { style: { fontWeight: 600, fontSize: '0.82rem', color: '#0f172a' } }, 'Capa Flujo TomTom'),
            h('div', { style: { fontSize: '0.72rem', color: '#64748b' } }, 'Superposición sobre mapa actual'),
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: openWazeHere,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 7,
              border: wazeOpen ? '2px solid #0284c7' : '1px solid transparent',
              backgroundColor: wazeOpen ? '#f0f9ff' : '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            },
          },
          h('span', { style: { fontSize: 18 } }, '🗺️'),
          h(
            'div',
            null,
            h('div', { style: { fontWeight: 600, fontSize: '0.82rem', color: '#0f172a' } }, 'Radar Waze en Vivo Aquí'),
            h('div', { style: { fontSize: '0.72rem', color: '#64748b' } }, 'Ver alertas, accidentes y atascos Waze'),
          ),
        ),
        isTrafficActive && h(
          'button',
          {
            type: 'button',
            onClick: () => selectTrafficMode('none'),
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '7px 10px',
              marginTop: 2,
              borderRadius: 7,
              border: '1px solid #fecaca',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
              width: '100%',
            },
          },
          '🚫 Ocultar Capa de Tráfico',
        ),
      ),
    ),
    isTrafficActive && h(
      'div',
      {
        style: {
          position: 'fixed',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1200,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          color: '#ffffff',
          padding: '5px 14px',
          borderRadius: 999,
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.76rem',
          fontWeight: 600,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          pointerEvents: 'auto',
        },
      },
      h('span', null, '🚦 Tráfico en Vivo:'),
      h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } }, Dot('#22c55e'), 'Rápido'),
      h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } }, Dot('#eab308'), 'Moderado'),
      h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } }, Dot('#f97316'), 'Lento'),
      h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } }, Dot('#dc2626'), 'Atasco'),
      h(
        'button',
        {
          type: 'button',
          onClick: () => selectTrafficMode('none'),
          title: 'Desactivar capa de tráfico',
          style: {
            marginLeft: 4,
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: '#ffffff',
            borderRadius: 999,
            padding: '2px 7px',
            fontSize: '0.7rem',
            cursor: 'pointer',
          },
        },
        '✕',
      ),
    ),
    wazeOpen && h(
      'div',
      {
        style: {
          position: 'fixed',
          bottom: 20,
          right: 52,
          width: 370,
          height: 320,
          maxWidth: 'calc(100vw - 24px)',
          zIndex: 1350,
          backgroundColor: '#0f172a',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          border: '2px solid #334155',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      },
      h(
        'div',
        {
          style: {
            padding: '7px 12px',
            background: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            fontWeight: 700,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          },
        },
        h('span', null, '🗺️ Radar Waze en Vivo (Alertas y Atascos)'),
        h(
          'button',
          {
            type: 'button',
            onClick: () => setWazeOpen(false),
            style: {
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: '#ffffff',
              borderRadius: 6,
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: '0.75rem',
            },
          },
          '✕ Cerrar',
        ),
      ),
      h('iframe', {
        title: 'Waze Live Traffic',
        src: `https://embed.waze.com/es/iframe?zoom=15&lat=${wazeCenter.lat}&lon=${wazeCenter.lng}&pin=1`,
        style: { width: '100%', height: '100%', border: 'none', flex: 1, backgroundColor: '#e2e8f0' },
        allowFullScreen: true,
      }),
    ),
  );
};

export default MapOverlay;
