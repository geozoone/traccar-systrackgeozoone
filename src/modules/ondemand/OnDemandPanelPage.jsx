import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PageLayout from '../../common/components/PageLayout';
import SettingsMenu from '../../settings/components/SettingsMenu';
import { useAdministrator, useRevenda } from '../../common/util/permissions';
import { formatTime } from '../../common/util/formatter';
import GeoZooneErrorBoundary from '../core/GeoZooneErrorBoundary';

const PLAN_OPTIONS = [
  { code: '2H', label: 'Flete Express — 2 horas (S/ 3.00)' },
  { code: '6H', label: 'Media Jornada — 6 horas (S/ 5.00)' },
  { code: '24H', label: 'Día Completo — 24 horas (S/ 10.00)' },
  { code: '72H', label: 'Viaje Provincia — 72 horas (S/ 20.00)' },
];

const STATUS_META = {
  pending_payment: { label: '⏳ Yape Pendiente', color: 'warning' },
  active: { label: '🟢 En Ruta (Activo)', color: 'success' },
  expired: { label: '⚪ Expirado', color: 'default' },
  stopped: { label: '🛑 Finalizado', color: 'default' },
  activating: { label: '🔄 Activando', color: 'info' },
};

const OnDemandPanelContent = () => {
  const isAdmin = useAdministrator();
  const isRevenda = useRevenda();

  const [tab, setTab] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtros
  const [sessionFilter, setSessionFilter] = useState('all');
  const [voucherFilter, setVoucherFilter] = useState('available');

  // Generador de PINes
  const [genPlan, setGenPlan] = useState('2H');
  const [genQty, setGenQty] = useState(5);
  const [genLoading, setGenLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState([]);

  // Estado de aprobación y copiado
  const [approvingId, setApprovingId] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sessRes, vouchRes] = await Promise.all([
        fetch('/modulo/ondemand/sessions', { headers: { Accept: 'application/json' } }),
        fetch('/modulo/ondemand/vouchers', { headers: { Accept: 'application/json' } }),
      ]);

      if (!sessRes.ok) {
        const errJ = await sessRes.json().catch(() => ({}));
        throw new Error(errJ.error || `Error cargando viajes (${sessRes.status})`);
      }
      if (!vouchRes.ok) {
        const errJ = await vouchRes.json().catch(() => ({}));
        throw new Error(errJ.error || `Error cargando PINes (${vouchRes.status})`);
      }

      const sessData = await sessRes.json();
      const vouchData = await vouchRes.json();
      setSessions(Array.isArray(sessData.sessions) ? sessData.sessions : []);
      setVouchers(Array.isArray(vouchData.vouchers) ? vouchData.vouchers : []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el módulo GeoZoone Ruta');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin || isRevenda) {
      loadData();
    }
  }, [isAdmin, isRevenda, loadData]);

  if (!isAdmin && !isRevenda) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Acceso restringido: El panel de Fletes Prepago (GeoZoone Ruta) está disponible solo para Administradores y Revendedores.
        </Alert>
      </Box>
    );
  }

  const copyText = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleGenerateVouchers = async (e) => {
    e.preventDefault();
    setGenLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const resp = await fetch('/modulo/ondemand/vouchers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ planCode: genPlan, quantity: Number(genQty) || 1 }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || `Error generando PINes (${resp.status})`);
      }
      setLastGenerated(data.codes || []);
      setSuccessMsg(`Se generaron ${data.quantity} código(s) PIN del plan ${genPlan}.`);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleApproveYape = async (sessionId, plate) => {
    setApprovingId(sessionId);
    setError('');
    setSuccessMsg('');
    try {
      const resp = await fetch(`/modulo/ondemand/approve/${sessionId}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || `No se pudo aprobar la solicitud (${resp.status})`);
      }
      setSuccessMsg(`✔ Viaje de ${plate} activado. Enlace enviado por WhatsApp: ${data.shareUrl}`);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const buildLiveUrl = (s) => {
    if (!s.share_token) return '';
    const base = (s.base_url || window.location.origin).replace(/\/$/, '');
    return `${base}/live/${s.share_token}`;
  };

  const sendVoucherWhatsApp = (v) => {
    const hours = Math.round((Number(v.duration_minutes) || 120) / 60);
    const msg =
      `🎟️ *Código PIN Prepago — GeoZoone Ruta*\n` +
      `• Código: *${v.code}*\n` +
      `• Duración: *${hours} horas* (Plan ${v.plan_code})\n\n` +
      `Abre tu app *GeoZoone Ruta*, selecciona "Tengo un Código PIN" e ingresa este código para activar tu rastreo en vivo.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const sendLiveLinkWhatsApp = (s) => {
    const url = buildLiveUrl(s);
    if (!url) return;
    const cleanPhone = String(s.phone || '').replace(/[^0-9]/g, '');
    const msg =
      `🚚 *GeoZoone Ruta — Rastreo Activo*\n` +
      `• Placa: *${s.plate}*\n` +
      `• Enlace en vivo para compartir con tu cliente:\n${url}`;
    const target = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const formatDateSafe = (val) => {
    if (!val) return '—';
    try {
      return formatTime(val, 'minutes');
    } catch {
      return new Date(val).toLocaleString('es-PE');
    }
  };

  // KPIs
  const activeCount = sessions.filter((s) => s.status === 'active').length;
  const pendingCount = sessions.filter((s) => s.status === 'pending_payment').length;
  const availableVouchers = vouchers.filter((v) => v.status === 'available').length;
  const usedVouchers = vouchers.filter((v) => v.status === 'used').length;

  const filteredSessions = sessions.filter((s) => {
    if (sessionFilter === 'all') return true;
    if (sessionFilter === 'finished') return s.status === 'expired' || s.status === 'stopped';
    return s.status === sessionFilter;
  });

  const filteredVouchers = vouchers.filter((v) => {
    if (voucherFilter === 'all') return true;
    return v.status === voucherFilter;
  });

  return (
    <Box p={3}>
      {/* Cabecera */}
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={2.5}>
        <Box>
          <Typography variant="h5" fontWeight="bold" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShippingIcon fontSize="large" />
            GeoZoone Ruta — Fletes Prepago & PINes
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Genera códigos PIN prepago para transportistas eventuales, aprueba pagos Yape/Plin en 1 clic y monitorea enlaces en vivo.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={loadData}
          disabled={loading}
        >
          Actualizar
        </Button>
      </Box>

      {/* Tarjetas KPI */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}>
          <Card elevation={2} sx={{ borderTop: '4px solid #16a34a', cursor: 'pointer' }} onClick={() => { setTab(0); setSessionFilter('active'); }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold">VIAJES ACTIVOS</Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">{activeCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={2} sx={{ borderTop: '4px solid #f59e0b', cursor: 'pointer' }} onClick={() => { setTab(0); setSessionFilter('pending_payment'); }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold">YAPE PENDIENTES</Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main">{pendingCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={2} sx={{ borderTop: '4px solid #0284c7', cursor: 'pointer' }} onClick={() => { setTab(1); setVoucherFilter('available'); }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold">PINES DISPONIBLES</Typography>
              <Typography variant="h4" fontWeight="bold" color="primary.main">{availableVouchers}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card elevation={2} sx={{ borderTop: '4px solid #64748b', cursor: 'pointer' }} onClick={() => { setTab(1); setVoucherFilter('used'); }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold">PINES CANJEADOS</Typography>
              <Typography variant="h4" fontWeight="bold" color="text.secondary">{usedVouchers}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

      {/* Pestañas */}
      <Paper elevation={1} sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} indicatorColor="primary" textColor="primary">
          <Tab icon={<LocalShippingIcon />} iconPosition="start" label={`Viajes y Pagos Yape (${sessions.length})`} />
          <Tab icon={<ConfirmationNumberIcon />} iconPosition="start" label={`Códigos PIN Prepago (${vouchers.length})`} />
        </Tabs>
      </Paper>

      {/* PESTAÑA 0: VIAJES Y APROBACIONES YAPE */}
      {tab === 0 && (
        <Paper elevation={2} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
            {[
              { id: 'all', label: `Todos (${sessions.length})` },
              { id: 'pending_payment', label: `⏳ Yape Pendiente (${pendingCount})` },
              { id: 'active', label: `🟢 En Ruta (${activeCount})` },
              { id: 'finished', label: 'Finalizados / Expirados' },
            ].map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                color={sessionFilter === f.id ? 'primary' : 'default'}
                variant={sessionFilter === f.id ? 'filled' : 'outlined'}
                onClick={() => setSessionFilter(f.id)}
              />
            ))}
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><b>Placa / Chofer</b></TableCell>
                  <TableCell><b>Celular</b></TableCell>
                  <TableCell><b>Plan / Monto</b></TableCell>
                  <TableCell><b>Pago / Ref</b></TableCell>
                  <TableCell><b>Estado</b></TableCell>
                  <TableCell><b>Vence / Últ. Ping</b></TableCell>
                  <TableCell align="right"><b>Acciones</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No hay viajes registrados con este filtro todavía.
                    </TableCell>
                  </TableRow>
                ) : filteredSessions.map((s) => {
                  const meta = STATUS_META[s.status] || { label: s.status, color: 'default' };
                  const liveUrl = buildLiveUrl(s);
                  return (
                    <TableRow key={s.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">{s.plate}</Typography>
                        <Typography variant="caption" color="textSecondary">{s.driver_name || 'Sin nombre'}</Typography>
                      </TableCell>
                      <TableCell>{s.phone}</TableCell>
                      <TableCell>
                        <Chip size="small" label={s.plan_code} variant="outlined" sx={{ mr: 0.5, fontWeight: 'bold' }} />
                        <Typography variant="caption">S/ {Number(s.price_pen || 0).toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" display="block" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                          {s.payment_method}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ fontFamily: 'monospace' }}>
                          {s.voucher_code || s.payment_ref || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={meta.label} color={meta.color} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" display="block">
                          Vence: <b>{formatDateSafe(s.expires_at)}</b>
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Ping: {formatDateSafe(s.last_ping_at)}
                          {s.last_battery != null ? ` • 🔋 ${s.last_battery}%` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {s.status === 'pending_payment' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={approvingId === s.id ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                            disabled={approvingId === s.id}
                            onClick={() => handleApproveYape(s.id, s.plate)}
                          >
                            Aprobar Yape
                          </Button>
                        )}
                        {s.status === 'active' && liveUrl && (
                          <Box display="inline-flex" gap={0.5}>
                            <Tooltip title="Abrir visor en vivo">
                              <IconButton size="small" color="primary" component="a" href={liveUrl} target="_blank" rel="noopener noreferrer">
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={copiedKey === `live-${s.id}` ? '¡Enlace copiado!' : 'Copiar enlace /live'}>
                              <IconButton size="small" onClick={() => copyText(liveUrl, `live-${s.id}`)}>
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reenviar enlace al chofer por WhatsApp">
                              <IconButton size="small" color="success" onClick={() => sendLiveLinkWhatsApp(s)}>
                                <WhatsAppIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* PESTAÑA 1: GENERADOR Y STOCK DE PINES PREPAGO */}
      {tab === 1 && (
        <Box>
          <Paper elevation={2} sx={{ p: 2, mb: 2.5, backgroundColor: '#f8fafc' }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              🎟️ Generar Nuevo Lote de Códigos PIN Prepago
            </Typography>
            <form onSubmit={handleGenerateVouchers}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={5}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Paquete de Tiempo"
                    value={genPlan}
                    onChange={(e) => setGenPlan(e.target.value)}
                  >
                    {PLAN_OPTIONS.map((opt) => (
                      <MenuItem key={opt.code} value={opt.code}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField
                    type="number"
                    fullWidth
                    size="small"
                    label="Cantidad"
                    inputProps={{ min: 1, max: 100 }}
                    value={genQty}
                    onChange={(e) => setGenQty(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6} sm={3} md={3}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    startIcon={genLoading ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineIcon />}
                    disabled={genLoading}
                  >
                    {genLoading ? 'Generando...' : 'Generar PINes'}
                  </Button>
                </Grid>
              </Grid>
            </form>

            {lastGenerated.length > 0 && (
              <Box mt={2} p={1.5} sx={{ bgcolor: '#ecfdf5', border: '1px solid #86efac', borderRadius: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" fontWeight="bold" color="success.dark">
                    ÚLTIMOS PINES GENERADOS ({lastGenerated.length}):
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => copyText(lastGenerated.join('\n'), 'batch-codes')}
                  >
                    {copiedKey === 'batch-codes' ? '¡Lote Copiado!' : 'Copiar Todos'}
                  </Button>
                </Box>
                <Box display="flex" flexWrap="wrap" gap={0.8}>
                  {lastGenerated.map((code) => (
                    <Chip
                      key={code}
                      label={code}
                      size="small"
                      color="success"
                      variant="outlined"
                      onClick={() => copyText(code, `gen-${code}`)}
                      sx={{ fontFamily: 'monospace', fontWeight: 'bold', bgcolor: '#fff' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          <Paper elevation={2} sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} mb={2}>
              {[
                { id: 'available', label: `🟢 Disponibles (${availableVouchers})` },
                { id: 'used', label: `⚪ Canjeados (${usedVouchers})` },
                { id: 'all', label: `Todos (${vouchers.length})` },
              ].map((f) => (
                <Chip
                  key={f.id}
                  label={f.label}
                  color={voucherFilter === f.id ? 'primary' : 'default'}
                  variant={voucherFilter === f.id ? 'filled' : 'outlined'}
                  onClick={() => setVoucherFilter(f.id)}
                />
              ))}
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><b>Código PIN</b></TableCell>
                    <TableCell><b>Plan / Precio</b></TableCell>
                    <TableCell><b>Estado</b></TableCell>
                    <TableCell><b>Placa Usada</b></TableCell>
                    <TableCell><b>Fecha Creación / Uso</b></TableCell>
                    <TableCell align="right"><b>Acciones</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredVouchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No hay códigos PIN en esta categoría. Genera tu primer lote arriba.
                      </TableCell>
                    </TableRow>
                  ) : filteredVouchers.map((v) => (
                    <TableRow key={v.id} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {v.code}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={v.plan_code} variant="outlined" sx={{ mr: 0.5 }} />
                        <Typography variant="caption">S/ {Number(v.price_pen || 0).toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={v.status === 'available' ? '🟢 Disponible' : '⚪ Usado'}
                          color={v.status === 'available' ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{v.used_by_plate || '—'}</TableCell>
                      <TableCell>
                        <Typography variant="caption" display="block">Creado: {formatDateSafe(v.created_at)}</Typography>
                        {v.used_at && <Typography variant="caption" color="textSecondary">Usado: {formatDateSafe(v.used_at)}</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={copiedKey === `v-${v.id}` ? '¡PIN Copiado!' : 'Copiar PIN'}>
                          <IconButton size="small" onClick={() => copyText(v.code, `v-${v.id}`)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {v.status === 'available' && (
                          <Tooltip title="Enviar PIN por WhatsApp">
                            <IconButton size="small" color="success" onClick={() => sendVoucherWhatsApp(v)}>
                              <WhatsAppIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

const OnDemandPanelPage = () => (
  <PageLayout menu={<SettingsMenu />} breadcrumbs={['Configuración', 'GeoZoone Ruta (Prepago)']}>
    <GeoZooneErrorBoundary fallbackTitle="Error cargando el panel GeoZoone Ruta">
      <OnDemandPanelContent />
    </GeoZooneErrorBoundary>
  </PageLayout>
);

export default OnDemandPanelPage;

