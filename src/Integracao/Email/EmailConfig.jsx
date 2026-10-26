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
    ButtonGroup,
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SaveIcon from '@mui/icons-material/Save';
import DnsIcon from '@mui/icons-material/Dns';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
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
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: theme.spacing(2),
        boxShadow: '0 8px 24px rgba(30, 60, 114, 0.25)',
        marginBottom: theme.spacing(3),
    },
    sectionCard: {
        padding: theme.spacing(3),
        borderRadius: 12,
        marginBottom: theme.spacing(3),
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
    },
    instructionsBox: {
        background: '#f4f9fd',
        border: '1px solid #c8e1f5',
        borderRadius: 8,
        padding: theme.spacing(2),
        marginBottom: theme.spacing(2),
    },
    presetButton: {
        textTransform: 'none',
        fontWeight: 600,
    },
}));

const EmailConfig = () => {
    const classes = useStyles();
    const currentUser = useSelector((state) => state.session.user);
    const admin = useAdministrator();

    const revendaKey = admin ? 'global' : (currentUser?.id ? String(currentUser.id) : null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);

    // Form fields
    const [host, setHost] = useState('');
    const [port, setPort] = useState('465');
    const [secure, setSecure] = useState(true);
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [fromName, setFromName] = useState('');
    const [fromEmail, setFromEmail] = useState('');

    // Test send state
    const [testTo, setTestTo] = useState(currentUser?.email || '');
    const [sendingTest, setSendingTest] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const fetchConfig = async () => {
        if (!revendaKey) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setStatusMsg(null);
        try {
            const resp = await fetch(`/modulo/email/config/${revendaKey}`);
            const text = await resp.text();
            let data = {};
            try {
                data = JSON.parse(text);
            } catch {
                console.warn('Respuesta no JSON de /modulo/email/config:', text);
                data = { configured: false };
            }

            if (data && data.configured) {
                setConfig(data);
                setHost(data.host || '');
                setPort(String(data.port || 465));
                setSecure(data.secure !== undefined ? Boolean(data.secure) : (data.port === 465));
                setUser(data.user || '');
                setFromName(data.fromName || '');
                setFromEmail(data.fromEmail || '');
                setPass(''); // Don't expose password
            } else {
                setConfig(null);
            }
        } catch (err) {
            console.error('Error cargando configuración SMTP:', err);
            setStatusMsg({ type: 'error', text: `Error de red cargando configuración: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, [revendaKey]);

    // Apply quick presets
    const handleApplyPreset = (preset) => {
        if (preset === 'gmail') {
            setHost('smtp.gmail.com');
            setPort('465');
            setSecure(true);
            setStatusMsg({
                type: 'info',
                text: 'Preset Gmail aplicado. Recuerda usar una "Contraseña de Aplicación" de 16 caracteres generada en tu cuenta Google (no tu clave habitual).',
            });
        } else if (preset === 'outlook') {
            setHost('smtp.office365.com');
            setPort('587');
            setSecure(false);
            setStatusMsg({
                type: 'info',
                text: 'Preset Microsoft 365 / Outlook aplicado (STARTTLS en puerto 587).',
            });
        } else if (preset === 'cpanel') {
            const domain = user.includes('@') ? user.split('@')[1] : 'tudominio.com';
            setHost(`mail.${domain}`);
            setPort('465');
            setSecure(true);
            setStatusMsg({
                type: 'info',
                text: `Preset cPanel corporativo aplicado (mail.${domain} con SSL puerto 465).`,
            });
        }
    };

    const handleSave = async (e) => {
        e?.preventDefault();
        if (!host.trim() || !user.trim()) {
            setStatusMsg({ type: 'error', text: 'El servidor host y el usuario son obligatorios.' });
            return;
        }

        if (!config && !pass) {
            setStatusMsg({ type: 'error', text: 'Debes ingresar la contraseña de tu servidor de correo.' });
            return;
        }

        setSaving(true);
        setStatusMsg(null);
        try {
            const payload = {
                host: host.trim(),
                port: parseInt(port, 10) || 465,
                secure: Boolean(secure),
                user: user.trim(),
                pass: pass ? pass.trim() : undefined,
                fromName: fromName.trim(),
                fromEmail: fromEmail.trim() || user.trim(),
            };

            const resp = await fetch(`/modulo/email/config/${revendaKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const text = await resp.text();
            let data = {};
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error(`Respuesta inválida del servidor: ${text}`);
            }

            if (!resp.ok) {
                throw new Error(data.error || data.details || 'Error validando credenciales SMTP');
            }

            setStatusMsg({
                type: 'success',
                text: '¡Conexión SMTP verificada y guardada con éxito! Las alertas por correo se despacharán con tu marca e identidad.',
            });
            setPass('');
            await fetchConfig();
        } catch (err) {
            setStatusMsg({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Estás seguro de desvincular este servidor de correo SMTP? Las alertas por correo se pausarán para evitar filtraciones de marca.')) {
            return;
        }

        setSaving(true);
        setStatusMsg(null);
        try {
            const resp = await fetch(`/modulo/email/config/${revendaKey}`, { method: 'DELETE' });
            if (resp.ok) {
                setConfig(null);
                setHost('');
                setUser('');
                setPass('');
                setFromName('');
                setFromEmail('');
                setStatusMsg({ type: 'info', text: 'Configuración SMTP eliminada correctamente.' });
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
            setTestResult({ ok: false, error: 'Ingresa un correo destinatario para la prueba.' });
            return;
        }

        setSendingTest(true);
        setTestResult(null);
        try {
            const resp = await fetch(`/modulo/email/test/${revendaKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testTo.trim(),
                    subject: 'Prueba Exitosa de Alerta GPS - Servidor SMTP Propio',
                    message: '¡Felicitaciones! Tu servidor SMTP corporativo está configurado y funcionando a la perfección.\n\nTodas las alertas de velocidad, geocercas, botón de pánico SOS y eventos de tu flota se enviarán con la identidad y el logotipo de tu empresa.',
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
                    message: `¡Correo enviado con éxito! Revisa tu bandeja de entrada o spam (${testTo}). Message ID: ${data.messageId || 'OK'}`,
                });
            } else {
                setTestResult({
                    ok: false,
                    error: data.error || data.details || 'Error enviando correo de prueba',
                });
            }
        } catch (err) {
            setTestResult({ ok: false, error: err.message });
        } finally {
            setSendingTest(false);
        }
    };

    return (
        <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'Correo SMTP']}>
            <Container maxWidth="lg" className={classes.container}>
                {/* Banner de Estado Header */}
                <Paper className={classes.headerCard} elevation={3}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <EmailIcon style={{ fontSize: 44, color: '#fff' }} />
                        <Box>
                            <Typography variant="h5" fontWeight={700}>
                                Servidor de Correo SMTP Propio
                            </Typography>
                            <Typography variant="body2" style={{ opacity: 0.9 }}>
                                {admin
                                    ? 'Canal Global de Notificaciones por Correo (SuperAdmin)'
                                    : `Canal Corporativo Exclusivo para Revendedor #${revendaKey}`}
                            </Typography>
                        </Box>
                    </Box>

                    <Box display="flex" alignItems="center" gap={1}>
                        {loading ? (
                            <CircularProgress size={24} style={{ color: '#fff' }} />
                        ) : config?.configured ? (
                            <Chip
                                icon={<CheckCircleIcon style={{ color: '#fff' }} />}
                                label="SMTP Conectado y Verificado"
                                style={{ backgroundColor: '#2e7d32', color: '#fff', fontWeight: 600 }}
                            />
                        ) : (
                            <Chip
                                label="Sin Configurar (Aislamiento Activo)"
                                style={{ backgroundColor: '#ed6c02', color: '#fff', fontWeight: 600 }}
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

                {/* Formulario Principal de Configuración SMTP */}
                <Paper className={classes.sectionCard} elevation={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <DnsIcon color="primary" />
                            <Typography variant="h6" fontWeight={600}>
                                Credenciales del Servidor Saliente (SMTP)
                            </Typography>
                        </Box>
                        {config?.configured && (
                            <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={<DeleteIcon />}
                                onClick={handleDelete}
                                disabled={saving}
                            >
                                Desvincular Servidor
                            </Button>
                        )}
                    </Box>

                    <Typography variant="body2" color="textSecondary" paragraph>
                        Configura el servidor de correo corporativo de tu empresa. Al habilitar tu propio SMTP, todas las alertas
                        de geocercas, pánico SOS y notificaciones automáticas se despacharán con el dominio, nombre y logotipo de tu marca,
                        cumpliendo con la política estricta de aislamiento de marca blanca.
                    </Typography>

                    {/* Presets Rápidos */}
                    <Box mb={3}>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Presets de Configuración Rápida:
                        </Typography>
                        <ButtonGroup variant="outlined" size="small">
                            <Button
                                className={classes.presetButton}
                                onClick={() => handleApplyPreset('gmail')}
                            >
                                🔴 Gmail / Google Workspace
                            </Button>
                            <Button
                                className={classes.presetButton}
                                onClick={() => handleApplyPreset('outlook')}
                            >
                                🔵 Microsoft 365 / Outlook
                            </Button>
                            <Button
                                className={classes.presetButton}
                                onClick={() => handleApplyPreset('cpanel')}
                            >
                                🌐 cPanel / Correo Propio
                            </Button>
                        </ButtonGroup>
                    </Box>

                    <form onSubmit={handleSave}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={8}>
                                <TextField
                                    fullWidth
                                    label="Servidor Host SMTP"
                                    placeholder="smtp.gmail.com, mail.miempresa.com o smtp.office365.com"
                                    value={host}
                                    onChange={(e) => setHost(e.target.value)}
                                    required
                                    disabled={saving}
                                    helperText="Dirección del servidor de correo saliente"
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    label="Puerto"
                                    placeholder="465 o 587"
                                    value={port}
                                    onChange={(e) => {
                                        setPort(e.target.value);
                                        if (e.target.value === '465') setSecure(true);
                                        if (e.target.value === '587') setSecure(false);
                                    }}
                                    required
                                    disabled={saving}
                                    helperText="465 (SSL directo) o 587 (STARTTLS)"
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Usuario / Correo Electrónico"
                                    placeholder="alertas@miempresa.com"
                                    value={user}
                                    onChange={(e) => setUser(e.target.value)}
                                    required
                                    disabled={saving}
                                    helperText="Dirección de correo de autenticación"
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    type={showPass ? 'text' : 'password'}
                                    label="Contraseña"
                                    placeholder={config?.configured ? '•••••••• (Mantener actual)' : 'Contraseña o App Password'}
                                    value={pass}
                                    onChange={(e) => setPass(e.target.value)}
                                    disabled={saving}
                                    helperText={
                                        config?.configured
                                            ? 'Dejar en blanco para mantener la contraseña existente'
                                            : 'Para Gmail o Outlook usa una Contraseña de Aplicación'
                                    }
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPass(!showPass)}
                                                    edge="end"
                                                    size="small"
                                                >
                                                    {showPass ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Nombre del Remitente (Alias)"
                                    placeholder="D&D Transportes GPS"
                                    value={fromName}
                                    onChange={(e) => setFromName(e.target.value)}
                                    disabled={saving}
                                    helperText="Nombre que verá el cliente al recibir el correo"
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Correo Remitente (From / Reply-To)"
                                    placeholder="alertas@miempresa.com"
                                    value={fromEmail}
                                    onChange={(e) => setFromEmail(e.target.value)}
                                    disabled={saving}
                                    helperText="Opcional. Por defecto utiliza el usuario indicado arriba"
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={secure}
                                            onChange={(e) => setSecure(e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Typography variant="body2">
                                            <strong>Conexión Cifrada SSL/TLS Directa</strong> (Recomendado para puerto 465. Desactivar si usas STARTTLS en puerto 587)
                                        </Typography>
                                    }
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <Box display="flex" justifyContent="flex-end" mt={1}>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        color="primary"
                                        size="large"
                                        startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                        disabled={saving}
                                        style={{ minWidth: 240, borderRadius: 8, fontWeight: 700 }}
                                    >
                                        {saving ? 'Verificando Servidor...' : 'Verificar y Guardar SMTP'}
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </form>
                </Paper>

                {/* Sección de Diagnóstico y Envío de Correo de Prueba */}
                {config?.configured && (
                    <Paper className={classes.sectionCard} elevation={2}>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                            <MarkEmailReadIcon color="success" />
                            <Typography variant="h6" fontWeight={600}>
                                Prueba Diagnóstica de Envío en Vivo
                            </Typography>
                        </Box>

                        <Typography variant="body2" color="textSecondary" paragraph>
                            Envía un correo de prueba para comprobar que tu servidor SMTP corporativo procesa y entrega los
                            mensajes correctamente y con la plantilla de diseño de tu marca.
                        </Typography>

                        {testResult && (
                            <Alert
                                severity={testResult.ok ? 'success' : 'error'}
                                onClose={() => setTestResult(null)}
                                style={{ marginBottom: 16, borderRadius: 8 }}
                            >
                                {testResult.ok ? testResult.message : `Fallo al enviar correo: ${testResult.error}`}
                            </Alert>
                        )}

                        <form onSubmit={handleSendTest}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={8}>
                                    <TextField
                                        fullWidth
                                        type="email"
                                        label="Correo Destinatario para Prueba"
                                        placeholder="mi.correo@empresa.com"
                                        value={testTo}
                                        onChange={(e) => setTestTo(e.target.value)}
                                        required
                                        disabled={sendingTest}
                                        helperText="Ingresa tu correo personal o corporativo para recibir el test"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
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
                                        {sendingTest ? 'Despachando...' : 'Enviar Correo de Prueba'}
                                    </Button>
                                </Grid>
                            </Grid>
                        </form>
                    </Paper>
                )}

                {/* Guía y Preguntas Frecuentes */}
                <Accordion className={classes.sectionCard} elevation={1}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <HelpOutlineIcon color="info" />
                            <Typography variant="subtitle1" fontWeight={600}>
                                Guía de Configuración & Preguntas Frecuentes
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box className={classes.instructionsBox}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                🔒 ¿Cómo obtener la Contraseña de Aplicación en Gmail?
                            </Typography>
                            <Typography variant="body2" paragraph>
                                1. Accede a tu cuenta Google y ve a <strong>Seguridad</strong>.<br />
                                2. Asegúrate de tener activa la <strong>Verificación en 2 pasos</strong>.<br />
                                3. En la barra de búsqueda superior escribe <strong>Contraseñas de aplicaciones</strong>.<br />
                                4. Crea una nueva contraseña con el nombre "GeoZoone GPS" y copia el código de 16 letras generado.<br />
                                5. Pégalo en el campo <strong>Contraseña</strong> de este formulario (sin espacios).
                            </Typography>
                        </Box>

                        <Box className={classes.instructionsBox}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                🛡️ Aislamiento Estricto de Marca Blanca
                            </Typography>
                            <Typography variant="body2">
                                Para proteger la privacidad y exclusividad de tu empresa ante tus clientes, si no has configurado
                                tu propio servidor SMTP, el sistema <strong>nunca enviará correos usando el dominio de la matriz</strong>.
                                Una vez que ingreses y verifiques tu servidor SMTP saliente, tus alertas se despacharán de forma 100%
                                personalizada.
                            </Typography>
                        </Box>
                    </AccordionDetails>
                </Accordion>
            </Container>
        </PageLayout>
    );
};

export default EmailConfig;
