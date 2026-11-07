import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  IconButton,
  Table, TableBody, TableCell, TableHead, TableRow,
  Paper, Typography, Box, Chip, Button, TextField, MenuItem, Select, FormControl, InputLabel, Tooltip,
} from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PaidIcon from '@mui/icons-material/Paid';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

import { formatTime, formatHours } from '../common/util/formatter';
import ReportFilter from './components/ReportFilter';
import { usePreference } from '../common/util/preferences';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import { useCatch } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import MapPositions from '../map/MapPositions';
import MapView from '../map/core/MapView';
import MapCamera from '../map/MapCamera';
import AddressValue from '../common/components/AddressValue';
import TableShimmer from '../common/components/TableShimmer';
import MapGeofence from '../map/MapGeofence';
import scheduleReport from './common/scheduleReport';

const IdlingReportPage = () => {
  const navigate = useNavigate();
  const classes = useReportStyles();
  const t = useTranslation();

  const hours12 = usePreference('twelveHourFormat');
  const devices = useSelector((state) => state.devices.items);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Parámetros de configuración de Ralentí
  const [minIdlingMinutes, setMinIdlingMinutes] = useState(5); // Mínimo 5 min por defecto
  const [fuelRateLitersPerHour, setFuelRateLitersPerHour] = useState(2.5); // 2.5 L/h (Camión ligero / estándar)
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState(4.35); // ~S/ 16.50 por galón diésel en Perú

  const handleSubmit = useCatch(async ({ deviceId, from, to, type }) => {
    const query = new URLSearchParams({ deviceId, from, to });
    if (type === 'export') {
      window.location.assign(`/api/reports/stops/xlsx?${query.toString()}`);
      return;
    }
    if (type === 'mail') {
      const response = await fetch(`/api/reports/stops/mail?${query.toString()}`);
      if (!response.ok) {
        throw Error(await response.text());
      }
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/reports/stops?${query.toString()}`, {
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
    report.type = 'stops';
    const error = await scheduleReport(deviceIds, groupIds, report);
    if (error) {
      throw Error(error);
    } else {
      navigate('/reports/scheduled');
    }
  });

  // Filtrar y procesar los registros de ralentí
  const idlingItems = useMemo(() => {
    if (!items || !items.length) return [];

    return items
      .map((item) => {
        // En Traccar, engineHours en una parada = tiempo con motor encendido durante la parada
        // Si el dispositivo tiene sensor de ignición, usamos engineHours; si no, duration
        const hasEngineData = item.engineHours && item.engineHours > 0;
        const durationMs = hasEngineData ? item.engineHours : item.duration;
        const durationMinutes = Math.round(durationMs / 60000);
        const durationHours = durationMs / 3600000;

        // Combustible en litros y costo en moneda local
        const wastedLiters = parseFloat((durationHours * fuelRateLitersPerHour).toFixed(2));
        const wastedGallons = parseFloat((wastedLiters / 3.78541).toFixed(2));
        const estimatedCost = parseFloat((wastedLiters * fuelPricePerLiter).toFixed(2));

        const dev = devices[item.deviceId];
        const deviceName = dev ? dev.name : (item.deviceName || `ID ${item.deviceId}`);

        return {
          ...item,
          deviceName,
          idlingDurationMs: durationMs,
          durationMinutes,
          durationHours,
          wastedLiters,
          wastedGallons,
          estimatedCost,
          isHighAlert: durationMinutes >= 30, // Alerta crítica si supera 30 minutos
          isMediumAlert: durationMinutes >= 15 && durationMinutes < 30,
        };
      })
      .filter((item) => item.durationMinutes >= minIdlingMinutes);
  }, [items, devices, minIdlingMinutes, fuelRateLitersPerHour, fuelPricePerLiter]);

  // Totales y KPIs
  const summaryKpis = useMemo(() => {
    if (!idlingItems.length) {
      return { totalEvents: 0, totalDurationMs: 0, totalLiters: 0, totalGallons: 0, totalCost: 0 };
    }
    const totalEvents = idlingItems.length;
    const totalDurationMs = idlingItems.reduce((acc, it) => acc + it.idlingDurationMs, 0);
    const totalLiters = parseFloat(idlingItems.reduce((acc, it) => acc + it.wastedLiters, 0).toFixed(2));
    const totalGallons = parseFloat((totalLiters / 3.78541).toFixed(2));
    const totalCost = parseFloat(idlingItems.reduce((acc, it) => acc + it.estimatedCost, 0).toFixed(2));

    return { totalEvents, totalDurationMs, totalLiters, totalGallons, totalCost };
  }, [idlingItems]);

  // Exportar a Excel directamente con cálculos de costo y tiempo
  const handleExportExcel = () => {
    if (!idlingItems.length) return;

    const dataToExport = idlingItems.map((item, index) => ({
      'N°': index + 1,
      'Vehículo / Placa': item.deviceName,
      'Inicio de Ralentí': formatTime(item.startTime, 'minutes', hours12),
      'Fin de Ralentí': formatTime(item.endTime, 'minutes', hours12),
      'Duración (hh:mm)': formatHours(item.idlingDurationMs),
      'Duración (Minutos)': item.durationMinutes,
      'Combustible Desperdiciado (Litros)': item.wastedLiters,
      'Combustible Desperdiciado (Galones)': item.wastedGallons,
      'Costo Estimado (S/)': item.estimatedCost,
      'Dirección / Ubicación': item.address || `Lat: ${item.latitude}, Lng: ${item.longitude}`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ralentí Excesivo');

    // Auto-ajustar anchos de columnas
    const colWidths = [
      { wch: 5 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
      { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 24 },
      { wch: 18 }, { wch: 45 },
    ];
    worksheet['!cols'] = colWidths;

    const filename = `Reporte_Ralenti_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'Ralentí Excesivo (Idling)']}>
      <div className={classes.container}>
        {/* Mapa flotante al hacer clic en un evento */}
        {selectedItem && (
          <div className={classes.containerMap}>
            <MapView>
              <MapGeofence />
              <MapPositions
                positions={[{
                  deviceId: selectedItem.deviceId,
                  fixTime: selectedItem.startTime,
                  latitude: selectedItem.latitude,
                  longitude: selectedItem.longitude,
                }]}
                titleField="fixTime"
              />
            </MapView>
            <MapCamera latitude={selectedItem.latitude} longitude={selectedItem.longitude} />
          </div>
        )}

        <div className={classes.containerMain}>
          {/* Filtro superior estándar */}
          <div className={classes.header}>
            <ReportFilter handleSubmit={handleSubmit} handleSchedule={handleSchedule} multiDevice>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Mín. Ralentí</InputLabel>
                  <Select
                    value={minIdlingMinutes}
                    label="Mín. Ralentí"
                    onChange={(e) => setMinIdlingMinutes(Number(e.target.value))}
                  >
                    <MenuItem value={3}>3 minutos</MenuItem>
                    <MenuItem value={5}>5 minutos (Estándar)</MenuItem>
                    <MenuItem value={10}>10 minutos</MenuItem>
                    <MenuItem value={15}>15 minutos</MenuItem>
                    <MenuItem value={30}>30 minutos (Crítico)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 165 }}>
                  <InputLabel>Consumo Tasa</InputLabel>
                  <Select
                    value={fuelRateLitersPerHour}
                    label="Consumo Tasa"
                    onChange={(e) => setFuelRateLitersPerHour(Number(e.target.value))}
                  >
                    <MenuItem value={1.2}>1.2 L/h (Auto / SUV)</MenuItem>
                    <MenuItem value={2.5}>2.5 L/h (Camión Ligero)</MenuItem>
                    <MenuItem value={4.0}>4.0 L/h (Maq. Pesada)</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  size="small"
                  label="Precio/Litro (S/)"
                  type="number"
                  value={fuelPricePerLiter}
                  onChange={(e) => setFuelPricePerLiter(Number(e.target.value))}
                  sx={{ width: 130 }}
                  inputProps={{ step: '0.1' }}
                />

                {idlingItems.length > 0 && (
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
                <WarningAmberIcon sx={{ fontSize: 36, color: '#ef4444' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Eventos de Ralentí</Typography>
                  <Typography variant="h6" fontWeight={700}>{summaryKpis.totalEvents}</Typography>
                </div>
              </Paper>

              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #f59e0b' }}>
                <AccessTimeIcon sx={{ fontSize: 36, color: '#f59e0b' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Tiempo Total Perdido</Typography>
                  <Typography variant="h6" fontWeight={700}>{formatHours(summaryKpis.totalDurationMs)}</Typography>
                </div>
              </Paper>

              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #3b82f6' }}>
                <LocalGasStationIcon sx={{ fontSize: 36, color: '#3b82f6' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Combustible Desperdiciado</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {summaryKpis.totalLiters} L <Typography component="span" variant="caption" color="text.secondary">({summaryKpis.totalGallons} Gal)</Typography>
                  </Typography>
                </div>
              </Paper>

              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderLeft: '4px solid #10b981' }}>
                <PaidIcon sx={{ fontSize: 36, color: '#10b981' }} />
                <div>
                  <Typography variant="caption" color="text.secondary">Costo Financiero Estimado</Typography>
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
                <TableCell>Inicio Ralentí</TableCell>
                <TableCell>Fin Ralentí</TableCell>
                <TableCell>Duración</TableCell>
                <TableCell>Combustible Estimado</TableCell>
                <TableCell>Costo Estimado</TableCell>
                <TableCell>Ubicación / Dirección</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading ? (
                idlingItems.length > 0 ? (
                  idlingItems.map((item, idx) => (
                    <TableRow key={`${item.positionId || idx}`}>
                      <TableCell className={classes.columnAction} padding="none">
                        {selectedItem === item ? (
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
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{item.deviceName}</Typography>
                      </TableCell>
                      <TableCell>{formatTime(item.startTime, 'minutes', hours12)}</TableCell>
                      <TableCell>{formatTime(item.endTime, 'minutes', hours12)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{formatHours(item.idlingDurationMs)}</span>
                          {item.isHighAlert && (
                            <Chip size="small" label="Crítico (>30m)" color="error" sx={{ height: 20, fontSize: '0.68rem' }} />
                          )}
                          {item.isMediumAlert && (
                            <Chip size="small" label="Alto (>15m)" color="warning" sx={{ height: 20, fontSize: '0.68rem' }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="#2563eb">
                          {item.wastedLiters} L
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({item.wastedGallons} Gal)
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="#16a34a">
                          S/ {item.estimatedCost.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <AddressValue latitude={item.latitude} longitude={item.longitude} originalAddress={item.address} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length > 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No se detectaron eventos de ralentí que superen los {minIdlingMinutes} minutos en el período seleccionado.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                      <LocalGasStationIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
                      <Typography color="text.secondary">
                        Selecciona el rango de fechas y vehículos en el filtro superior para generar el reporte de ralentí.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )
              ) : (
                <TableShimmer columns={8} startAction />
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
};

export default IdlingReportPage;

