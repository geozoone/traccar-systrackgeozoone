import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Box, Typography,
} from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import {
  formatDistance, formatHours, formatVolume, formatTime,
} from '../common/util/formatter';
import ReportFilter from './components/ReportFilter';
import { useAttributePreference, usePreference } from '../common/util/preferences';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ColumnSelect from './components/ColumnSelect';
import usePersistedState from '../common/util/usePersistedState';
import { useCatch } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import MapPositions from '../map/MapPositions';
import MapView from '../map/core/MapView';
import MapCamera from '../map/MapCamera';
import AddressValue from '../common/components/AddressValue';
import TableShimmer from '../common/components/TableShimmer';
import MapGeofence from '../map/MapGeofence';
import scheduleReport from './common/scheduleReport';

const columnsArray = [
  ['startTime', 'reportStartTime'],
  ['originContext', 'reportOriginContext'],
  ['address', 'positionAddress'],
  ['destinationContext', 'reportDestinationContext'],
  ['duration', 'reportDuration'],
  ['endTime', 'reportEndTime'],
  ['startOdometer', 'positionOdometer'],
  ['engineHours', 'reportEngineHours'],
  ['spentFuel', 'reportSpentFuel'],
];
const columnsMap = new Map(columnsArray);

const StopReportPage = () => {
  const navigate = useNavigate();
  const classes = useReportStyles();
  const t = useTranslation();

  const distanceUnit = useAttributePreference('distanceUnit');
  const volumeUnit = useAttributePreference('volumeUnit');
  const hours12 = usePreference('twelveHourFormat');

  const [columns, setColumns] = usePersistedState('stopColumns', [
    'startTime',
    'originContext',
    'address',
    'destinationContext',
    'duration',
  ]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Auto-resolución en segundo plano de direcciones para cada parada
  const resolveStopAddresses = async (stopList) => {
    const cache = new Map();
    const queue = [...stopList];
    const maxConcurrency = 3;

    const worker = async () => {
      while (queue.length > 0) {
        const stop = queue.shift();
        if (!stop || (stop.address && stop.address.trim().length > 0)) continue;

        const lat = stop.latitude;
        const lon = stop.longitude;
        if (lat == null || lon == null) continue;

        const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        if (cache.has(cacheKey)) {
          stop.address = cache.get(cacheKey);
          setItems([...stopList]);
          continue;
        }

        try {
          const res = await fetch(`/api/server/geocode?latitude=${lat}&longitude=${lon}`);
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim().length > 0 && !text.toLowerCase().includes('error')) {
              const cleanAddr = text.trim();
              stop.address = cleanAddr;
              cache.set(cacheKey, cleanAddr);
              setItems([...stopList]);
            }
          }
        } catch (e) {
          console.warn('Stop geocode error:', e);
        }
      }
    };

    const workers = Array.from({ length: maxConcurrency }, () => worker());
    await Promise.all(workers);
  };

  const handleSubmit = useCatch(async ({ deviceId, from, to, type }) => {
    const query = new URLSearchParams({ deviceId, from, to });
    if (type === 'export') {
      window.location.assign(`/api/reports/stops/xlsx?${query.toString()}`);
    } else if (type === 'mail') {
      const response = await fetch(`/api/reports/stops/mail?${query.toString()}`);
      if (!response.ok) {
        throw Error(await response.text());
      }
    } else {
      setLoading(true);
      try {
        const response = await fetch(`/api/reports/stops?${query.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        if (response.ok) {
          const rawStops = await response.json();
          const enriched = rawStops.map((s, idx) => ({
            ...s,
            stopNumber: idx + 1,
          }));
          setItems(enriched);
          // Auto-resolver direcciones sin obligar al usuario a dar clic
          resolveStopAddresses(enriched);
        } else {
          throw Error(await response.text());
        }
      } finally {
        setLoading(false);
      }
    }
  });

  const handleSchedule = useCatch(async (deviceIds, groupIds, report) => {
    report.type = 'stops';
    const error = await scheduleReport(deviceIds, groupIds, report);
    if (error) {
      throw Error(error);
    } else {
      navigate('/reports/scheduled');
    }
  });

  const getColumnLabel = (key) => {
    if (key === 'originContext') return 'Procedencia (Punto Anterior)';
    if (key === 'destinationContext') return 'Destino Posterior (Siguiente)';
    const trans = columnsMap.get(key);
    return trans ? t(trans) : key;
  };

  const formatValue = (item, key) => {
    switch (key) {
      case 'startTime':
      case 'endTime':
        return formatTime(item[key], 'minutes', hours12);
      case 'startOdometer':
        return formatDistance(item[key], distanceUnit, t);
      case 'duration':
        return formatHours(item[key]);
      case 'engineHours':
        return formatHours(item[key]);
      case 'spentFuel':
        return formatVolume(item[key], volumeUnit, t);
      case 'originContext': {
        const idx = items.findIndex((it) => it.positionId === item.positionId || it === item);
        if (idx <= 0) {
          return (
            <Chip
              size="small"
              label="🚩 Partida inicial"
              sx={{ fontWeight: 600, fontSize: '0.72rem', backgroundColor: '#ecfdf5', color: '#047857' }}
            />
          );
        }
        const prev = items[idx - 1];
        const prevText = prev.address || `Parada #${prev.stopNumber || idx}`;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.78rem', color: '#475569' }}>
            <span>⬅️</span>
            <span style={{ fontWeight: 500 }}>{prevText}</span>
          </Box>
        );
      }
      case 'destinationContext': {
        const idx = items.findIndex((it) => it.positionId === item.positionId || it === item);
        if (idx >= items.length - 1) {
          return (
            <Chip
              size="small"
              label="🏁 Fin de servicio"
              sx={{ fontWeight: 600, fontSize: '0.72rem', backgroundColor: '#f3e8ff', color: '#6b21a8' }}
            />
          );
        }
        const next = items[idx + 1];
        const nextText = next.address || `Parada #${next.stopNumber || idx + 2}`;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.78rem', color: '#475569' }}>
            <span>➡️</span>
            <span style={{ fontWeight: 500 }}>{nextText}</span>
          </Box>
        );
      }
      case 'address': {
        if (item.address && item.address.trim().length > 0) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Chip
                size="small"
                label={`#${item.stopNumber || ''}`}
                color="primary"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
              />
              <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                {item.address}
              </Typography>
            </Box>
          );
        }
        return (
          <AddressValue
            latitude={item.latitude}
            longitude={item.longitude}
            originalAddress={item[key]}
          />
        );
      }
      default:
        return item[key];
    }
  };

  // Posiciones contextuales para el mapa: Parada anterior, Parada seleccionada y Próxima parada
  const getMapPositions = () => {
    if (!selectedItem) return [];
    const idx = items.findIndex((it) => it.positionId === selectedItem.positionId || it === selectedItem);
    const positions = [];

    // 1. Parada anterior si existe
    if (idx > 0) {
      const prev = items[idx - 1];
      positions.push({
        id: `prev_${prev.positionId || idx}`,
        deviceId: prev.deviceId,
        fixTime: prev.startTime,
        latitude: prev.latitude,
        longitude: prev.longitude,
        name: `⬅️ Parada Anterior (#${prev.stopNumber || idx})`,
      });
    }

    // 2. Parada actual seleccionada
    positions.push({
      id: selectedItem.positionId || 'current_stop',
      deviceId: selectedItem.deviceId,
      fixTime: selectedItem.startTime,
      latitude: selectedItem.latitude,
      longitude: selectedItem.longitude,
      name: `📍 Parada Actual (#${selectedItem.stopNumber || idx + 1})`,
    });

    // 3. Parada siguiente si existe
    if (idx < items.length - 1) {
      const next = items[idx + 1];
      positions.push({
        id: `next_${next.positionId || idx}`,
        deviceId: next.deviceId,
        fixTime: next.startTime,
        latitude: next.latitude,
        longitude: next.longitude,
        name: `➡️ Destino Posterior (#${next.stopNumber || idx + 2})`,
      });
    }

    return positions;
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportStops']}>
      <div className={classes.container}>
        {selectedItem && (
          <div className={classes.containerMap}>
            <MapView>
              <MapGeofence />
              <MapPositions
                positions={getMapPositions()}
                titleField="name"
              />
            </MapView>
            <MapCamera latitude={selectedItem.latitude} longitude={selectedItem.longitude} />
          </div>
        )}
        <div className={classes.containerMain}>
          <div className={classes.header}>
            <ReportFilter handleSubmit={handleSubmit} handleSchedule={handleSchedule}>
              <ColumnSelect columns={columns} setColumns={setColumns} columnsArray={columnsArray} />
            </ReportFilter>
          </div>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell className={classes.columnAction} />
                {columns.map((key) => (<TableCell key={key}>{getColumnLabel(key)}</TableCell>))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading ? items.map((item) => (
                <TableRow key={item.positionId}>
                  <TableCell className={classes.columnAction} padding="none">
                    {selectedItem === item ? (
                      <IconButton size="small" onClick={() => setSelectedItem(null)}>
                        <GpsFixedIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <IconButton size="small" onClick={() => setSelectedItem(item)}>
                        <LocationSearchingIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                  {columns.map((key) => (
                    <TableCell key={key}>
                      {formatValue(item, key)}
                    </TableCell>
                  ))}
                </TableRow>
              )) : (<TableShimmer columns={columns.length + 1} startAction />)}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
};

export default StopReportPage;
