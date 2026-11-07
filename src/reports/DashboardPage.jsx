import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import { makeStyles } from '@mui/styles';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SpeedIcon from '@mui/icons-material/Speed';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import MapIcon from '@mui/icons-material/Map';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAttributePreference, usePreference } from '../common/util/preferences';
import { formatDistance, formatSpeed, formatTime } from '../common/util/formatter';
import { speedFromKnots } from '../common/util/converter';
import { devicesActions } from '../store';

const useStyles = makeStyles((theme) => ({
  container: {
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
    overflowY: 'auto',
  },
  headerBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
  kpiCard: {
    cursor: 'pointer',
    transition: 'transform 0.18s ease-in-out, box-shadow 0.18s ease-in-out',
    borderRadius: 12,
    border: '2px solid transparent',
    '&:hover': {
      transform: 'translateY(-3px)',
      boxShadow: theme.shadows[6],
    },
  },
  kpiCardActive: {
    borderColor: theme.palette.primary.main,
    boxShadow: theme.shadows[5],
  },
  distributionBar: {
    display: 'flex',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    width: '100%',
  },
  tableCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
}));

const DashboardPage = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const devicesMap = useSelector((state) => state.devices.items);
  const positionsMap = useSelector((state) => state.session.positions);
  const groupsMap = useSelector((state) => state.groups.items);
  const eventsList = useSelector((state) => state.events.items || []);

  const speedUnit = useAttributePreference('speedUnit');
  const distanceUnit = useAttributePreference('distanceUnit');
  const hours12 = usePreference('twelveHourFormat');

  const [activeFilter, setActiveFilter] = useState('all'); // all, moving, idling, parked, offline, lowBattery
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Normalizar y enriquecer el estado de cada vehículo en tiempo real
  const fleetData = useMemo(() => {
    const devices = Object.values(devicesMap || {});

    return devices.map((device) => {
      const pos = positionsMap[device.id];
      const groupName = device.groupId && groupsMap[device.groupId] ? groupsMap[device.groupId].name : 'Sin Grupo';

      const lastTimestamp = pos ? (pos.fixTime || pos.deviceTime) : device.lastUpdate;
      const lastDate = lastTimestamp ? new Date(lastTimestamp) : null;
      const diffHours = lastDate ? (Date.now() - lastDate.getTime()) / (1000 * 3600) : 999;

      const isOnline = device.status === 'online';
      const isOffline = device.status === 'offline' || diffHours > 24 || !pos;

      const speedKnots = pos ? (pos.speed || 0) : 0;
      const speedKmh = Math.round(speedFromKnots(speedKnots, 'kmh'));

      const ignition = Boolean(pos?.attributes?.ignition);
      const motion = Boolean(pos?.attributes?.motion);

      // Batería interna y energía externa
      const batteryPercent = pos?.attributes?.batteryLevel ?? (pos?.attributes?.battery != null && pos.attributes.battery <= 100 ? pos.attributes.battery : null);
      const powerVolts = pos?.attributes?.power != null ? Number(pos.attributes.power).toFixed(1) : null;

      const hasLowBattery = (batteryPercent != null && batteryPercent <= 20) || (powerVolts != null && Number(powerVolts) > 0 && Number(powerVolts) < 11.5) || pos?.attributes?.alarm === 'lowBattery' || pos?.attributes?.alarm === 'powerCut';

      // Estado operativo unificado
      let telemetryStatus = 'offline';
      let statusLabel = 'Sin Señal';
      let statusColor = '#ef4444'; // Red

      if (!isOffline) {
        if (speedKmh >= 3 || (motion && speedKmh >= 1)) {
          telemetryStatus = 'moving';
          statusLabel = 'En Movimiento';
          statusColor = '#10b981'; // Green
        } else if (ignition) {
          telemetryStatus = 'idling';
          statusLabel = 'En Ralentí';
          statusColor = '#0ea5e9'; // Cyan/Blue
        } else {
          telemetryStatus = 'parked';
          statusLabel = 'Estacionado';
          statusColor = '#64748b'; // Slate
        }
      }

      return {
        id: device.id,
        name: device.name,
        uniqueId: device.uniqueId,
        groupName,
        telemetryStatus,
        statusLabel,
        statusColor,
        speedKnots,
        speedKmh,
        ignition,
        isOnline,
        isOffline,
        batteryPercent,
        powerVolts,
        hasLowBattery,
        lastTimestamp,
        diffHours,
        totalDistanceMeters: pos?.attributes?.totalDistance || 0,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
        address: pos?.address,
      };
    });
  }, [devicesMap, positionsMap, groupsMap, refreshKey]);

  // Contadores KPI
  const stats = useMemo(() => {
    const total = fleetData.length;
    const moving = fleetData.filter((d) => d.telemetryStatus === 'moving').length;
    const idling = fleetData.filter((d) => d.telemetryStatus === 'idling').length;
    const parked = fleetData.filter((d) => d.telemetryStatus === 'parked').length;
    const offline = fleetData.filter((d) => d.telemetryStatus === 'offline').length;
    const lowBattery = fleetData.filter((d) => d.hasLowBattery).length;

    const movingPct = total > 0 ? Math.round((moving / total) * 100) : 0;
    const idlingPct = total > 0 ? Math.round((idling / total) * 100) : 0;
    const parkedPct = total > 0 ? Math.round((parked / total) * 100) : 0;
    const offlinePct = total > 0 ? Math.round((offline / total) * 100) : 0;

    return {
      total,
      moving,
      movingPct,
      idling,
      idlingPct,
      parked,
      parkedPct,
      offline,
      offlinePct,
      lowBattery,
    };
  }, [fleetData]);

  // Filtrado de la tabla según filtro activo y término de búsqueda
  const filteredFleet = useMemo(() => {
    let result = fleetData;

    if (activeFilter === 'moving') {
      result = result.filter((d) => d.telemetryStatus === 'moving');
    } else if (activeFilter === 'idling') {
      result = result.filter((d) => d.telemetryStatus === 'idling');
    } else if (activeFilter === 'parked') {
      result = result.filter((d) => d.telemetryStatus === 'parked');
    } else if (activeFilter === 'offline') {
      result = result.filter((d) => d.telemetryStatus === 'offline');
    } else if (activeFilter === 'lowBattery') {
      result = result.filter((d) => d.hasLowBattery);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((d) =>
        d.name.toLowerCase().includes(q)
        || d.groupName.toLowerCase().includes(q)
        || d.uniqueId.toLowerCase().includes(q)
        || d.statusLabel.toLowerCase().includes(q)
      );
    }

    return result;
  }, [fleetData, activeFilter, searchTerm]);

  // Top 5 vehículos en movimiento con mayor velocidad
  const topSpeedDevices = useMemo(() => {
    return fleetData
      .filter((d) => d.telemetryStatus === 'moving')
      .sort((a, b) => b.speedKmh - a.speedKmh)
      .slice(0, 5);
  }, [fleetData]);

  // Navegar al mapa centrando el vehículo seleccionado
  const handleLocateDevice = (deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/');
  };

  // Exportar reporte ejecutivo a Excel
  const handleExportExcel = () => {
    if (!fleetData.length) return;

    const dataToExport = filteredFleet.map((item, index) => ({
      'N°': index + 1,
      'Vehículo / Placa': item.name,
      'Identificador (IMEI)': item.uniqueId,
      'Grupo / Flota': item.groupName,
      'Estado Operativo': item.statusLabel,
      'Velocidad (km/h)': item.speedKmh,
      'Ignición (Motor)': item.ignition ? 'ENCENDIDO' : 'APAGADO',
      'Batería Interna (%)': item.batteryPercent != null ? `${item.batteryPercent}%` : 'N/D',
      'Voltaje Batería (V)': item.powerVolts != null ? `${item.powerVolts} V` : 'N/D',
      'Odómetro Acumulado (km)': item.totalDistanceMeters ? (item.totalDistanceMeters / 1000).toFixed(2) : '0',
      'Última Transmisión': item.lastTimestamp ? formatTime(item.lastTimestamp, 'minutes', hours12) : 'Sin datos',
      'Dirección / Coordenadas': item.address || (item.latitude ? `Lat: ${item.latitude}, Lng: ${item.longitude}` : 'Sin ubicación'),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dashboard Flota');

    worksheet['!cols'] = [
      { wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
      { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 45 },
    ];

    const filename = `Dashboard_Ejecutivo_Flota_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'Dashboard Ejecutivo de Flota']}>
      <div className={classes.container}>
        {/* Cabecera Ejecutiva */}
        <Box className={classes.headerBox}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
              <SpeedIcon fontSize="large" /> Dashboard Ejecutivo de Flota
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Control en tiempo real de disponibilidad, marcha, ralentí, energía y alertas operativas.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Tooltip title="Actualizar datos ahora">
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => setRefreshKey((k) => k + 1)}
              >
                Actualizar
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportExcel}
              disabled={filteredFleet.length === 0}
            >
              Exportar Excel XLSX
            </Button>
          </Box>
        </Box>

        {/* Tarjetas KPI Superiores (Haga clic para filtrar la tabla) */}
        <Grid container spacing={2}>
          {/* Total Flota */}
          <Grid item xs={12} sm={6} md={2}>
            <Card
              className={`${classes.kpiCard} ${activeFilter === 'all' ? classes.kpiCardActive : ''}`}
              onClick={() => setActiveFilter('all')}
              sx={{ backgroundColor: '#f8fafc', borderLeft: '5px solid #3b82f6' }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569' }}>
                    TOTAL FLOTA
                  </Typography>
                  <DirectionsCarIcon sx={{ color: '#3b82f6', fontSize: 28 }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, my: 0.5 }}>
                  {stats.total}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  100% unidades registradas
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* En Movimiento */}
          <Grid item xs={12} sm={6} md={2}>
            <Card
              className={`${classes.kpiCard} ${activeFilter === 'moving' ? classes.kpiCardActive : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'moving' ? 'all' : 'moving')}
              sx={{ backgroundColor: '#ecfdf5', borderLeft: '5px solid #10b981' }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#065f46' }}>
                    EN MOVIMIENTO
                  </Typography>
                  <SpeedIcon sx={{ color: '#10b981', fontSize: 28 }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#047857', my: 0.5 }}>
                  {stats.moving}
                </Typography>
                <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>
                  {stats.movingPct}% de la flota activa
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* En Ralentí */}
          <Grid item xs={12} sm={6} md={2}>
            <Card
              className={`${classes.kpiCard} ${activeFilter === 'idling' ? classes.kpiCardActive : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'idling' ? 'all' : 'idling')}
              sx={{ backgroundColor: '#f0f9ff', borderLeft: '5px solid #0ea5e9' }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#0369a1' }}>
                    EN RALENTÍ
                  </Typography>
                  <LocalGasStationIcon sx={{ color: '#0ea5e9', fontSize: 28 }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#0284c7', my: 0.5 }}>
                  {stats.idling}
                </Typography>
                <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
                  {stats.idlingPct}% motor ON parado
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Estacionados */}
          <Grid item xs={12} sm={6} md={2}>
            <Card
              className={`${classes.kpiCard} ${activeFilter === 'parked' ? classes.kpiCardActive : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'parked' ? 'all' : 'parked')}
              sx={{ backgroundColor: '#f1f5f9', borderLeft: '5px solid #64748b' }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>
                    ESTACIONADOS
                  </Typography>
                  <PauseCircleFilledIcon sx={{ color: '#64748b', fontSize: 28 }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#475569', my: 0.5 }}>
                  {stats.parked}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  {stats.parkedPct}% motor apagado
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Sin Señal */}
          <Grid item xs={12} sm={6} md={2}>
            <Card
              className={`${classes.kpiCard} ${activeFilter === 'offline' ? classes.kpiCardActive : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'offline' ? 'all' : 'offline')}
              sx={{ backgroundColor: '#fef2f2', borderLeft: '5px solid #ef4444' }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#991b1b' }}>
                    SIN SEÑAL (&gt;24H)
                  </Typography>
                  <SignalWifiOffIcon sx={{ color: '#ef4444', fontSize: 28 }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#dc2626', my: 0.5 }}>
                  {stats.offline}
                </Typography>
                <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 600 }}>
                  {stats.offlinePct}% desconectados
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Batería Baja / Corte */}
          <Grid item xs={12} sm={6} md={2}>
            <Card
              className={`${classes.kpiCard} ${activeFilter === 'lowBattery' ? classes.kpiCardActive : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'lowBattery' ? 'all' : 'lowBattery')}
              sx={{ backgroundColor: '#fffbeb', borderLeft: '5px solid #f59e0b' }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#92400e' }}>
                    ALERTA ENERGÍA
                  </Typography>
                  <BatteryAlertIcon sx={{ color: '#f59e0b', fontSize: 28 }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#d97706', my: 0.5 }}>
                  {stats.lowBattery}
                </Typography>
                <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 600 }}>
                  Batería &le; 20% / Corte
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Barra de Distribución de Salud de la Flota */}
        <Paper elevation={1} sx={{ p: 2, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
              DISTRIBUCIÓN OPERATIVA DE LA FLOTA EN TIEMPO REAL
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981' }} />
                <Typography variant="caption">En Ruta ({stats.movingPct}%)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#0ea5e9' }} />
                <Typography variant="caption">Ralentí ({stats.idlingPct}%)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#64748b' }} />
                <Typography variant="caption">Estacionado ({stats.parkedPct}%)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <Typography variant="caption">Sin Señal ({stats.offlinePct}%)</Typography>
              </Box>
            </Box>
          </Box>
          <div className={classes.distributionBar}>
            {stats.movingPct > 0 && (
              <Tooltip title={`En Ruta: ${stats.moving} vehículos (${stats.movingPct}%)`}>
                <div style={{ width: `${stats.movingPct}%`, backgroundColor: '#10b981' }} />
              </Tooltip>
            )}
            {stats.idlingPct > 0 && (
              <Tooltip title={`En Ralentí: ${stats.idling} vehículos (${stats.idlingPct}%)`}>
                <div style={{ width: `${stats.idlingPct}%`, backgroundColor: '#0ea5e9' }} />
              </Tooltip>
            )}
            {stats.parkedPct > 0 && (
              <Tooltip title={`Estacionados: ${stats.parked} vehículos (${stats.parkedPct}%)`}>
                <div style={{ width: `${stats.parkedPct}%`, backgroundColor: '#64748b' }} />
              </Tooltip>
            )}
            {stats.offlinePct > 0 && (
              <Tooltip title={`Sin Señal: ${stats.offline} vehículos (${stats.offlinePct}%)`}>
                <div style={{ width: `${stats.offlinePct}%`, backgroundColor: '#ef4444' }} />
              </Tooltip>
            )}
          </div>
        </Paper>

        {/* Paneles Intermedios: Top Velocidad y Alertas en Vivo */}
        <Grid container spacing={2}>
          {/* Top Unidades en Ruta / Velocidad */}
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SpeedIcon color="success" /> Top Unidades en Ruta (Mayor Velocidad)
                </Typography>
                <Chip size="small" label={`${topSpeedDevices.length} en movimiento`} color="success" variant="outlined" />
              </Box>
              {topSpeedDevices.length === 0 ? (
                <Typography variant="body2" color="textSecondary" sx={{ py: 3, textAlign: 'center' }}>
                  No hay unidades circulando en este momento.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Placa / Vehículo</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Grupo</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">Velocidad</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Acción</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topSpeedDevices.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell sx={{ fontWeight: 'bold' }}>{item.name}</TableCell>
                        <TableCell>{item.groupName}</TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={`${item.speedKmh} km/h`}
                            sx={{
                              backgroundColor: item.speedKmh > 90 ? '#fef2f2' : item.speedKmh > 60 ? '#fefce8' : '#ecfdf5',
                              color: item.speedKmh > 90 ? '#dc2626' : item.speedKmh > 60 ? '#ca8a04' : '#059669',
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Localizar en Mapa Principal">
                            <IconButton size="small" color="primary" onClick={() => handleLocateDevice(item.id)}>
                              <MapIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </Grid>

          {/* Alertas y Notificaciones en Tiempo Real */}
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NotificationsActiveIcon color="warning" /> Feed de Eventos y Alertas en Vivo
                </Typography>
                <Chip size="small" label={`${eventsList.length} eventos`} color="warning" variant="outlined" />
              </Box>
              {eventsList.length === 0 ? (
                <Typography variant="body2" color="textSecondary" sx={{ py: 3, textAlign: 'center' }}>
                  No se han registrado eventos recientes en esta sesión.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Hora</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Vehículo</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Tipo de Alerta</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Acción</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {eventsList.slice(0, 5).map((ev) => {
                      const dev = devicesMap[ev.deviceId];
                      return (
                        <TableRow key={ev.id || `${ev.deviceId}_${ev.eventTime}`} hover>
                          <TableCell sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {formatTime(ev.eventTime, 'time', hours12)}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{dev?.name || `ID ${ev.deviceId}`}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={t(`event${ev.type.charAt(0).toUpperCase() + ev.type.slice(1)}`) || ev.type}
                              color={ev.type === 'alarm' ? 'error' : ev.type.includes('geofence') ? 'info' : 'default'}
                              variant="outlined"
                              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Ver en Mapa">
                              <IconButton size="small" color="primary" onClick={() => handleLocateDevice(ev.deviceId)}>
                                <MapIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Tabla Ejecutiva Completa de la Flota */}
        <Card className={classes.tableCard} elevation={2}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Buscar por placa, grupo o estado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ width: { xs: '100%', sm: 300 }, backgroundColor: '#ffffff' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              {activeFilter !== 'all' && (
                <Chip
                  label={`Filtro: ${activeFilter.toUpperCase()}`}
                  onDelete={() => setActiveFilter('all')}
                  color="primary"
                  size="small"
                />
              )}
            </Box>
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
              Mostrando {filteredFleet.length} de {fleetData.length} vehículos
            </Typography>
          </Box>

          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Estado Operativo</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Vehículo / Placa</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Grupo / Flota</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">Velocidad</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">Ignición</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">Batería / Energía</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Último Reporte</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredFleet.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'textSecondary' }}>
                      No se encontraron vehículos que coincidan con los criterios de búsqueda o filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFleet.map((row) => (
                    <TableRow key={row.id} hover>
                      {/* Estado */}
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.statusLabel}
                          sx={{
                            backgroundColor: `${row.statusColor}15`,
                            color: row.statusColor,
                            border: `1px solid ${row.statusColor}50`,
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        />
                      </TableCell>

                      {/* Nombre / Placa */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                          {row.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          {row.uniqueId}
                        </Typography>
                      </TableCell>

                      {/* Grupo */}
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#475569' }}>
                          {row.groupName}
                        </Typography>
                      </TableCell>

                      {/* Velocidad */}
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: row.speedKmh > 0 ? 'bold' : 'normal',
                            color: row.speedKmh > 80 ? '#dc2626' : row.speedKmh > 0 ? '#059669' : '#64748b',
                          }}
                        >
                          {row.speedKmh} km/h
                        </Typography>
                      </TableCell>

                      {/* Ignición */}
                      <TableCell align="center">
                        {row.ignition ? (
                          <Chip size="small" label="ON" color="success" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }} />
                        ) : (
                          <Chip size="small" label="OFF" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', color: '#94a3b8' }} />
                        )}
                      </TableCell>

                      {/* Batería / Voltaje */}
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          {row.hasLowBattery ? (
                            <Tooltip title="Batería baja o corte de energía externa">
                              <BatteryAlertIcon color="warning" fontSize="small" />
                            </Tooltip>
                          ) : (
                            <BatteryChargingFullIcon color="action" fontSize="small" />
                          )}
                          <Typography variant="body2" sx={{ fontWeight: row.hasLowBattery ? 'bold' : 'normal', color: row.hasLowBattery ? '#d97706' : 'text.primary' }}>
                            {row.batteryPercent != null ? `${row.batteryPercent}%` : row.powerVolts != null ? `${row.powerVolts}V` : 'N/D'}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Último Reporte */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {row.lastTimestamp ? formatTime(row.lastTimestamp, 'minutes', hours12) : 'Sin transmisión'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: row.diffHours > 24 ? '#ef4444' : '#64748b' }}>
                          {row.diffHours < 1
                            ? 'Hace minutos'
                            : row.diffHours < 24
                              ? `Hace ${Math.floor(row.diffHours)} horas`
                              : `Hace ${Math.floor(row.diffHours / 24)} días`}
                        </Typography>
                      </TableCell>

                      {/* Botón Acción */}
                      <TableCell align="center">
                        <Tooltip title="Ver en Mapa en Vivo">
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<MapIcon />}
                            onClick={() => handleLocateDevice(row.id)}
                            sx={{ textTransform: 'none', py: 0.3, px: 1, fontSize: '0.75rem' }}
                          >
                            Localizar
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </div>
    </PageLayout>
  );
};

export default DashboardPage;
