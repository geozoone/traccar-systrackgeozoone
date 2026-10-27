import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Container,
    TextField,
    Button,
    Box,
    Paper,
    Chip,
    Alert,
    CircularProgress,
    Divider,
    IconButton,
    Tooltip,
    Grid,
    FormControlLabel,
    Switch,
    InputAdornment,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Card,
    CardContent,
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SmsIcon from '@mui/icons-material/Sms';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SaveIcon from '@mui/icons-material/Save';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CloudIcon from '@mui/icons-material/Cloud';
import HttpIcon from '@mui/icons-material/Http';
import SimCardIcon from '@mui/icons-material/SimCard';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SettingsMenu from '../../settings/components/SettingsMenu';
import PageLayout from '../../common/components/PageLayout';
import { useAdministrator } from '../../common/util/permissions';

const useStyles = makeStyles((theme) => ({
    container: {
        marginTop: theme.spacing(3),
        marginBottom: theme.spacing(4),
    },
    headerCard: {
        padding: theme.spacing(3),
        borderRadius: 16,
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: theme.spacing(2),
        boxShadow: '0 8px 24px rgba(17, 153, 142, 0.25)',
        marginBottom: theme.spacing(3),
    },
    sectionCard: {
        padding: theme.spacing(3),
        borderRadius: 12,
        marginBottom: theme.spacing(3),
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
    },
    providerCard: {
        border: '2px solid transparent',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        },
    },
    providerCardSelected: {
        borderColor: '#11998e',
        backgroundColor: '#f0fdf4',
    },
    telemetryBox: {
        background: 'linear-gradient(135deg, #f0fdf4 0%, #e8f5e9 100%)',
        border: '1px solid #c3edd7',
        borderRadius: 12,
        padding: theme.spacing(2.5),
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2),
    },
    instructionsBox: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: theme.spacing(2),
        marginBottom: theme.spacing(2),
    },
    urlBox: {
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: 6,
        padding: '8px 12px',
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        wordBreak: 'break-all',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
}));

