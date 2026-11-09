import React, { useId, useCallback, useEffect, useState, useRef } from 'react';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/styles';
import { map } from './core/MapView';
import { formatTime, getStatusColor } from '../common/util/formatter';
import { mapIconKey } from './core/preloadImages';
import { findFonts } from './core/mapUtil';
import { useAttributePreference, usePreference } from '../common/util/preferences';

const h = React.createElement;

const MapPositions = ({ positions, onClick, showStatus, selectedPosition, titleField }) => {
  const id = useId();
  const clusters = `${id}-clusters`;
  const clustersCircle = `${id}-clusters-circle`;
  const selected = `${id}-selected`;

  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const iconScale = useAttributePreference('iconScale', desktop ? 0.95 : 1);

  const devices = useSelector((state) => state.devices.items);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const mapCluster = useAttributePreference('mapCluster', true);
  const hours12 = usePreference('twelveHourFormat');
  const directionType = useAttributePreference('mapDirection', 'selected');

  // Estado para el Tooltip Flotante al pasar el mouse sobre un grupo (cluster)
  const [clusterTooltip, setClusterTooltip] = useState(null);
  const hoverTimeoutRef = useRef(null);
  const isMouseInsideTooltipRef = useRef(false);

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const scheduleCloseTooltip = () => {
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isMouseInsideTooltipRef.current) {
        setClusterTooltip(null);
      }
    }, 240);
  };

  const createFeature = (devicesMap, position, selectedPositionId) => {
    const device = devicesMap[position.deviceId];
    const speedKmh = position.speed != null ? Math.round(position.speed * 1.852) : 0;
    const isMoving = speedKmh > 1;
    const ignition = Boolean(position.attributes && position.attributes.ignition);

    let showDirection;
    switch (directionType) {
      case 'none':
        showDirection = false;
        break;
      case 'all':
        showDirection = true;
        break;
      default:
        // Mostrar rumbo automáticamente si está seleccionado O si está en movimiento
        showDirection = selectedPositionId === position.id || isMoving;
        break;
    }

    const deviceName = device ? device.name : 'Vehículo';
    const title = speedKmh > 0 ? `${deviceName} (${speedKmh} km/h)` : deviceName;
    const timeLabel = position.fixTime
      ? dayjs(position.fixTime).format(hours12 ? 'DD/MM hh:mm A' : 'DD/MM HH:mm')
      : '';
    const label = timeLabel ? `${title}\n${timeLabel}` : title;

    return {
      id: position.id,
      deviceId: position.deviceId,
      deviceName,
      name: label,
      timeLabel,
      speedKmh,
      isMoving,
      ignition,
      status: device.status,
      fixTime: formatTime(position.fixTime, 'seconds', hours12),
      category: mapIconKey(device.category),
      color: showStatus ? position.attributes.color || getStatusColor(device.status) : 'neutral',
      rotation: position.course,
      direction: showDirection,
    };
  };

  const onMouseEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const onMouseLeave = () => {
    map.getCanvas().style.cursor = '';
  };

  const onMapClick = useCallback((event) => {
    if (!event.defaultPrevented && onClick) {
      setClusterTooltip(null);
      onClick();
    }
  }, [onClick]);

  const onMarkerClick = useCallback((event) => {
    event.preventDefault();
    const feature = event.features[0];
    if (onClick) {
      setClusterTooltip(null);
      onClick(feature.properties.id, feature.properties.deviceId);
    }
  }, [onClick]);

  const onMarkerContextMenu = useCallback((event) => {
    event.preventDefault();
    const feature = event.features && event.features[0];
    if (feature && feature.properties && feature.properties.deviceId) {
      window.dispatchEvent(new CustomEvent('geozoone-open-watcher-modal', {
        detail: {
          deviceId: feature.properties.deviceId,
          positionId: feature.properties.id,
          x: event.point.x,
          y: event.point.y,
        },
      }));
    }
  }, []);

  const zoomToCluster = useCallback((clusterId, coordinates) => {
    const sourceObj = map.getSource(id);
    if (!sourceObj) return;
    sourceObj.getClusterExpansionZoom(clusterId, (error, zoom) => {
      if (!error) {
        setClusterTooltip(null);
        map.easeTo({
          center: coordinates,
          zoom,
        });
      }
    });
  }, [id]);

  const onClusterClick = useCallback((event) => {
    event.preventDefault();
    const features = map.queryRenderedFeatures(event.point, {
      layers: [clusters, clustersCircle].filter((l) => map.getLayer(l)),
    });
    if (features && features.length > 0) {
      const clusterId = features[0].properties.cluster_id;
      zoomToCluster(clusterId, features[0].geometry.coordinates);
    }
  }, [clusters, clustersCircle, zoomToCluster]);

  const onClusterMouseEnter = useCallback((event) => {
    map.getCanvas().style.cursor = 'pointer';
    clearHoverTimeout();

    const features = map.queryRenderedFeatures(event.point, {
      layers: [clusters, clustersCircle].filter((l) => map.getLayer(l)),
    });
    if (!features || !features.length) return;

    const clusterFeature = features[0];
    const clusterId = clusterFeature.properties.cluster_id;
    const totalCount = clusterFeature.properties.point_count || 0;
    const coordinates = clusterFeature.geometry.coordinates;
    const screenPoint = map.project(coordinates);
    const canvasRect = map.getCanvas().getBoundingClientRect();

    const sourceObj = map.getSource(id);
    if (!sourceObj || typeof sourceObj.getClusterLeaves !== 'function') return;

    sourceObj.getClusterLeaves(clusterId, 40, 0, (err, leaves) => {
      if (err || !leaves) return;

      const items = leaves
        .map((leaf) => leaf.properties || {})
        .sort((a, b) => {
          if (Boolean(b.isMoving) !== Boolean(a.isMoving)) {
            return b.isMoving ? 1 : -1;
          }
          return String(a.deviceName || '').localeCompare(String(b.deviceName || ''));
        });

      setClusterTooltip({
        clusterId,
        totalCount,
        coordinates,
        x: canvasRect.left + screenPoint.x,
        y: canvasRect.top + screenPoint.y,
        items,
      });
    });
  }, [id, clusters, clustersCircle]);

  const onClusterMouseLeave = useCallback(() => {
    map.getCanvas().style.cursor = '';
    scheduleCloseTooltip();
  }, []);

  useEffect(() => {
    map.addSource(id, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
      cluster: mapCluster,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });
    map.addSource(selected, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    [id, selected].forEach((source) => {
      const isSelectedLayer = source === selected;

      // 1. Escudo / Halo luminoso debajo de cada vehículo para que resalte en el mapa (A1)
      map.addLayer({
        id: `halo-${source}`,
        type: 'circle',
        source,
        filter: ['!has', 'point_count'],
        paint: {
          'circle-radius': isSelectedLayer ? 22 : [
            'case',
            ['==', ['get', 'isMoving'], true],
            19,
            16,
          ],
          'circle-color': isSelectedLayer
            ? 'rgba(220, 38, 38, 0.28)'
            : [
              'case',
              ['==', ['get', 'isMoving'], true],
              'rgba(22, 163, 74, 0.28)',
              ['==', ['get', 'ignition'], true],
              'rgba(37, 99, 235, 0.22)',
              'rgba(15, 23, 42, 0.16)',
            ],
          'circle-stroke-width': isSelectedLayer ? 3 : 2,
          'circle-stroke-color': isSelectedLayer
            ? '#dc2626'
            : [
              'case',
              ['==', ['get', 'isMoving'], true],
              '#16a34a',
              ['==', ['get', 'ignition'], true],
              '#2563eb',
              '#475569',
            ],
        },
      });

      // 2. Icono del vehículo + Etiqueta de Placa en Alto Contraste (letras blancas sobre fondo oscuro) (A2)
      map.addLayer({
        id: source,
        type: 'symbol',
        source,
        filter: ['!has', 'point_count'],
        layout: {
          'icon-image': '{category}-{color}',
          'icon-size': iconScale,
          'icon-allow-overlap': true,
          'text-field': `{${titleField || 'name'}}`,
          'text-allow-overlap': true,
          'text-anchor': 'bottom',
          'text-offset': [0, -2.1 * iconScale],
          'text-font': findFonts(map),
          'text-size': 11.5,
          'text-line-height': 1.25,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': isSelectedLayer ? '#991b1b' : '#0f172a',
          'text-halo-width': 2.6,
          'text-halo-blur': 0.3,
        },
      });

      // 3. Flecha de dirección / rumbo (A3)
      map.addLayer({
        id: `direction-${source}`,
        type: 'symbol',
        source,
        filter: [
          'all',
          ['!has', 'point_count'],
          ['==', 'direction', true],
        ],
        layout: {
          'icon-image': 'direction',
          'icon-size': iconScale,
          'icon-allow-overlap': true,
          'icon-rotate': ['get', 'rotation'],
          'icon-rotation-alignment': 'map',
        },
      });

      map.on('mouseenter', source, onMouseEnter);
      map.on('mouseleave', source, onMouseLeave);
      map.on('click', source, onMarkerClick);
      map.on('contextmenu', source, onMarkerContextMenu);
      map.on('contextmenu', `halo-${source}`, onMarkerContextMenu);
    });

    // 4. Burbuja de Grupo (Cluster) diferenciada con colores vivos y doble borde blanco (B3)
    map.addLayer({
      id: clustersCircle,
      type: 'circle',
      source: id,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#1d4ed8', // Azul corporativo intenso (2 a 9 vehículos)
          10,
          '#7c3aed', // Violeta / Índigo (10 a 24 vehículos)
          25,
          '#dc2626', // Rojo flota masiva (25+ vehículos)
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          19,
          10,
          22,
          25,
          26,
        ],
        'circle-stroke-width': 3.5,
        'circle-stroke-color': '#ffffff',
      },
    });

    map.addLayer({
      id: clusters,
      type: 'symbol',
      source: id,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': findFonts(map),
        'text-size': 14,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(15, 23, 42, 0.6)',
        'text-halo-width': 1.2,
      },
    });

    map.on('mouseenter', clustersCircle, onClusterMouseEnter);
    map.on('mouseleave', clustersCircle, onClusterMouseLeave);
    map.on('mouseenter', clusters, onClusterMouseEnter);
    map.on('mouseleave', clusters, onClusterMouseLeave);
    map.on('click', clustersCircle, onClusterClick);
    map.on('click', clusters, onClusterClick);
    map.on('click', onMapClick);
    map.on('movestart', () => setClusterTooltip(null));

    return () => {
      map.off('mouseenter', clustersCircle, onClusterMouseEnter);
      map.off('mouseleave', clustersCircle, onClusterMouseLeave);
      map.off('mouseenter', clusters, onClusterMouseEnter);
      map.off('mouseleave', clusters, onClusterMouseLeave);
      map.off('click', clustersCircle, onClusterClick);
      map.off('click', clusters, onClusterClick);
      map.off('click', onMapClick);

      if (map.getLayer(clusters)) {
        map.removeLayer(clusters);
      }
      if (map.getLayer(clustersCircle)) {
        map.removeLayer(clustersCircle);
      }

      [id, selected].forEach((source) => {
        map.off('mouseenter', source, onMouseEnter);
        map.off('mouseleave', source, onMouseLeave);
        map.off('click', source, onMarkerClick);
        map.off('contextmenu', source, onMarkerContextMenu);
        map.off('contextmenu', `halo-${source}`, onMarkerContextMenu);

        if (map.getLayer(`halo-${source}`)) {
          map.removeLayer(`halo-${source}`);
        }
        if (map.getLayer(source)) {
          map.removeLayer(source);
        }
        if (map.getLayer(`direction-${source}`)) {
          map.removeLayer(`direction-${source}`);
        }
        if (map.getSource(source)) {
          map.removeSource(source);
        }
      });
    };
  }, [mapCluster, clusters, clustersCircle, onMarkerClick, onMarkerContextMenu, onClusterClick, onClusterMouseEnter, onClusterMouseLeave]);

  useEffect(() => {
    [id, selected].forEach((source) => {
      map.getSource(source)?.setData({
        type: 'FeatureCollection',
        features: positions.filter((it) => devices.hasOwnProperty(it.deviceId))
          .filter((it) => (source === id ? it.deviceId !== selectedDeviceId : it.deviceId === selectedDeviceId))
          .map((position) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [position.longitude, position.latitude],
            },
            properties: createFeature(devices, position, selectedPosition && selectedPosition.id),
          })),
      });
    });
  }, [mapCluster, clusters, onMarkerClick, onClusterClick, devices, positions, selectedPosition]);

  if (!clusterTooltip) {
    return null;
  }

  // Calcular posición en pantalla para que el tooltip nunca se salga de los bordes
  const tooltipWidth = 285;
  const maxLeft = typeof window !== 'undefined' ? window.innerWidth - tooltipWidth - 16 : 1000;
  const left = Math.max(12, Math.min(clusterTooltip.x + 18, maxLeft));
  const top = Math.max(12, Math.min(clusterTooltip.y - 24, (typeof window !== 'undefined' ? window.innerHeight - 290 : 600)));

  return h(
    'div',
    {
      onMouseEnter: () => {
        isMouseInsideTooltipRef.current = true;
        clearHoverTimeout();
      },
      onMouseLeave: () => {
        isMouseInsideTooltipRef.current = false;
        setClusterTooltip(null);
      },
      style: {
        position: 'fixed',
        left,
        top,
        width: tooltipWidth,
        maxHeight: 280,
        zIndex: 1450,
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        color: '#ffffff',
        borderRadius: 10,
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        pointerEvents: 'auto',
      },
    },
    // Cabecera del Tooltip
    h(
      'div',
      {
        style: {
          padding: '8px 12px',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          fontWeight: 700,
        },
      },
      h('span', null, `📦 ${clusterTooltip.totalCount} Vehículos aquí`),
      h(
        'button',
        {
          type: 'button',
          onClick: () => zoomToCluster(clusterTooltip.clusterId, clusterTooltip.coordinates),
          style: {
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: 5,
            padding: '3px 8px',
            fontSize: '0.7rem',
            fontWeight: 600,
            cursor: 'pointer',
          },
        },
        '🔍 Acercar',
      ),
    ),
    // Lista interactiva de vehículos dentro del cluster
    h(
      'div',
      {
        style: {
          overflowY: 'auto',
          maxHeight: 220,
          padding: '4px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        },
      },
      clusterTooltip.items.map((item, idx) => {
        const moving = Boolean(item.isMoving);
        const ign = Boolean(item.ignition);
        const dotColor = moving ? '#22c55e' : (ign ? '#3b82f6' : '#94a3b8');
        const speedText = moving
          ? `${item.speedKmh} km/h`
          : (ign ? 'Encendido (0 km/h)' : 'Detenido');

        return h(
          'button',
          {
            key: `${item.deviceId || idx}`,
            type: 'button',
            onClick: () => {
              if (onClick && item.deviceId) {
                setClusterTooltip(null);
                onClick(item.id, item.deviceId);
              }
            },
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '6px 8px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 6,
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '0.77rem',
            },
          },
          h(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                overflow: 'hidden',
                minWidth: 0,
              },
            },
            h(
              'span',
              {
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              },
              h('span', {
                style: {
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: dotColor,
                  flexShrink: 0,
                  boxShadow: moving ? '0 0 6px #22c55e' : 'none',
                },
              }),
              item.deviceName || item.name || 'Vehículo',
            ),
            item.timeLabel
              ? h(
                'span',
                {
                  style: {
                    fontSize: '0.67rem',
                    color: '#94a3b8',
                    paddingLeft: 15,
                    whiteSpace: 'nowrap',
                  },
                },
                item.timeLabel,
              )
              : null,
          ),
          h(
            'span',
            {
              style: {
                fontSize: '0.72rem',
                color: moving ? '#4ade80' : '#94a3b8',
                fontWeight: moving ? 700 : 500,
                marginLeft: 10,
                flexShrink: 0,
                textAlign: 'right',
              },
            },
            speedText,
          ),
        );
      }),
    ),
    h(
      'div',
      {
        style: {
          padding: '4px 10px',
          backgroundColor: '#0f172a',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.67rem',
          color: '#94a3b8',
          textAlign: 'center',
        },
      },
      'Clic en una unidad para ver su ficha sin perder el zoom',
    ),
  );
};

export default MapPositions;
