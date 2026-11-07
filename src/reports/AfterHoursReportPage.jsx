import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  IconButton,
  Table, TableBody, TableCell, TableHead, TableRow,
  Paper, Typography, Box, Chip, Button, MenuItem, Select, FormControl, InputLabel, Tooltip, TextField,
} from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PaidIcon from '@mui/icons-material/Paid';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RouteIcon from '@mui/icons-material/Route';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

import { formatDistance, formatSpeed, formatHours, formatTime } from '../common/util/formatter';
import ReportFilter from './components/ReportFilter';
import { useAttributePreference, usePreference } from '../common/util/preferences';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import { useCatch, useEffectAsync } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapCamera from '../map/MapCamera';
import MapMarkers from '../map/MapMarkers';
import MapGeofence from '../map/MapGeofence';
import AddressValue from '../common/components/AddressValue';
import TableShimmer from '../common/components/TableShimmer';
import scheduleReport from './common/scheduleReport';

const createMarkers = (item) => [
  {
    latitude: item.startLat,
    longitude: item.startLon,
    title: 'Inicio No Autorizado',
    color: '#16a34a', // Verde
  },
  {
    latitude: item.endLat,
    longitude: item.endLon,
    title: 'Fin del Recorrido',
    color: '#dc2626', // Rojo
  },
];