const SmsConfig = () => {
    const classes = useStyles();
    const currentUser = useSelector((state) => state.session.user);
    const admin = useAdministrator();

    const revendaKey = admin ? 'global' : (currentUser?.id ? String(currentUser.id) : null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);

    // Form State
    const [enabled, setEnabled] = useState(false);
    const [provider, setProvider] = useState('android'); // 'android' | 'twilio' | 'legacy'
    const [gatewayName, setGatewayName] = useState('Celular Android Oficina');

    // Android SMS Gateway credentials
    const [androidUsername, setAndroidUsername] = useState('');
    const [androidPassword, setAndroidPassword] = useState('');
    const [showAndroidPass, setShowAndroidPass] = useState(false);
    const [androidServer, setAndroidServer] = useState('https://api.sms-gate.app');

    // Twilio credentials
    const [twilioSid, setTwilioSid] = useState('');
    const [twilioToken, setTwilioToken] = useState('');
    const [showTwilioToken, setShowTwilioToken] = useState(false);
    const [twilioFrom, setTwilioFrom] = useState('');

    // Test send
    const [testTo, setTestTo] = useState(currentUser?.phone || '+51981005971');
    const [testMessage, setTestMessage] = useState('🚨 Alerta de prueba GeoZoone GPS: Pasarela SMS conectada y transmitiendo exitosamente.');
    const [sendingTest, setSendingTest] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const serverOrigin = window.location.origin;
    const gatewayUrl = `${serverOrigin}/modulo/sms/poll/${revendaKey || 'global'}`;

    const initialLoadedRef = useRef(false);

    const fetchConfig = async (forceFormSync = false) => {
        if (!revendaKey) {
            setLoading(false);
            return;
        }
        if (!initialLoadedRef.current) {
            setLoading(true);
        }
        try {
            const resp = await fetch(`/modulo/sms/config/${revendaKey}`);
            const text = await resp.text();
            let data = {};
            try {
                data = JSON.parse(text);
            } catch {
                data = {};
            }

            if (data && data.configured) {
                // Siempre actualizamos telemetría en vivo e historial
                setConfig(data);

                // Solo sincronizamos los campos editables si es carga inicial o después de guardar
                if (!initialLoadedRef.current || forceFormSync) {
                    initialLoadedRef.current = true;
                    setEnabled(Boolean(data.enabled));
                    setProvider(data.provider || 'android');
                    setGatewayName(data.gatewayName || 'Celular Android');
                    setAndroidUsername(data.androidUsername || '');
                    setAndroidPassword(data.androidPassword || '');
                    setAndroidServer(data.androidServer || 'https://api.sms-gate.app');
                    setTwilioSid(data.twilioSid || '');
                    setTwilioToken(data.twilioToken || '');
                    setTwilioFrom(data.twilioFrom || '');
                }
            }
        } catch (err) {
            console.error('Error cargando pasarela SMS:', err);
            if (!initialLoadedRef.current) {
                setStatusMsg({ type: 'error', text: `Error cargando pasarela SMS: ${err.message}` });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        initialLoadedRef.current = false;
        fetchConfig(true);
        // El intervalo de fondo solo consulta telemetría y NO sobreescribe lo que el usuario está escribiendo
        const interval = setInterval(() => {
            fetchConfig(false);
        }, 15000);
        return () => clearInterval(interval);
    }, [revendaKey]);

    const handleSave = async (e) => {
        e?.preventDefault();
        setSaving(true);
        setStatusMsg(null);
        try {
            const resp = await fetch(`/modulo/sms/config/${revendaKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled,
                    provider,
                    gatewayName: gatewayName.trim(),
                    androidUsername: androidUsername.trim(),
                    androidPassword: androidPassword.trim(),
                    androidServer: androidServer.trim(),
                    twilioSid: twilioSid.trim(),
                    twilioToken: twilioToken.trim(),
                    twilioFrom: twilioFrom.trim(),
                }),
            });
            const data = await resp.json();
            if (resp.ok) {
                setStatusMsg({ type: 'success', text: 'Configuración guardada exitosamente.' });
                await fetchConfig(true); // Sincroniza explícitamente tras guardar
            } else {
                throw new Error(data.error || 'Error al guardar');
            }
        } catch (err) {
            setStatusMsg({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleSendTest = async (e) => {
        e?.preventDefault();
        if (!testTo.trim()) {
            setTestResult({ ok: false, error: 'Ingresa un número de celular de destino (ej. +51981005971).' });
            return;
        }
        setSendingTest(true);
        setTestResult(null);
        try {
            const resp = await fetch(`/modulo/sms/test/${revendaKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testTo.trim(),
                    message: testMessage.trim(),
                }),
            });
            const text = await resp.text();
            let data = {};
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error(text);
            }

            if (resp.ok && data.status === 'ok') {
                setTestResult({
                    ok: true,
                    message: data.message || `¡SMS #${data.id} enviado exitosamente hacia ${data.recipient}!`,
                });
                await fetchConfig();
            } else {
                setTestResult({ ok: false, error: data.error || 'Fallo al enviar SMS de prueba' });
            }
        } catch (err) {
            setTestResult({ ok: false, error: err.message });
        } finally {
            setSendingTest(false);
        }
    };

    const isOnline = config?.status === 'online';
    const isAuthError = config?.status === 'auth_error';

    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'Pasarela SMS']}>
            <Container maxWidth="lg" className={classes.container}>
                {/* Header Banner */}
                <Paper className={classes.headerCard} elevation={3}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <PhoneAndroidIcon style={{ fontSize: 44, color: '#fff' }} />
                        <Box>
                            <Typography variant="h5" fontWeight={700}>
                                Pasarela SMS Multi-Proveedor
                            </Typography>
                            <Typography variant="body2" style={{ opacity: 0.9 }}>
                                {admin
                                    ? 'Canal SMS Central de la Matriz'
                                    : `Pasarela SMS Exclusiva para Revendedor #${revendaKey}`}
                            </Typography>
                        </Box>
                    </Box>

                    <Box display="flex" alignItems="center" gap={1}>
                        {loading ? (
                            <CircularProgress size={24} style={{ color: '#fff' }} />
                        ) : isOnline ? (
                            <Chip
                                icon={<CheckCircleIcon style={{ color: '#fff' }} />}
                                label="Dispositivo En Línea 🟢"
                                style={{ backgroundColor: '#2e7d32', color: '#fff', fontWeight: 600 }}
                            />
                        ) : isAuthError ? (
                            <Chip
                                icon={<ErrorOutlineIcon style={{ color: '#fff' }} />}
                                label="Error de Usuario/Clave ⚠️"
                                style={{ backgroundColor: '#ed6c02', color: '#fff', fontWeight: 600 }}
                            />
                        ) : (
                            <Chip
                                label={config?.androidUsername ? "Desconectado 🔴" : "Sin Configurar ⏸️"}
                                style={{ backgroundColor: '#757575', color: '#fff', fontWeight: 600 }}
                            />
                        )}
                        <IconButton onClick={fetchConfig} style={{ color: '#fff' }} size="small">
                            <Tooltip title="Actualizar estado en vivo">
                                <RefreshIcon />
                            </Tooltip>
                        </IconButton>
                    </Box>
                </Paper>

                {statusMsg && (
                    <Alert
                        severity={statusMsg.type}
                        onClose={() => setStatusMsg(null)}
                        style={{ marginBottom: 24, borderRadius: 8 }}
                    >
                        {statusMsg.text}
                    </Alert>
                )}

                {/* Selector de Tipo de Pasarela */}
                <Paper className={classes.sectionCard} elevation={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <SmsIcon color="primary" />
                            <Typography variant="h6" fontWeight={600}>
                                Tipo de Pasarela SMS
                            </Typography>
                        </Box>
                    </Box>

                    <Typography variant="body2" color="textSecondary" paragraph>
                        Selecciona el método de envío para las alertas críticas de tu flota. Puedes usar un teléfono celular Android propio con chip de SMS ilimitados (costo S/ 0) o un servicio API en la nube como Twilio.
                    </Typography>

                    <Grid container spacing={2} mb={3}>
                        {/* Opción 1: Celular Android */}
                        <Grid item xs={12} md={4}>
                            <Card
                                className={`${classes.providerCard} ${provider === 'android' ? classes.providerCardSelected : ''}`}
                                onClick={() => setProvider('android')}
                                elevation={provider === 'android' ? 3 : 1}
                            >
                                <CardContent>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                                        <PhoneAndroidIcon color={provider === 'android' ? 'primary' : 'action'} />
                                        <Typography variant="subtitle1" fontWeight={700}>
                                            Celular Android
                                        </Typography>
                                    </Box>
                                    <Chip label="Recomendado • Costo S/ 0" size="small" color="success" style={{ marginBottom: 8, fontWeight: 600 }} />
                                    <Typography variant="body2" color="textSecondary">
                                        Conecta cualquier celular Android con chip SIM ilimitado (Entel, Claro, Movistar) mediante la app SMS Gateway.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Opción 2: Twilio Cloud */}
                        <Grid item xs={12} md={4}>
                            <Card
                                className={`${classes.providerCard} ${provider === 'twilio' ? classes.providerCardSelected : ''}`}
                                onClick={() => setProvider('twilio')}
                                elevation={provider === 'twilio' ? 3 : 1}
                            >
                                <CardContent>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                                        <CloudIcon color={provider === 'twilio' ? 'primary' : 'action'} />
                                        <Typography variant="subtitle1" fontWeight={700}>
                                            Twilio Cloud SMS
                                        </Typography>
                                    </Box>
                                    <Chip label="API de Pago por Mensaje" size="small" color="default" style={{ marginBottom: 8 }} />
                                    <Typography variant="body2" color="textSecondary">
                                        Envío masivo corporativo mediante cuenta propia de Twilio. Requiere Account SID y Auth Token.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Opción 3: Polling / Legacy */}
                        <Grid item xs={12} md={4}>
                            <Card
                                className={`${classes.providerCard} ${provider === 'legacy' ? classes.providerCardSelected : ''}`}
                                onClick={() => setProvider('legacy')}
                                elevation={provider === 'legacy' ? 3 : 1}
                            >
                                <CardContent>
                                    <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                                        <HttpIcon color={provider === 'legacy' ? 'primary' : 'action'} />
                                        <Typography variant="subtitle1" fontWeight={700}>
                                            Sondeo HTTP / Polling
                                        </Typography>
                                    </Box>
                                    <Chip label="Avanzado / Webhook" size="small" color="default" style={{ marginBottom: 8 }} />
                                    <Typography variant="body2" color="textSecondary">
                                        Para bots o scripts personalizados (MacroDroid, Tasker) que leen la cola mediante peticiones GET periódicas.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    <Divider style={{ margin: '24px 0' }} />

                    {/* Formulario según proveedor */}
                    <form onSubmit={handleSave}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={enabled}
                                            onChange={(e) => setEnabled(e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Typography variant="body1" fontWeight={600}>
                                            Habilitar Notificaciones por SMS
                                        </Typography>
                                    }
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Nombre Descriptivo de la Pasarela"
                                    placeholder="Moto G04 - Claro Oficina"
                                    value={gatewayName}
                                    onChange={(e) => setGatewayName(e.target.value)}
                                    disabled={saving}
                                />
                            </Grid>

                            {/* CAMPOS PARA CELULAR ANDROID */}
                            {provider === 'android' && (
                                <>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            required
                                            label="Usuario de la App (Username / Login)"
                                            placeholder="ej. WT2G01"
                                            value={androidUsername}
                                            onChange={(e) => setAndroidUsername(e.target.value)}
                                            disabled={saving}
                                            helperText="Aparece en la pantalla de la app SMS Gateway bajo Cloud Server"
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            required
                                            type={showAndroidPass ? 'text' : 'password'}
                                            label="Contraseña de la App (Password)"
                                            placeholder="••••••••••••"
                                            value={androidPassword}
                                            onChange={(e) => setAndroidPassword(e.target.value)}
                                            disabled={saving}
                                            helperText="Contraseña generada por la app al registrar el dispositivo"
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowAndroidPass(!showAndroidPass)}
                                                            edge="end"
                                                            size="small"
                                                        >
                                                            {showAndroidPass ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                    </Grid>

                                    {/* Telemetría en Vivo si está en línea */}
                                    {config?.status === 'online' && (
                                        <Grid item xs={12}>
                                            <Box className={classes.telemetryBox}>
                                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                                    <CheckCircleIcon color="success" />
                                                    <Typography variant="subtitle1" fontWeight={700} color="success.dark">
                                                        Celular Sincronizado y Transmitiendo en Vivo
                                                    </Typography>
                                                </Box>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} sm={3}>
                                                        <Typography variant="caption" color="textSecondary">📱 Teléfono Detectado</Typography>
                                                        <Typography variant="body2" fontWeight={600}>{config.phoneModel || 'Motorola Android'}</Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={3}>
                                                        <Typography variant="caption" color="textSecondary">📶 Operador SIM</Typography>
                                                        <Typography variant="body2" fontWeight={600} display="flex" alignItems="center" gap={0.5}>
                                                            <SignalCellularAltIcon fontSize="small" color="primary" />
                                                            {config.carrierName || 'Claro / Móvil'}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={3}>
                                                        <Typography variant="caption" color="textSecondary">⏰ Último Latido</Typography>
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {config.lastSeen ? new Date(config.lastSeen).toLocaleTimeString() : 'Hace instantes'}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={3}>
                                                        <Typography variant="caption" color="textSecondary">📨 Total SMS Enviados</Typography>
                                                        <Typography variant="body2" fontWeight={600}>{config.totalSent || 0} SMS</Typography>
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        </Grid>
                                    )}
                                </>
                            )}

                            {/* CAMPOS PARA TWILIO */}
                            {provider === 'twilio' && (
                                <>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            required
                                            label="Twilio Account SID"
                                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                            value={twilioSid}
                                            onChange={(e) => setTwilioSid(e.target.value)}
                                            disabled={saving}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            required
                                            type={showTwilioToken ? 'text' : 'password'}
                                            label="Twilio Auth Token"
                                            placeholder="••••••••••••••••••••••••••••••••"
                                            value={twilioToken}
                                            onChange={(e) => setTwilioToken(e.target.value)}
                                            disabled={saving}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowTwilioToken(!showTwilioToken)}
                                                            edge="end"
                                                            size="small"
                                                        >
                                                            {showTwilioToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            required
                                            label="Número Remitente Twilio (From)"
                                            placeholder="+1234567890"
                                            value={twilioFrom}
                                            onChange={(e) => setTwilioFrom(e.target.value)}
                                            disabled={saving}
                                            helperText="Número telefónico comprado en tu cuenta de Twilio"
                                        />
                                    </Grid>
                                </>
                            )}

                            {/* CAMPOS PARA SONDEO HTTP / LEGACY */}
                            {provider === 'legacy' && (
                                <>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="caption" color="textSecondary" fontWeight={600}>
                                            URL DE SONDEO (GET):
                                        </Typography>
                                        <Box className={classes.urlBox} mt={0.5}>
                                            <span>{gatewayUrl}</span>
                                            <Tooltip title="Copiar URL">
                                                <IconButton size="small" onClick={() => navigator.clipboard.writeText(gatewayUrl)}>
                                                    <ContentCopyIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="caption" color="textSecondary" fontWeight={600}>
                                            TOKEN DE SEGURIDAD:
                                        </Typography>
                                        <Box className={classes.urlBox} mt={0.5}>
                                            <span>{config?.token || '••••••••••••••••••••'}</span>
                                            <Tooltip title="Copiar Token">
                                                <IconButton size="small" onClick={() => navigator.clipboard.writeText(config?.token || '')}>
                                                    <ContentCopyIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Grid>
                                </>
                            )}

                            <Grid item xs={12}>
                                <Box display="flex" justifyContent="flex-end">
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        color="primary"
                                        size="large"
                                        startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                        disabled={saving}
                                        style={{ minWidth: 200, borderRadius: 8, fontWeight: 700 }}
                                    >
                                        {saving ? 'Guardando...' : 'Guardar Pasarela SMS'}
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </form>
                </Paper>

                {/* Prueba de Envío en Caliente */}
                <Paper className={classes.sectionCard} elevation={2}>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <SendIcon color="primary" />
                        <Typography variant="h6" fontWeight={600}>
                            Prueba de Transmisión SMS en Caliente
                        </Typography>
                    </Box>

                    <Typography variant="body2" color="textSecondary" paragraph>
                        Envía un mensaje de prueba en tiempo real para verificar que el chip de tu celular o tu cuenta despache el SMS hacia el número indicado.
                    </Typography>

                    <form onSubmit={handleSendTest}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    label="Número Móvil de Destino"
                                    placeholder="+51981005971"
                                    value={testTo}
                                    onChange={(e) => setTestTo(e.target.value)}
                                    disabled={sendingTest}
                                    helperText="Incluye código de país (ej. +51 para Perú)"
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Mensaje de Prueba"
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    disabled={sendingTest}
                                    multiline
                                    rows={1}
                                />
                            </Grid>

                            <Grid item xs={12} sm={2}>
                                <Button
                                    fullWidth
                                    type="submit"
                                    variant="outlined"
                                    color="primary"
                                    size="large"
                                    disabled={sendingTest || !enabled}
                                    startIcon={sendingTest ? <CircularProgress size={18} /> : <SendIcon />}
                                    style={{ height: 54, borderRadius: 8, fontWeight: 600 }}
                                >
                                    {sendingTest ? 'Enviando...' : 'Enviar SMS'}
                                </Button>
                            </Grid>
                        </Grid>
                    </form>

                    {testResult && (
                        <Box mt={2}>
                            <Alert
                                severity={testResult.ok ? 'success' : 'error'}
                                onClose={() => setTestResult(null)}
                                style={{ borderRadius: 8 }}
                            >
                                {testResult.ok ? testResult.message : `Error al enviar: ${testResult.error}`}
                            </Alert>
                        </Box>
                    )}
                </Paper>

                {/* Historial de Envíos */}
                <Paper className={classes.sectionCard} elevation={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6" fontWeight={600}>
                            Historial Reciente de Alertas SMS Despachadas
                        </Typography>
                        <Chip
                            label={`Total: ${config?.totalSent || 0} mensajes`}
                            color="primary"
                            variant="outlined"
                            size="small"
                        />
                    </Box>

                    {config?.history && config.history.length > 0 ? (
                        <TableContainer style={{ maxHeight: 320 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Fecha / Hora</TableCell>
                                        <TableCell>Destinatario</TableCell>
                                        <TableCell>Proveedor</TableCell>
                                        <TableCell>Mensaje</TableCell>
                                        <TableCell align="center">Estado</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {config.history.map((h, idx) => (
                                        <TableRow key={h.id || idx} hover>
                                            <TableCell style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                {h.createdAt ? new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                                            </TableCell>
                                            <TableCell style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                {h.to}
                                            </TableCell>
                                            <TableCell style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>
                                                {h.provider || 'Android'}
                                            </TableCell>
                                            <TableCell style={{ fontSize: '0.85rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {h.message}
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    size="small"
                                                    label={h.status === 'failed' ? 'Error' : 'Entregado'}
                                                    color={h.status === 'failed' ? 'error' : 'success'}
                                                    style={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Typography variant="body2" color="textSecondary" align="center" style={{ padding: 24 }}>
                            Aún no hay mensajes en el historial. Realiza una prueba o espera las alertas de la flota.
                        </Typography>
                    )}
                </Paper>

                {/* Guía Paso a Paso */}
                <Accordion className={classes.sectionCard} elevation={1}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <HelpOutlineIcon color="info" />
                            <Typography variant="subtitle1" fontWeight={600}>
                                Guía Rápida: ¿Cómo conectar tu Celular Android en 2 minutos?
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box className={classes.instructionsBox}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                📲 Paso 1: Instalar SMS Gateway en el Celular
                            </Typography>
                            <Typography variant="body2" paragraph>
                                En tu celular Android (con chip SIM de SMS ilimitados), descarga e instala la aplicación <strong>SMS Gateway</strong> (disponible en GitHub o APK directo). Concede los permisos de SMS y desactiva la optimización de batería.
                            </Typography>

                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                ⚡ Paso 2: Activar Cloud Server y Registrar
                            </Typography>
                            <Typography variant="body2" paragraph>
                                Abre la aplicación:<br />
                                1. Activa la opción <strong>Cloud Server (ON)</strong>.<br />
                                2. Toca <strong>Start Service</strong> $\rightarrow$ selecciona <strong>Sign Up</strong>.<br />
                                3. El botón cambiará a <strong>Online (Verde)</strong> y verás en pantalla tu <strong>Username</strong> y <strong>Password</strong>.
                            </Typography>

                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                🔑 Paso 3: Pegar Credenciales en GeoZoone
                            </Typography>
                            <Typography variant="body2" paragraph>
                                Pega ese <strong>Usuario</strong> y <strong>Contraseña</strong> en los campos de arriba y pulsa <strong>Guardar</strong>. Tu celular quedará vinculado y las alertas de tu empresa saldrán directamente por tu chip móvil.
                            </Typography>

                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                🛡️ Aislamiento Estricto de Marca
                            </Typography>
                            <Typography variant="body2">
                                Cada revendedor tiene su propia pasarela con su chip independiente. Tus clientes recibirán el SMS en cualquier teléfono convencional sin que nadie conozca el número de la matriz ni de otros revendedores.
                            </Typography>
                        </Box>
                    </AccordionDetails>
                </Accordion>
            </Container>
        </PageLayout>
    );
};

export default SmsConfig;
