import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  IconButton,
  Table, TableBody, TableCell, TableHead, TableRow,
  Paper, Typography, Box, Chip, Button, MenuItem, Select, FormControl, InputLabel, Tooltip, FormControlLabel, Checkbox,
} from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import BusinessIcon from '@mui/icons-material/Business';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

import { formatTime, formatHours } from '../common/util/formatter';
import ReportFilter from './components/ReportFilter';
import { usePreference } from '../common/util/preferences';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import { useCatch, useEffectAsync } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import MapPositions from '../map/MapPositions';
import MapView from '../map/core/MapView';
import MapCamera from '../map/MapCamera';
import TableShimmer from '../common/components/TableShimmer';
import MapGeofence from '../map/MapGeofence';
import scheduleReport from './common/scheduleReport';

const DwellTimeReportPage = () => {
  const navigate = useNavigate();
  const classes = useReportStyles();
  const t = useTranslation();

  const hours12 = usePreference('twelveHourFormat');
  const devices = useSelector((state) => state.devices.items);
  const rawGeofences = useSelector((state) => state.geofences.items);

  const [geofencesMap, setGeofencesMap] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);

  // Parámetros de tolerancia y filtros de permanencia
  const [maxToleranceMinutes, setMaxToleranceMinutes] = useState(45); // 45 min pactados por defecto
  const [selectedGeofenceFilter, setSelectedGeofenceFilter] = useState('all');
  const [onlyOvertime, setOnlyOvertime] = useState(false);

  // Cargar geocercas en caso de que el store no esté poblado
  useEffectAsync(async () => {
    if (rawGeofences && Object.keys(rawGeofences).length > 0) {
      setGeofencesMap(rawGeofences);
    } else {
      try {
        const response = await fetch('/api/geofences');
        if (response.ok) {
          const list = await response.json();
          const map = {};
          list.forEach((g) => {
            map[g.id] = g;
          });
          setGeofencesMap(map);
        }
      } catch (e) {
        console.error('Error al cargar geocercas:', e);
      }
    }
  }, [rawGeofences]);

  // Al seleccionar un registro, obtener posición para el mapa
  useEffectAsync(async () => {
    if (selectedItem && selectedItem.positionId) {
      try {
        const response = await fetch(`/api/positions?id=${selectedItem.positionId}`);
        if (response.ok) {
          const positions = await response.json();
          if (positions.length > 0) {
            setSelectedPosition(positions[0]);
          }
        }
      } catch (e) {
        console.error('Error al cargar posición para mapa:', e);
      }
    } else {
      setSelectedPosition(null);
    }
  }, [selectedItem]);

  const handleSubmit = useCatch(async ({ deviceId, from, to, type }) => {
    const query = new URLSearchParams({ deviceId, from, to });
    query.append('type', 'geofenceEnter');
    query.append('type', 'geofenceExit');

    if (type === 'export') {
      window.location.assign(`/api/reports/events/xlsx?${query.toString()}`);
      return;
    }
    if (type === 'mail') {
      const response = await fetch(`/api/reports/events/mail?${query.toString()}`);
      if (!response.ok) {
        throw Error(await response.text());
      }
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/reports/events?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        setItems(await response.json());
      } else {
        throw Error(await response.text());
      }
    } finally {
      setLoading(false);
    }
  });

  const handleSchedule = useCatch(async (deviceIds, groupIds, report) => {
    report.type = 'events';
    report.attributes = { types: 'geofenceEnter,geofenceExit' };
    const error = await scheduleReport(deviceIds, groupIds, report);
    if (error) {
      throw Error(error);
    } else {
      navigate('/reports/scheduled');
    }
  });

  // Emparejar eventos de entrada y salida para calcular la estadía (Dwell Time)
  const dwellVisits = useMemo(() => {
    if (!items || !items.length) return [];

    // Ordenar cronológicamente
    const sorted = [...items].sort((a, b) => new Date(a.eventTime) - new Date(b.eventTime));

    const visits = [];
    // Diccionario temporal por dispositivo y geocerca: deviceId_geofenceId -> enterEvent
    const activeEnters = {};

    sorted.forEach((event) => {
      const gId = event.geofenceId;
      const dId = event.deviceId;
      if (!gId || !dId) return;

      const key = `${dId}_${gId}`;

      if (event.type === 'geofenceEnter') {
        // Si ya había una entrada previa sin salida, la cerramos con advertencia
        if (activeEnters[key]) {
          const prev = activeEnters[key];
          const durMs = Math.max(0, new Date(event.eventTime) - new Date(prev.eventTime));
          const durMin = Math.round(durMs / 60000);
          visits.push({
            id: `visit_${prev.id}_${event.id}`,
            deviceId: dId,
            geofenceId: gId,
            enterTime: prev.eventTime,
            exitTime: event.eventTime,
            durationMs: durMs,
            durationMinutes: durMin,
            positionId: prev.positionId || event.positionId,
            isStillInside: false,
            wasInterrupted: true,
          });
        }
        activeEnters[key] = event;
      } else if (event.type === 'geofenceExit') {
        const enterEvt = activeEnters[key];
        if (enterEvt) {
          const durMs = Math.max(0, new Date(event.eventTime) - new Date(enterEvt.eventTime));
          const durMin = Math.round(durMs / 60000);
          visits.push({
            id: `visit_${enterEvt.id}_${event.id}`,
            deviceId: dId,
            geofenceId: gId,
            enterTime: enterEvt.eventTime,
            exitTime: event.eventTime,
            durationMs: durMs,
            durationMinutes: durMin,
            positionId: enterEvt.positionId || event.positionId,
            isStillInside: false,
          });
          delete activeEnters[key];
        } else {
          // Salida sin entrada registrada en este período (ingresó antes del inicio del filtro)
          visits.push({
            id: `exit_only_${event.id}`,
            deviceId: dId,
            geofenceId: gId,
            enterTime: null, // Ingreso previo al período
            exitTime: event.eventTime,
            durationMs: 0,
            durationMinutes: 0,
            positionId: event.positionId,
            isPriorEntry: true,
            isStillInside: false,
          });
        }
      }
    });

    // Procesar los que aún siguen dentro al momento de la consulta
    const now = new Date();
    Object.keys(activeEnters).forEach((key) => {
      const enterEvt = activeEnters[key];
      const durMs = Math.max(0, now - new Date(enterEvt.eventTime));
      const durMin = Math.round(durMs / 60000);
      visits.push({
        id: `live_${enterEvt.id}`,
        deviceId: enterEvt.deviceId,
        geofenceId: enterEvt.geofenceId,
        enterTime: enterEvt.eventTime,
        exitTime: null,
        durationMs: durMs,
        durationMinutes: durMin,
        positionId: enterEvt.positionId,
        isStillInside: true,
      });
    });

    // Enriquecer con nombres y estado de SLA
    const enriched = visits.map((v) => {
      const dev = devices[v.deviceId];
      const deviceName = dev ? dev.name : `ID ${v.deviceId}`;

      const geo = geofencesMap[v.geofenceId];
      const geofenceName = geo ? geo.name : `Geocerca #${v.geofenceId}`;

      const isOvertime = !v.isPriorEntry && v.durationMinutes > maxToleranceMinutes;
      const overtimeMinutes = isOvertime ? v.durationMinutes - maxToleranceMinutes : 0;

      return {
        ...v,
        deviceName,
        geofenceName,
        isOvertime,
        overtimeMinutes,
      };
    });

    // Filtros de Geocerca específica y Solo Excesos
    return enriched.filter((v) => {
      if (selectedGeofenceFilter !== 'all' && String(v.geofenceId) !== String(selectedGeofenceFilter)) {
        return false;
      }
      if (onlyOvertime && !v.isOvertime) {
        return false;
      }
      return true;
    });
  }, [items, devices, geofencesMap, maxToleranceMinutes, selectedGeofenceFilter, onlyOvertime]);

  // KPIs
  const summaryKpis = useMemo(() => {
    if (!dwellVisits.length) {
      return { totalVisits: 0, avgDurationMs: 0, totalOvertime: 0, insideNow: 0 };
    }
    const totalVisits = dwellVisits.length;
    const completedVisits = dwellVisits.filter((v) => !v.isPriorEntry);
    const totalMs = completedVisits.reduce((acc, v) => acc + v.durationMs, 0);
    const avgDurationMs = completedVisits.length ? Math.round(totalMs / completedVisits.length) : 0;
    const totalOvertime = dwellVisits.filter((v) => v.isOvertime).length;
    const insideNow = dwellVisits.filter((v) => v.isStillInside).length;

    return { totalVisits, avgDurationMs, totalOvertime, insideNow };
  }, [dwellVisits]);

  // Exportar a Excel (XLSX)
  const handleExportExcel = () => {
    if (!dwellVisits.length) return;

    const dataToExport = dwellVisits.map((item, index) => {
      let estadoTexto = 'Conforme';
      if (item.isStillInside) estadoTexto = 'En Recinto (En progreso)';
      else if (item.isPriorEntry) estadoTexto = 'Ingreso previo al período';
      else if (item.isOvertime) estadoTexto = `Exceso (+${item.overtimeMinutes} min)`;

      return {
        'N°': index + 1,
        'Vehículo / Placa': item.deviceName,
        'Geocerca / Cliente': item.geofenceName,
        'Hora de Entrada': item.enterTime ? formatTime(item.enterTime, 'minutes', hours12) : 'Previo al período',
        'Hora de Salida': item.exitTime ? formatTime(item.exitTime, 'minutes', hours12) : 'Actualmente dentro',
        'Estadía (hh:mm)': item.durationMs > 0 ? formatHours(item.durationMs) : '—',
        'Minutos Totales': item.durationMinutes,
        'Tolerancia Pactada (min)': maxToleranceMinutes,
        'Estado de Cumplimiento': estadoTexto,
        'Minutos de Exceso': item.overtimeMinutes || 0,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Permanencia en Geocercas');

    const colWidths = [
      { wch: 5 }, { wch: 18 }, { wch: 28 }, { wch: 20 },
      { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 22 },
      { wch: 26 }, { wch: 18 },
    ];
    worksheet['!cols'] = colWidths;

    const filename = `Reporte_Permanencia_Geocercas_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'Permanencia en Geocercas (Dwell Time)']}>
      <div className={classes.container}>
        {/* Mapa flotante al seleccionar una visita */}
        {selectedItem && selectedPosition && (
          <div className={classes.containerMap}>
            <MapView>
              <MapGeofence />
              <MapPositions
                positions={[{
                  deviceId: selectedPosition.deviceId,
                  fixTime: selectedPosition.fixTime,
                  latitude: selectedPosition.latitude,
                  longitude: selectedPosition.longitude,
                }]}
                titleField="fixTime"
              />
            </MapView>
            <MapCamera latitude={selectedPosition.latitude} longitude={selectedPosition.longitude} />
          </div>
        )}

        <div className={classes.containerMain}>
          {/* Filtro superior */}
          <div className={classes.header}>
            <ReportFilter handleSubmit={handleSubmit} handleSchedule={handleSchedule} multiDevice>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <InputLabel>Tolerancia SLA</InputLabel>
                  <Select
                    value={maxToleranceMinutes}
                    label="Tolerancia SLA"
                    onChange={(e) => setMaxToleranceMinutes(Number(e.target.value))}
                  >
                    <MenuItem value={30}>30 min (Descarga rápida)</MenuItem>
                    <MenuItem value={45}>45 min (Estándar logística)</MenuItem>
                    <MenuItem value={60}>60 min (1 hora)</MenuItem>
                    <MenuItem value={90}>90 min (1h 30m)</MenuItem>
                    <MenuItem value={120}>120 min (2 horas)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Geocerca</InputLabel>
                  <Select
                    value={selectedGeofenceFilter}
                    label="Geocerca"
                    onChange={(e) => setSelectedGeofenceFilter(e.target.value)}
                  >
                    <MenuItem value="all">Todas las Geocercas</MenuItem>
                    {Object.values(geofencesMap).map((g) => (
                      <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={onlyOvertime}
                      onChange={(e) => setOnlyOvertime(e.target.checked)}
                      size="small"
                      color="error"
                    />
                  )}
                  label={<Typography variant="body2" color="error" fontWeight={600}>Solo Excesos / Retrasos</Typography>}
                />

                {dwellVisits.length > 0 && (
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<FileDownloadIcon />}
                    onClick={handleExportExcel}
                    sx={{ height: 40 }}
                  >
                    Exportar Excel
                  </Button>
                )}
              </Box>
            </ReportFilter>
          </div>

          {/* Tarjetas de Resumen KPI */}
          {items.length > 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, p: 2 }}>
              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #3b82f6' }}>
                <BusinessIcon sx={{ fontSize: 36, color: '#3b82f6' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Total Visitas / Estadías</Typography>
                  <Typography variant="h6" fontWeight={700}>{summaryKpis.totalVisits}</Typography>
                </div>
              </Paper>

              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #10b981' }}>
                <AccessTimeIcon sx={{ fontSize: 36, color: '#10b981' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Tiempo Promedio Estadía</Typography>
                  <Typography variant="h6" fontWeight={700}>{formatHours(summaryKpis.avgDurationMs)}</Typography>
                </div>
              </Paper>

              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #ef4444' }}>
                <WarningAmberIcon sx={{ fontSize: 36, color: '#ef4444' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Excesos de Tiempo (SLA)</Typography>
                  <Typography variant="h6" fontWeight={700} color="#ef4444">{summaryKpis.totalOvertime}</Typography>
                </div>
              </Paper>

              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #f59e0b' }}>
                <HourglassTopIcon sx={{ fontSize: 36, color: '#f59e0b' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Actualmente en Recinto</Typography>
                  <Typography variant="h6" fontWeight={700} color="#f59e0b">{summaryKpis.insideNow}</Typography>
                </div>
              </Paper>
            </Box>
          )}

          {/* Tabla de Detalle */}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell className={classes.columnAction} />
                <TableCell>Vehículo / Placa</TableCell>
                <TableCell>Geocerca / Cliente / Almacén</TableCell>
                <TableCell>Hora de Entrada</TableCell>
                <TableCell>Hora de Salida</TableCell>
                <TableCell>Tiempo de Estadía</TableCell>
                <TableCell>Estado de Cumplimiento (SLA)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading ? (
                dwellVisits.length > 0 ? (
                  dwellVisits.map((item, idx) => (
                    <TableRow key={`${item.id || idx}`}>
                      <TableCell className={classes.columnAction} padding="none">
                        {item.positionId && (
                          selectedItem === item ? (
                            <Tooltip title="Cerrar mapa">
                              <IconButton size="small" onClick={() => setSelectedItem(null)}>
                                <GpsFixedIcon fontSize="small" color="primary" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Ver en mapa">
                              <IconButton size="small" onClick={() => setSelectedItem(item)}>
                                <LocationSearchingIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{item.deviceName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BusinessIcon sx={{ fontSize: 18, color: '#64748b' }} />
                          <Typography variant="body2" fontWeight={600} color="#0f4c81">
                            {item.geofenceName}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {item.enterTime ? (
                          formatTime(item.enterTime, 'minutes', hours12)
                        ) : (
                          <Chip size="small" label="Previo al período" sx={{ height: 20, fontSize: '0.68rem', backgroundColor: '#f1f5f9' }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {item.exitTime ? (
                          formatTime(item.exitTime, 'minutes', hours12)
                        ) : (
                          <Chip size="small" label="Actualmente dentro" color="warning" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {item.durationMs > 0 ? formatHours(item.durationMs) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {item.isStillInside ? (
                          <Chip
                            size="small"
                            icon={<HourglassTopIcon sx={{ fontSize: '13px !important' }} />}
                            label="En Recinto (En progreso)"
                            color="warning"
                            sx={{ height: 22, fontSize: '0.72rem' }}
                          />
                        ) : item.isPriorEntry ? (
                          <Chip
                            size="small"
                            label="Salida registrada"
                            sx={{ height: 22, fontSize: '0.72rem', backgroundColor: '#f1f5f9' }}
                          />
                        ) : item.isOvertime ? (
                          <Chip
                            size="small"
                            icon={<WarningAmberIcon sx={{ fontSize: '13px !important' }} />}
                            label={`Exceso (+${item.overtimeMinutes} min)`}
                            color="error"
                            sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            icon={<CheckCircleOutlineIcon sx={{ fontSize: '13px !important' }} />}
                            label="Conforme (A tiempo)"
                            color="success"
                            sx={{ height: 22, fontSize: '0.72rem' }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length > 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No se encontraron registros de permanencia con los filtros seleccionados.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <BusinessIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
                      <Typography color="text.secondary">
                        Selecciona el rango de fechas y vehículos en el filtro superior para calcular los tiempos de permanencia en geocercas.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )
              ) : (
                <TableShimmer columns={7} startAction />
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
};

export default DwellTimeReportPage;

