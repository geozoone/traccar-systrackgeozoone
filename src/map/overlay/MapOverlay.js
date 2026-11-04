import { useId, useEffect, useState, useMemo } from 'react';
import { useAttributePreference } from '../../common/util/preferences';
import { map } from '../core/MapView';
import useMapOverlays from './useMapOverlays';

class TrafficToggleControl {
  constructor(onToggle) {
    this.onToggle = onToggle;
  }

  onAdd() {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.title = 'Tráfico en Vivo (Activar / Desactivar)';
    this.button.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;transition:all 0.2s ease;';
    this.button.innerHTML = '🚦';
    this.button.onclick = () => this.onToggle();

    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl-group maplibregl-ctrl';
    this.container.appendChild(this.button);

    return this.container;
  }

  onRemove() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  setActive(active) {
    if (!this.button) return;
    if (active) {
      this.button.style.backgroundColor = '#dcfce7';
      this.button.style.boxShadow = 'inset 0 0 0 2px #16a34a';
      this.button.title = 'Tráfico en Vivo: ACTIVO (Clic para desactivar)';
    } else {
      this.button.style.backgroundColor = '';
      this.button.style.boxShadow = '';
      this.button.title = 'Mostrar Tráfico en Vivo (🚦)';
    }
  }
}

const MapOverlay = () => {
  const id = useId();

  const mapOverlays = useMapOverlays();
  const preferenceOverlay = useAttributePreference('selectedMapOverlay');

  // Permitir prender/apagar rápidamente desde el botón flotante del mapa
  const [quickTraffic, setQuickTraffic] = useState(() => {
    const saved = window.localStorage.getItem('geozoone_traffic_active');
    if (saved !== null) return saved === 'true';
    return null;
  });

  const tomTomOverlay = useMemo(
    () => mapOverlays.find((o) => o.id === 'tomTomFlow' && o.available)
       || mapOverlays.find((o) => o.id === 'hereFlow' && o.available),
    [mapOverlays],
  );

  const effectiveOverlayId = useMemo(() => {
    if (quickTraffic === true && tomTomOverlay) {
      return tomTomOverlay.id;
    }
    if (quickTraffic === false) {
      return '';
    }
    return preferenceOverlay || '';
  }, [quickTraffic, tomTomOverlay, preferenceOverlay]);

  const activeOverlay = useMemo(
    () => mapOverlays.filter((overlay) => overlay.available).find((overlay) => overlay.id === effectiveOverlayId),
    [mapOverlays, effectiveOverlayId],
  );

  const isTrafficActive = Boolean(activeOverlay && (activeOverlay.id === 'tomTomFlow' || activeOverlay.id === 'hereFlow'));

  // Control flotante 🚦 en la barra de controles del mapa
  useEffect(() => {
    if (!tomTomOverlay) return undefined;

    const control = new TrafficToggleControl(() => {
      setQuickTraffic((prev) => {
        const current = prev !== null ? prev : Boolean(preferenceOverlay === tomTomOverlay.id);
        const next = !current;
        window.localStorage.setItem('geozoone_traffic_active', String(next));
        return next;
      });
    });

    map.addControl(control, 'top-right');
    control.setActive(isTrafficActive);

    return () => {
      map.removeControl(control);
    };
  }, [tomTomOverlay, preferenceOverlay]);

  useEffect(() => {
    // Actualizar estado visual del botón sin recrear el control
    const buttons = document.querySelectorAll('.maplibregl-ctrl-group button');
    buttons.forEach((btn) => {
      if (btn.innerHTML === '🚦') {
        if (isTrafficActive) {
          btn.style.backgroundColor = '#dcfce7';
          btn.style.boxShadow = 'inset 0 0 0 2px #16a34a';
          btn.title = 'Tráfico en Vivo: ACTIVO (Clic para desactivar)';
        } else {
          btn.style.backgroundColor = '';
          btn.style.boxShadow = '';
          btn.title = 'Mostrar Tráfico en Vivo (🚦)';
        }
      }
    });
  }, [isTrafficActive]);

  // Efecto estabilizado: solo se ejecuta cuando cambia el overlay seleccionado, NO en cada reporte GPS
  useEffect(() => {
    if (activeOverlay) {
      if (!map.getSource(id)) {
        map.addSource(id, activeOverlay.source);
      }
      if (!map.getLayer(id)) {
        map.addLayer({
          id,
          type: 'raster',
          source: id,
          layout: {
            visibility: 'visible',
          },
          paint: {
            'raster-opacity': 0.85,
            'raster-fade-duration': 0,
          },
        });
      }
    }
    return () => {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    };
  }, [id, activeOverlay?.id]);

  return null;
};

export default MapOverlay;
