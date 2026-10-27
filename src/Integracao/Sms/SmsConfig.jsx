import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SmsIcon from '@mui/icons-material/Sms';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SaveIcon from '@mui/icons-material/Save';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CleanHandsIcon from '@mui/icons-material/CleaningServices';
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
    instructionsBox: {
        background: '#f4fbf7',
        border: '1px solid #c3edd7',
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

    // Form
    const [enabled, setEnabled] = useState(false);
    const [gatewayName, setGatewayName] = useState('Celular Android Oficina');
    const [showToken, setShowToken] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedToken, setCopiedToken] = useState(false);

    // Test send
    const [testTo, setTestTo] = useState(currentUser?.phone || '');
    const [testMessage, setTestMessage] = useState('🚨 Alerta de prueba GeoZoone: Pasarela SMS Android conectada exitosamente.');
    const [sendingTest, setSendingTest] = useState(false);
    const [testResult, setTestResult] = useState(null);

    // Base URL for Android phone to connect
    const serverOrigin = window.location.origin;
    const gatewayUrl = `${serverOrigin}/modulo/sms/poll/${revendaKey || 'global'}`;

    const fetchConfig = async () => {
        if (!revendaKey) {
            setLoading(false);
            return;
        }
        setLoading(true);
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
                setConfig(data);
                setEnabled(Boolean(data.enabled));
                setGatewayName(data.gatewayName || 'Celular Android');
            }
        } catch (err) {
            console.error('Error cargando pasarela SMS:', err);
            setStatusMsg({ type: 'error', text: `Error cargando pasarela SMS: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        const interval = setInterval(fetchConfig, 10000); // Polling status every 10s
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
                    gatewayName: gatewayName.trim(),
                }),
            });
            const data = await resp.json();
            if (resp.ok) {
                setStatusMsg({ type: 'success', text: 'Configuración guardada exitosamente.' });
                await fetchConfig();
            } else {
                throw new Error(data.error || 'Error al guardar');
            }
        } catch (err) {
            setStatusMsg({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerateToken = async () => {
        if (!window.confirm('¿Deseas generar un nuevo Token de Seguridad? Deberás actualizar el token en la app de tu celular Android.')) {
            return;
        }
        setSaving(true);
        try {
            const resp = await fetch(`/modulo/sms/config/${revendaKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regenerateToken: true }),
            });
            if (resp.ok) {
                setStatusMsg({ type: 'info', text: 'Nuevo token generado correctamente.' });
                await fetchConfig();
            }
        } catch (err) {
            setStatusMsg({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleClearQueue = async () => {
        try {
            const resp = await fetch(`/modulo/sms/clear-queue/${revendaKey}`, { method: 'POST' });
            if (resp.ok) {
                setStatusMsg({ type: 'info', text: 'Cola de mensajes SMS limpiada.' });
                await fetchConfig();
            }
        } catch (err) {}
    };

    const handleSendTest = async (e) => {
        e?.preventDefault();
        if (!testTo.trim()) {
            setTestResult({ ok: false, error: 'Ingresa un número de celular de destino.' });
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
                    message: `¡Mensaje #${data.id} puesto en cola con éxito! Tu celular Android lo retirará y enviará al número +${data.recipient}.`,
                });
                await fetchConfig();
            } else {
                setTestResult({ ok: false, error: data.error || 'Fallo al poner en cola' });
            }
        } catch (err) {
            setTestResult({ ok: false, error: err.message });
        } finally {
            setSendingTest(false);
        }
    };

    const copyToClipboard = (text, type) => {
        navigator.clipboard.writeText(text);
        if (type === 'url') {
            setCopiedUrl(true);
            setTimeout(() => setCopiedUrl(false), 2000);
        } else {
            setCopiedToken(true);
            setTimeout(() => setCopiedToken(false), 2000);
        }
    };

    const isOnline = config?.status === 'online';

    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'Pasarela SMS']}>
            <Container maxWidth="lg" className={classes.container}>
                {/* Header Banner */}
                <Paper className={classes.headerCard} elevation={3}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <PhoneAndroidIcon style={{ fontSize: 44, color: '#fff' }} />
                        <Box>
                            <Typography variant="h5" fontWeight={700}>
                                Pasarela SMS Android Gateway (Opción C)
                            </Typography>
                            <Typography variant="body2" style={{ opacity: 0.9 }}>
                                {admin
                                    ? 'Canal SMS Central de la Matriz (Dispositivo Local)'
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
                                label="Celular En Línea 🟢"
                                style={{ backgroundColor: '#2e7d32', color: '#fff', fontWeight: 600 }}
                            />
                        ) : (
                            <Chip
                                label={config?.lastSeen ? "Celular Desconectado 🔴" : "Nunca Conectado ⏸️"}
                                style={{ backgroundColor: '#d32f2f', color: '#fff', fontWeight: 600 }}
                            />
                        )}
                        <IconButton onClick={fetchConfig} style={{ color: '#fff' }} size="small">
                            <Tooltip title="Actualizar estado">
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

                {/* Configuración y Credenciales del Gateway */}
                <Paper className={classes.sectionCard} elevation={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <SmsIcon color="primary" />
                            <Typography variant="h6" fontWeight={600}>
                                Configuración de Conexión del Teléfono Android
                            </Typography>
                        </Box>
                    </Box>

                    <Typography variant="body2" color="textSecondary" paragraph>
                        Con la <strong>Opción C</strong>, puedes utilizar cualquier celular Android económico con un chip
                        prepago o postpago (con plan de SMS ilimitados) ubicado en tu oficina o casa. El celular se conectará
                        a esta URL y despachará las alertas críticas de tu flota por SMS celular tradicional hacia los teléfonos
                        de tus clientes, sin requerir saldo en plataformas costosas de terceros.
                    </Typography>

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
                                            Habilitar Despacho por SMS Celular Android
                                        </Typography>
                                    }
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Identificador / Nombre del Teléfono"
                                    placeholder="Redmi Note 10 - Oficina"
                                    value={gatewayName}
                                    onChange={(e) => setGatewayName(e.target.value)}
                                    disabled={saving}
                                    helperText="Nombre descriptivo para identificar el equipo"
                                />
                            </Grid>

                            {/* URL para copiar */}
                            <Grid item xs={12} sm={6}>
                                <Typography variant="caption" color="textSecondary" fontWeight={600}>
                                    URL DEL SERVIDOR GATEWAY (Copiar en la app del celular):
                                </Typography>
                                <Box className={classes.urlBox} mt={0.5}>
                                    <span>{gatewayUrl}</span>
                                    <Tooltip title={copiedUrl ? "¡Copiado!" : "Copiar URL"}>
                                        <IconButton size="small" onClick={() => copyToClipboard(gatewayUrl, 'url')}>
                                            <ContentCopyIcon fontSize="small" color={copiedUrl ? "primary" : "inherit"} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Grid>

                            {/* Token para copiar */}
                            <Grid item xs={12} sm={6}>
                                <Typography variant="caption" color="textSecondary" fontWeight={600}>
                                    TOKEN DE SEGURIDAD / API KEY:
                                </Typography>
                                <Box className={classes.urlBox} mt={0.5}>
                                    <span>{showToken ? config?.token : '••••••••••••••••••••'}</span>
                                    <Box display="flex" alignItems="center">
                                        <IconButton size="small" onClick={() => setShowToken(!showToken)}>
                                            {showToken ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                        </IconButton>
                                        <Tooltip title={copiedToken ? "¡Copiado!" : "Copiar Token"}>
                                            <IconButton size="small" onClick={() => copyToClipboard(config?.token || '', 'token')}>
                                                <ContentCopyIcon fontSize="small" color={copiedToken ? "primary" : "inherit"} />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Regenerar Token Secreto">
                                            <IconButton size="small" onClick={handleRegenerateToken}>
                                                <AutorenewIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                            </Grid>

                            {/* Telemetría del teléfono si está conectado */}
                            {config?.lastSeen && (
                                <Grid item xs={12}>
                                    <Box display="flex" gap={2} flexWrap="wrap" p={1.5} bgcolor="#f8f9fa" borderRadius={2} alignItems="center">
                                        <Typography variant="body2">
                                            📶 <strong>Última Sincronización:</strong> {new Date(config.lastSeen).toLocaleTimeString()}
                                        </Typography>
                                        {config.phoneModel && (
                                            <Typography variant="body2">
                                                📱 <strong>Modelo:</strong> {config.phoneModel}
                                            </Typography>
                                        )}
                                        {config.batteryLevel !== null && config.batteryLevel !== undefined && (
                                            <Typography variant="body2" display="flex" alignItems="center" gap={0.5}>
                                                <BatteryChargingFullIcon fontSize="small" color="success" />
                                                <strong>Batería:</strong> {config.batteryLevel}%
                                            </Typography>
                                        )}
                                        <Typography variant="body2">
                                            📨 <strong>Total Enviados:</strong> {config.totalSent || 0} SMS
                                        </Typography>
                                        <Typography variant="body2">
                                            ⏳ <strong>En Cola Pendientes:</strong> {config.pendingCount || 0}
                                        </Typography>
                                    </Box>
                                </Grid>
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

                {/* Envío de Prueba Diagnóstica */}
                <Paper className={classes.sectionCard} elevation={2}>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <SendIcon color="secondary" />
                        <Typography variant="h6" fontWeight={600}>
                            Prueba de Despacho de SMS en Vivo
                        </Typography>
                    </Box>

                    <Typography variant="body2" color="textSecondary" paragraph>
                        Envía un mensaje de prueba para comprobar que tu celular Android retira la alerta de la cola del
                        servidor y la envía inmediatamente por la tarjeta SIM física.
                    </Typography>

                    {testResult && (
                        <Alert
                            severity={testResult.ok ? 'success' : 'error'}
                            onClose={() => setTestResult(null)}
                            style={{ marginBottom: 16, borderRadius: 8 }}
                        >
                            {testResult.ok ? testResult.message : `Fallo al encolar: ${testResult.error}`}
                        </Alert>
                    )}

                    <form onSubmit={handleSendTest}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    label="Número Receptor"
                                    placeholder="+51999888777"
                                    value={testTo}
                                    onChange={(e) => setTestTo(e.target.value)}
                                    required
                                    disabled={sendingTest}
                                    helperText="Incluye código de país (ej: 51987654321)"
                                />
                            </Grid>
                            <Grid item xs={12} sm={5}>
                                <TextField
                                    fullWidth
                                    label="Texto del Mensaje"
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    required
                                    disabled={sendingTest}
                                    helperText="Máximo 160 caracteres estándar GSM"
                                />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="secondary"
                                    size="large"
                                    fullWidth
                                    startIcon={sendingTest ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                                    disabled={sendingTest}
                                    style={{ height: 54, borderRadius: 8, fontWeight: 700 }}
                                >
                                    {sendingTest ? 'Encolando...' : 'Enviar SMS Prueba'}
                                </Button>
                            </Grid>
                        </Grid>
                    </form>
                </Paper>

                {/* Bitácora y Cola de Mensajes */}
                <Paper className={classes.sectionCard} elevation={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6" fontWeight={600}>
                            Historial y Cola de Mensajes Recientes ({config?.pendingCount || 0} pendientes)
                        </Typography>
                        <Box display="flex" gap={1}>
                            {config?.pendingCount > 0 && (
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    size="small"
                                    startIcon={<CleanHandsIcon />}
                                    onClick={handleClearQueue}
                                >
                                    Limpiar Cola
                                </Button>
                            )}
                            <IconButton size="small" onClick={fetchConfig}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>

                    {config?.history && config.history.length > 0 ? (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell><strong>Hora</strong></TableCell>
                                        <TableCell><strong>Destinatario</strong></TableCell>
                                        <TableCell><strong>Mensaje</strong></TableCell>
                                        <TableCell align="center"><strong>Estado</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {config.history.map((h, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{h.sentAt ? new Date(h.sentAt).toLocaleTimeString() : '-'}</TableCell>
                                            <TableCell>+{h.to}</TableCell>
                                            <TableCell style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {h.message}
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    size="small"
                                                    label={h.status === 'sent' ? 'Enviado por SIM' : h.status}
                                                    color={h.status === 'sent' ? 'success' : 'default'}
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
                                Guía Paso a Paso: ¿Cómo conectar tu Celular Android?
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box className={classes.instructionsBox}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                📲 Paso 1: Dispositivo y Chip
                            </Typography>
                            <Typography variant="body2" paragraph>
                                Consigue cualquier teléfono Android (versión 6.0 o superior) y colócale un chip móvil con plan
                                de SMS ilimitados (Entel, Claro, Movistar, Bitel u operador de tu país). Conéctalo al Wi-Fi de tu oficina.
                            </Typography>

                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                📥 Paso 2: Instalar la Aplicación Gateway
                            </Typography>
                            <Typography variant="body2" paragraph>
                                Puedes usar la app oficial y gratuita <strong>Traccar SMS Gateway</strong> (disponible en F-Droid, Google Play o APK directo de Traccar) o apps equivalentes de SMS Gateway HTTP.
                            </Typography>

                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                ⚙️ Paso 3: Configurar URL y Token
                            </Typography>
                            <Typography variant="body2" paragraph>
                                Abre la aplicación en tu celular:<br />
                                - En el campo <strong>Server URL / Servicio</strong>, pega la URL de conexión que aparece arriba.<br />
                                - En el campo <strong>API Key / Token</strong>, pega tu token secreto.<br />
                                - Activa la casilla de sondeo (Polling) cada 3 a 5 segundos.<br />
                                - Concede los permisos de <strong>SMS</strong> y desactiva la "optimización de batería" para que la app no se apague al bloquear la pantalla.
                            </Typography>

                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                🛡️ Aislamiento Estricto de Marca
                            </Typography>
                            <Typography variant="body2">
                                Todas las alertas de tus vehículos saldrán exclusivamente a través del chip celular de tu empresa. Tus clientes recibirán el SMS en cualquier teléfono convencional sin necesidad de internet.
                            </Typography>
                        </Box>
                    </AccordionDetails>
                </Accordion>
            </Container>
        </PageLayout>
    );
};

export default SmsConfig;
