import { useTheme } from '@mui/styles';
import { useId, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { map } from './core/MapView';
import { findFonts } from './core/mapUtil';

const MapRoutePath = ({ name, positions, coordinates }) => {
  const id = useId();

  const theme = useTheme();

  const reportColor = useSelector((state) => {
    const position = positions?.find(() => true);
    if (position) {
      const attributes = state.devices.items[position.deviceId]?.attributes;
      if (attributes) {
        const color = attributes['web.reportColor'];
        if (color) {
          return color;
        }
      }
    }
    return theme.palette.geometry.main;
  });

  const endpointsId = `${id}-endpoints`;

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [],
        },
      },
    });

    map.addLayer({
      source: id,
      id: `${id}-line`,
      type: 'line',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3.5,
        'line-opacity': 0.85,
      },
    });

    // Flechas de dirección a lo largo de la ruta
    map.addLayer({
      source: id,
      id: `${id}-arrows`,
      type: 'symbol',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 70,
        'icon-image': 'route-arrow',
        'icon-size': 0.6,
        'icon-allow-overlap': true,
        'icon-rotation-alignment': 'map',
      },
    });

    // Puntos de Inicio (A) y Fin (B)
    map.addSource(endpointsId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    map.addLayer({
      source: endpointsId,
      id: `${endpointsId}-layer`,
      type: 'symbol',
      layout: {
        'icon-image': '{image}',
        'icon-size': 0.8,
        'icon-allow-overlap': true,
        'text-field': '{title}',
        'text-font': findFonts(map),
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1.2],
      },
      paint: {
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
        'text-color': '#0f172a',
      },
    });

    if (name) {
      map.addLayer({
        source: id,
        id: `${id}-title`,
        type: 'symbol',
        layout: {
          'text-field': '{name}',
          'text-font': findFonts(map),
          'text-size': 12,
        },
        paint: {
          'text-halo-color': 'white',
          'text-halo-width': 1,
        },
      });
    }

    return () => {
      if (map.getLayer(`${id}-title`)) {
        map.removeLayer(`${id}-title`);
      }
      if (map.getLayer(`${id}-arrows`)) {
        map.removeLayer(`${id}-arrows`);
      }
      if (map.getLayer(`${endpointsId}-layer`)) {
        map.removeLayer(`${endpointsId}-layer`);
      }
      if (map.getSource(endpointsId)) {
        map.removeSource(endpointsId);
      }
      if (map.getLayer(`${id}-line`)) {
        map.removeLayer(`${id}-line`);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    };
  }, []);

  useEffect(() => {
    let coords = coordinates;
    if (!coords && positions) {
      coords = positions.map((item) => [item.longitude, item.latitude]);
    }
    coords = coords || [];

    map.getSource(id)?.setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
      properties: {
        name,
        color: reportColor,
      },
    });

    if (coords.length >= 2) {
      map.getSource(endpointsId)?.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: coords[0],
            },
            properties: {
              image: 'route-start',
              title: 'INICIO',
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: coords[coords.length - 1],
            },
            properties: {
              image: 'route-end',
              title: 'FIN',
            },
          },
        ],
      });
    } else {
      map.getSource(endpointsId)?.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }, [theme, positions, coordinates, reportColor]);

  return null;
};

export default MapRoutePath;