const AfterHoursReportPage = () => {
  const navigate = useNavigate();
  const classes = useReportStyles();
  const t = useTranslation();

  const distanceUnit = useAttributePreference('distanceUnit');
  const speedUnit = useAttributePreference('speedUnit');
  const hours12 = usePreference('twelveHourFormat');
  const devices = useSelector((state) => state.devices.items);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [route, setRoute] = useState(null);

  // Parámetros de Horario Laboral y Régimen
  const [workStartHour, setWorkStartHour] = useState(8); // 08:00 AM
  const [workEndHour, setWorkEndHour] = useState(18); // 18:00 PM (06:00 PM)
  const [scheduleMode, setScheduleMode] = useState('mon_fri'); // mon_fri, mon_sat_noon, mon_sat, all_days
  const [kmPerLiter, setKmPerLiter] = useState(8.0); // Rendimiento estimado: 8 km por litro
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState(4.35); // ~S/ 16.50 por galón

  // Cargar ruta detallada del viaje seleccionado para ver en el mapa
  useEffectAsync(async () => {
    if (selectedItem) {
      try {
        const query = new URLSearchParams({
          deviceId: selectedItem.deviceId,
          from: selectedItem.startTime,
          to: selectedItem.endTime,
        });
        const response = await fetch(`/api/reports/route?${query.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        if (response.ok) {
          setRoute(await response.json());
        }
      } catch (e) {
        console.error('Error al cargar ruta no autorizada:', e);
      }
    } else {
      setRoute(null);
    }
  }, [selectedItem]);

  const handleSubmit = useCatch(async ({ deviceId, from, to, type }) => {
    const query = new URLSearchParams({ deviceId, from, to });
    if (type === 'export') {
      window.location.assign(`/api/reports/trips/xlsx?${query.toString()}`);
      return;
    }
    if (type === 'mail') {
      const response = await fetch(`/api/reports/trips/mail?${query.toString()}`);
      if (!response.ok) {
        throw Error(await response.text());
      }
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/reports/trips?${query.toString()}`, {
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
    report.type = 'trips';
    const error = await scheduleReport(deviceIds, groupIds, report);
    if (error) {
      throw Error(error);
    } else {
      navigate('/reports/scheduled');
    }
  });

  // Evaluar viajes para detectar infracciones fuera de horario o fin de semana
  const afterHoursTrips = useMemo(() => {
    if (!items || !items.length) return [];

    return items
      .map((trip) => {
        const start = dayjs(trip.startTime);
        const end = dayjs(trip.endTime);

        const dayOfWeek = start.day(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const startHourDecimal = start.hour() + start.minute() / 60;
        const endHourDecimal = end.hour() + end.minute() / 60;

        let isUnauthorized = false;
        let reason = '';

        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;

        switch (scheduleMode) {
          case 'mon_fri':
            if (isSunday) {
              isUnauthorized = true;
              reason = 'Domingo no autorizado';
            } else if (isSaturday) {
              isUnauthorized = true;
              reason = 'Sábado no autorizado';
            } else if (startHourDecimal < workStartHour || endHourDecimal > workEndHour) {
              isUnauthorized = true;
              reason = startHourDecimal >= workEndHour || startHourDecimal < 6 ? 'Uso Nocturno' : 'Fuera de Horario';
            }
            break;

          case 'mon_sat_noon':
            if (isSunday) {
              isUnauthorized = true;
              reason = 'Domingo no autorizado';
            } else if (isSaturday && (startHourDecimal < workStartHour || endHourDecimal > 13)) {
              isUnauthorized = true;
              reason = 'Sábado tarde (Post-13:00)';
            } else if (!isSaturday && (startHourDecimal < workStartHour || endHourDecimal > workEndHour)) {
              isUnauthorized = true;
              reason = startHourDecimal >= workEndHour || startHourDecimal < 6 ? 'Uso Nocturno' : 'Fuera de Horario';
            }
            break;

          case 'mon_sat':
            if (isSunday) {
              isUnauthorized = true;
              reason = 'Domingo no autorizado';
            } else if (startHourDecimal < workStartHour || endHourDecimal > workEndHour) {
              isUnauthorized = true;
              reason = startHourDecimal >= workEndHour || startHourDecimal < 6 ? 'Uso Nocturno' : 'Fuera de Horario';
            }
            break;

          case 'all_days':
            if (startHourDecimal < workStartHour || endHourDecimal > workEndHour) {
              isUnauthorized = true;
              reason = startHourDecimal >= workEndHour || startHourDecimal < 6 ? 'Uso Nocturno' : 'Fuera de Horario';
            }
            break;

          default:
            break;
        }

        if (!isUnauthorized) return null;

        const distanceKm = trip.distance ? parseFloat((trip.distance / 1000).toFixed(2)) : 0;
        const wastedLiters = parseFloat((distanceKm / kmPerLiter).toFixed(2));
        const estimatedCost = parseFloat((wastedLiters * fuelPricePerLiter).toFixed(2));

        const dev = devices[trip.deviceId];
        const deviceName = dev ? dev.name : (trip.deviceName || `ID ${trip.deviceId}`);

        return {
          ...trip,
          deviceName,
          reason,
          dayName: start.format('dddd'),
          distanceKm,
          wastedLiters,
          estimatedCost,
          durationHours: trip.duration / 3600000,
        };
      })
      .filter(Boolean);
  }, [items, devices, workStartHour, workEndHour, scheduleMode, kmPerLiter, fuelPricePerLiter]);

  // Totales y KPIs
  const summaryKpis = useMemo(() => {
    if (!afterHoursTrips.length) {
      return { totalTrips: 0, totalKm: 0, totalDurationMs: 0, totalLiters: 0, totalCost: 0 };
    }
    const totalTrips = afterHoursTrips.length;
    const totalKm = parseFloat(afterHoursTrips.reduce((acc, t) => acc + t.distanceKm, 0).toFixed(1));
    const totalDurationMs = afterHoursTrips.reduce((acc, t) => acc + (t.duration || 0), 0);
    const totalLiters = parseFloat(afterHoursTrips.reduce((acc, t) => acc + t.wastedLiters, 0).toFixed(1));
    const totalCost = parseFloat(afterHoursTrips.reduce((acc, t) => acc + t.estimatedCost, 0).toFixed(2));

    return { totalTrips, totalKm, totalDurationMs, totalLiters, totalCost };
  }, [afterHoursTrips]);

  // Exportar a Excel (XLSX)
  const handleExportExcel = () => {
    if (!afterHoursTrips.length) return;

    const dataToExport = afterHoursTrips.map((trip, index) => ({
      'N°': index + 1,
      'Vehículo / Placa': trip.deviceName,
      'Conductor': trip.driverName || 'No asignado',
      'Motivo Infracción': trip.reason,
      'Día de Semana': trip.dayName,
      'Hora Inicio': formatTime(trip.startTime, 'minutes', hours12),
      'Hora Fin': formatTime(trip.endTime, 'minutes', hours12),
      'Km No Autorizados': trip.distanceKm,
      'Duración (hh:mm)': formatHours(trip.duration),
      'Vel. Máxima': formatSpeed(trip.maxSpeed, speedUnit, t),
      'Combustible Est. (L)': trip.wastedLiters,
      'Costo No Autorizado (S/)': trip.estimatedCost,
      'Origen': trip.startAddress || `${trip.startLat}, ${trip.startLon}`,
      'Destino': trip.endAddress || `${trip.endLat}, ${trip.endLon}`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Uso Fuera de Horario');

    const colWidths = [
      { wch: 5 }, { wch: 18 }, { wch: 20 }, { wch: 22 },
      { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 22 },
      { wch: 35 }, { wch: 35 },
    ];
    worksheet['!cols'] = colWidths;

    const filename = `Reporte_Uso_Fuera_Horario_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'Uso Fuera de Horario / Fines de Semana']}>
      <div className={classes.container}>
        {/* Mapa con la ruta completa del viaje no autorizado */}
        {selectedItem && (
          <div className={classes.containerMap}>
            <MapView>
              <MapGeofence />
              {route && <MapRoutePath positions={route} />}
              <MapMarkers markers={createMarkers(selectedItem)} />
            </MapView>
            <MapCamera latitude={selectedItem.startLat} longitude={selectedItem.startLon} />
          </div>
        )}

        <div className={classes.containerMain}>
          {/* Filtro superior */}
          <div className={classes.header}>
            <ReportFilter handleSubmit={handleSubmit} handleSchedule={handleSchedule} multiDevice>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Régimen Permitido</InputLabel>
                  <Select
                    value={scheduleMode}
                    label="Régimen Permitido"
                    onChange={(e) => setScheduleMode(e.target.value)}
                  >
                    <MenuItem value="mon_fri">Lunes a Viernes (Sáb/Dom Prohibido)</MenuItem>
                    <MenuItem value="mon_sat_noon">Lunes a Sábado 13:00 (Dom Prohibido)</MenuItem>
                    <MenuItem value="mon_sat">Lunes a Sábado Completo</MenuItem>
                    <MenuItem value="all_days">Todos los días (Solo nocturno)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Hora Entrada</InputLabel>
                  <Select
                    value={workStartHour}
                    label="Hora Entrada"
                    onChange={(e) => setWorkStartHour(Number(e.target.value))}
                  >
                    <MenuItem value={6}>06:00 AM</MenuItem>
                    <MenuItem value={7}>07:00 AM</MenuItem>
                    <MenuItem value={8}>08:00 AM (Estándar)</MenuItem>
                    <MenuItem value={9}>09:00 AM</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Hora Salida</InputLabel>
                  <Select
                    value={workEndHour}
                    label="Hora Salida"
                    onChange={(e) => setWorkEndHour(Number(e.target.value))}
                  >
                    <MenuItem value={17}>05:00 PM (17:00)</MenuItem>
                    <MenuItem value={18}>06:00 PM (18:00)</MenuItem>
                    <MenuItem value={19}>07:00 PM (19:00)</MenuItem>
                    <MenuItem value={20}>08:00 PM (20:00)</MenuItem>
                  </Select>
                </FormControl>

                {afterHoursTrips.length > 0 && (
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
              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #ef4444' }}>
                <BedtimeIcon sx={{ fontSize: 36, color: '#ef4444' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Viajes No Autorizados</Typography>
                  <Typography variant="h6" fontWeight={700} color="#ef4444">{summaryKpis.totalTrips}</Typography>
                </div>
              </Paper>

              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #f59e0b' }}>
                <RouteIcon sx={{ fontSize: 36, color: '#f59e0b' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Km No Autorizados</Typography>
                  <Typography variant="h6" fontWeight={700}>{summaryKpis.totalKm} km</Typography>
                </div>
              </Paper>

              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #3b82f6' }}>
                <AccessTimeIcon sx={{ fontSize: 36, color: '#3b82f6' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Tiempo de Uso Ilegal</Typography>
                  <Typography variant="h6" fontWeight={700}>{formatHours(summaryKpis.totalDurationMs)}</Typography>
                </div>
              </Paper>

              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #10b981' }}>
                <PaidIcon sx={{ fontSize: 36, color: '#10b981' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Gasto en Combustible</Typography>
                  <Typography variant="h6" fontWeight={700} color="#10b981">S/ {summaryKpis.totalCost.toFixed(2)}</Typography>
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
                <TableCell>Infracción / Motivo</TableCell>
                <TableCell>Hora Inicio</TableCell>
                <TableCell>Hora Fin</TableCell>
                <TableCell>Distancia</TableCell>
                <TableCell>Duración</TableCell>
                <TableCell>Vel. Máxima</TableCell>
                <TableCell>Costo Est. (S/)</TableCell>
                <TableCell>Origen / Destino</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading ? (
                afterHoursTrips.length > 0 ? (
                  afterHoursTrips.map((trip, idx) => (
                    <TableRow key={`${trip.startPositionId || idx}`}>
                      <TableCell className={classes.columnAction} padding="none">
                        {selectedItem === trip ? (
                          <Tooltip title="Cerrar mapa">
                            <IconButton size="small" onClick={() => setSelectedItem(null)}>
                              <GpsFixedIcon fontSize="small" color="primary" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Ver ruta en mapa">
                            <IconButton size="small" onClick={() => setSelectedItem(trip)}>
                              <LocationSearchingIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{trip.deviceName}</Typography>
                        {trip.driverName && (
                          <Typography variant="caption" color="text.secondary">
                            Chofer: {trip.driverName}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={<WarningAmberIcon sx={{ fontSize: '13px !important' }} />}
                          label={trip.reason}
                          color={trip.reason.includes('Domingo') ? 'error' : 'warning'}
                          sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>{formatTime(trip.startTime, 'minutes', hours12)}</TableCell>
                      <TableCell>{formatTime(trip.endTime, 'minutes', hours12)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="#dc2626">
                          {formatDistance(trip.distance, distanceUnit, t)}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatHours(trip.duration)}</TableCell>
                      <TableCell>{formatSpeed(trip.maxSpeed, speedUnit, t)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="#16a34a">
                          S/ {trip.estimatedCost.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <div style={{ fontSize: '0.78rem' }}>
                          <strong>De:</strong> <AddressValue latitude={trip.startLat} longitude={trip.startLon} originalAddress={trip.startAddress} />
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                          <strong>A:</strong> <AddressValue latitude={trip.endLat} longitude={trip.endLon} originalAddress={trip.endAddress} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length > 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        🎉 Excelente: No se detectaron viajes no autorizados fuera del horario laboral ni en fin de semana en el período seleccionado.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                      <BedtimeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
                      <Typography color="text.secondary">
                        Selecciona el rango de fechas y vehículos en el filtro superior para auditar el uso fuera de horario laboral.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )
              ) : (
                <TableShimmer columns={10} startAction />
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
};

export default AfterHoursReportPage;

