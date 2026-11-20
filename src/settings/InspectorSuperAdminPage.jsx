import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneIcon from '@mui/icons-material/Phone';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAdministrator } from '../common/util/permissions';
import { formatTime } from '../common/util/formatter';

const InspectorSuperAdminPage = () => {
  const navigate = useNavigate();
  const isAdmin = useAdministrator();

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  if (!isAdmin) {
    return (
      <PageLayout menu={<SettingsMenu />} breadcrumbs={['Configuración', 'Inspector Telemático']}>
        <Box p={3}>
          <Alert severity="error">
            Acceso restringido: Esta herramienta de auditoría forense está disponible exclusivamente para el Superadministrador.
          </Alert>
        </Box>
      </PageLayout>
    );
  }

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const clean = searchQuery.trim();
    if (!clean) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const response = await fetch(`/modulo/admin/inspector/lookup?q=${encodeURIComponent(clean)}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Error del servidor (${response.status})`);
      }

      const data = await response.json();
      setSearchResult(data);
    } catch (err) {
      console.error('Error al consultar inspector:', err);
      setError(err.message || 'Error de conexión con el conector');
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatFecha = (isoDate) => {
    if (!isoDate) return 'Sin registros';
    try {
      return formatTime(isoDate, 'seconds');
    } catch {
      return new Date(isoDate).toLocaleString('es-PE');
    }
  };

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['Configuración', 'Inspector Telemático SuperAdmin']}>
      <Box p={3}>
        {/* Cabecera del Inspector */}
        <Box mb={3}>
          <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsInputAntennaIcon fontSize="large" />
            Inspector Telemático & Rastreo de Dispositivos (SuperAdmin)
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Identificación inmediata de vehículos, propietarios, revendedores y telemetría por <b>IMEI</b>, <b>Placa</b> o <b>Teléfono SIM</b>. 
            Permite detectar si una trama entrante pertenece a un cliente o a un equipo zombie / no dado de alta.
          </Typography>
        </Box>

        {/* Barra de Búsqueda */}
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <form onSubmit={handleSearch}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={8} md={9}>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  label="Buscar por IMEI, Placa o Teléfono SIM"
                  placeholder="Ej: 862894020120864, 865413056106023, F4Y265, 915140492"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="medium"
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                >
                  {loading ? 'Consultando...' : 'Inspeccionar'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>

        {/* Mensaje de Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Caso: No Encontrado (Equipo Zombie / Desconocido) */}
        {searched && !loading && searchResult && !searchResult.found && (
          <Card sx={{ border: '2px dashed #f44336', backgroundColor: '#fff5f5', mb: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <WarningAmberIcon sx={{ fontSize: 40, color: '#d32f2f' }} />
                <Box>
                  <Typography variant="h6" color="error" fontWeight="bold">
                    Dispositivo NO Registrado en la Base de Datos
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    El término buscado <b>"{searchResult.query}"</b> no existe en ningún cliente, grupo ni revendedor.
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="body2">
                <b>Diagnóstico Telemático:</b>
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                • Si este IMEI aparece emitiendo en los logs de puertos (ej. 5005, 5021, 5027, 5093), se trata de un <b>Equipo Zombie</b> (GPS activo apuntando al servidor sin cuenta asignada).<br />
                • Para adoptarlo y capturar sus coordenadas en el mapa, puedes darlo de alta en Traccar con este IMEI y asignarlo a una empresa.
              </Typography>
              <Box mt={2}>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => navigate('/settings/device')}
                >
                  + Registrar este Dispositivo Ahora
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Caso: Resultados Encontrados */}
        {searched && !loading && searchResult && searchResult.found && (
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
              Coincidencias encontradas ({searchResult.count}):
            </Typography>

            {searchResult.results.map((item, index) => {
              const { device, cliente, revendedor, telemetria } = item;
              const isOnline = device.status === 'online';

              return (
                <Card key={device.id || index} elevation={3} sx={{ mb: 3, borderLeft: '6px solid #1976d2' }}>
                  <CardContent>
                    {/* Encabezado del Vehículo */}
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1} mb={2}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <DirectionsCarIcon color="primary" sx={{ fontSize: 32 }} />
                        <Box>
                          <Typography variant="h6" fontWeight="bold">
                            {device.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            ID Traccar: #{device.id} • Categoría: {device.category} • Grupo: <b>{device.group}</b>
                          </Typography>
                        </Box>
                      </Box>
                      <Box display="flex" gap={1} alignItems="center">
                        <Chip
                          label={isOnline ? '🟢 En Línea' : '🔴 Desconectado'}
                          color={isOnline ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                        {device.disabled && (
                          <Chip label="🚫 Vehículo Deshabilitado" color="error" size="small" />
                        )}
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<MyLocationIcon />}
                          onClick={() => navigate(`/?deviceId=${device.id}`)}
                        >
                          Ver en Mapa
                        </Button>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    {/* Bloques de Datos: Hardware, Cliente y Telemetría */}
                    <Grid container spacing={2}>
                      {/* 1. Datos Técnicos de Hardware */}
                      <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 1.5, height: '100%', backgroundColor: '#fcfcfc' }}>
                          <Typography variant="subtitle2" color="primary" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <SettingsInputAntennaIcon fontSize="small" /> Hardware & Conexión
                          </Typography>
                          <Box mt={1} fontSize="0.875rem">
                            <Box display="flex" justifyContent="space-between" alignItems="center" py={0.5}>
                              <span style={{ color: '#666' }}>IMEI:</span>
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <b style={{ fontFamily: 'monospace' }}>{device.imei}</b>
                                <Tooltip title={copiedKey === `imei-${device.id}` ? '¡Copiado!' : 'Copiar IMEI'}>
                                  <IconButton size="small" onClick={() => copyToClipboard(device.imei, `imei-${device.id}`)}>
                                    <ContentCopyIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                            <Box display="flex" justifyContent="space-between" py={0.5}>
                              <span style={{ color: '#666' }}>Modelo GPS:</span>
                              <span>{device.model || 'No especificado'}</span>
                            </Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center" py={0.5}>
                              <span style={{ color: '#666' }}>Chip SIM:</span>
                              <span>{device.sim || 'Sin registrar'}</span>
                            </Box>
                            <Box display="flex" justifyContent="space-between" py={0.5}>
                              <span style={{ color: '#666' }}>Último Latido Red:</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                {formatFecha(device.lastUpdate)}
                              </span>
                            </Box>
                          </Box>
                        </Paper>
                      </Grid>

                      {/* 2. Propietario / Cliente y Revendedor */}
                      <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 1.5, height: '100%', backgroundColor: '#fcfcfc' }}>
                          <Typography variant="subtitle2" color="secondary" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PersonIcon fontSize="small" /> Dueño & Cuenta
                          </Typography>
                          <Box mt={1} fontSize="0.875rem">
                            {cliente ? (
                              <>
                                <Box py={0.5}>
                                  <span style={{ color: '#666' }}>Cliente / Empresa:</span>
                                  <div style={{ fontWeight: 'bold' }}>{cliente.empresa || cliente.name}</div>
                                </Box>
                                <Box py={0.5}>
                                  <span style={{ color: '#666' }}>Correo:</span>
                                  <div style={{ wordBreak: 'break-all' }}>{cliente.email}</div>
                                </Box>
                                <Box display="flex" justifyContent="space-between" alignItems="center" py={0.5}>
                                  <span style={{ color: '#666' }}>Contacto:</span>
                                  {cliente.phone ? (
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                      <span>{cliente.phone}</span>
                                      <IconButton
                                        size="small"
                                        color="success"
                                        component="a"
                                        href={`https://wa.me/${cliente.phone.replace(/[^0-9]/g, '')}`}
                                        target="_blank"
                                      >
                                        <WhatsAppIcon fontSize="inherit" />
                                      </IconButton>
                                    </Box>
                                  ) : (
                                    <span>Sin teléfono</span>
                                  )}
                                </Box>
                                <Box display="flex" justifyContent="space-between" py={0.5}>
                                  <span style={{ color: '#666' }}>Estado Cuenta:</span>
                                  <Chip
                                    label={cliente.disabled ? '🔴 Suspendido' : '🟢 Activo'}
                                    size="small"
                                    color={cliente.disabled ? 'error' : 'success'}
                                  />
                                </Box>
                              </>
                            ) : (
                              <Alert severity="warning" sx={{ py: 0.5, px: 1, fontSize: '0.8rem' }}>
                                Sin usuario titular asignado en tc_user_device
                              </Alert>
                            )}

                            {revendedor && (
                              <Box mt={1} pt={1} borderTop="1px dashed #ccc">
                                <Box display="flex" alignItems="center" gap={0.5} color="textSecondary" fontSize="0.75rem">
                                  <StorefrontIcon fontSize="inherit" />
                                  <span>Revendedor: <b>{revendedor.name}</b> ({revendedor.email})</span>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      </Grid>

                      {/* 3. Última Telemetría y Coordenadas */}
                      <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 1.5, height: '100%', backgroundColor: '#fcfcfc' }}>
                          <Typography variant="subtitle2" color="textPrimary" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <MyLocationIcon fontSize="small" /> Última Posición
                          </Typography>
                          <Box mt={1} fontSize="0.875rem">
                            {telemetria ? (
                              <>
                                <Box display="flex" justifyContent="space-between" py={0.5}>
                                  <span style={{ color: '#666' }}>Fecha GPS:</span>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                    {formatFecha(telemetria.fixTime)}
                                  </span>
                                </Box>
                                <Box display="flex" justifyContent="space-between" py={0.5}>
                                  <span style={{ color: '#666' }}>Velocidad / Motor:</span>
                                  <span>
                                    <b>{telemetria.speedKm} km/h</b> • {telemetria.ignition ? '🔥 Motor ON' : '⚪ Motor OFF'}
                                  </span>
                                </Box>
                                <Box display="flex" justifyContent="space-between" py={0.5}>
                                  <span style={{ color: '#666' }}>Protocolo:</span>
                                  <Chip label={telemetria.protocol || 'Desconocido'} size="small" variant="outlined" />
                                </Box>
                                <Box py={0.5}>
                                  <span style={{ color: '#666' }}>Coordenadas:</span>
                                  <div style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                    {telemetria.latitude?.toFixed(5)}, {telemetria.longitude?.toFixed(5)}
                                  </div>
                                </Box>
                                {telemetria.address && (
                                  <Box py={0.5}>
                                    <span style={{ color: '#666' }}>Dirección:</span>
                                    <div style={{ fontSize: '0.75rem', color: '#333' }}>
                                      {telemetria.address}
                                    </div>
                                  </Box>
                                )}
                              </>
                            ) : (
                              <Typography variant="body2" color="textSecondary" sx={{ py: 1 }}>
                                No hay posiciones registradas en la tabla tc_positions para esta unidad.
                              </Typography>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>
    </PageLayout>
  );
};

export default InspectorSuperAdminPage;

