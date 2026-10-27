import { useId, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/styles';
import { map } from '../core/MapView';
import { useAttributePreference } from '../../common/util/preferences';

const MapLiveRoutes = () => {
  const id = useId();

  const theme = useTheme();

  const type = useAttributePreference('mapLiveRoutes', 'selected');

  const devices = useSelector((state) => state.devices.items);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const history = useSelector((state) => state.session.history);

  const pointsId = `${id}-points`;

  useEffect(() => {
    if (type !== 'none') {
      map.addSource(id, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Capa de línea que conecta los últimos 10 puntos (trayectoria en rojo vivo)
      map.addLayer({
        source: id,
        id,
        type: 'line',
        filter: ['==', '$type', 'LineString'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.92,
        },
      });

      // Capa de puntos circulares (estilo OpenGTS) para marcar cada uno de los 10 puntos
      map.addLayer({
        source: id,
        id: pointsId,
        type: 'circle',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 5.5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 1.0,
        },
      });

      return () => {
        if (map.getLayer(pointsId)) {
          map.removeLayer(pointsId);
        }
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
        if (map.getSource(id)) {
          map.removeSource(id);
        }
      };
    }
    return () => {};
  }, [type, id, pointsId]);

  useEffect(() => {
    if (type !== 'none') {
      const deviceIds = Object.values(devices)
        .map((device) => device.id)
        .filter((deviceId) => (type === 'selected' ? deviceId === selectedDeviceId : true))
        .filter((deviceId) => history.hasOwnProperty(deviceId));

      const features = [];

      deviceIds.forEach((deviceId) => {
        const coords = history[deviceId] || [];
        const color = devices[deviceId]?.attributes?.['web.reportColor'] || '#dc2626';

        // 1. Línea que conecta los puntos
        if (coords.length > 1) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            properties: { color },
          });
        }

        // 2. Cada punto individual (últimos 10 puntos como en OpenGTS)
        coords.forEach((coord, idx) => {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: coord,
            },
            properties: {
              color,
              index: idx + 1,
            },
          });
        });
      });

      map.getSource(id)?.setData({
        type: 'FeatureCollection',
        features,
      });
    }
  }, [theme, type, devices, selectedDeviceId, history, id]);

  return null;
};

export default MapLiveRoutes;
