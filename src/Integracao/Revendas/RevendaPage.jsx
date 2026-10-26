import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    FormGroup,
    TextField,
    Button,
    Toolbar,
    useTheme,
    useMediaQuery,
    Box,
    Alert,
    CircularProgress,
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import LanguageIcon from '@mui/icons-material/Language';
import PaletteIcon from '@mui/icons-material/Palette';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useDispatch, useSelector } from 'react-redux';
import dayjs from 'dayjs';
import EditItemView from './EditItemView';
import EditAttributesAccordion from '../../settings/components/EditAttributesAccordion';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useUserAttributes from '../../common/attributes/useUserAttributes';
import { sessionActions } from '../../store';
import SelectField from '../../common/components/SelectField';
import SettingsMenu from '../../settings/components/SettingsMenu';
import useCommonUserAttributes from '../../common/attributes/useCommonUserAttributes';
import { useAdministrator, useRestriction, useManager } from '../../common/util/permissions';
import useQuery from '../../common/util/useQuery';
import { useCatch } from '../../reactHelper';
import useMapStyles from '../../map/core/useMapStyles';
import { map } from '../../map/core/MapView';

const useStyles = makeStyles((theme) => ({
    details: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(2),
        paddingBottom: theme.spacing(3),
    },
}));

const ClientePage = () => {
    const classes = useStyles();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const t = useTranslation();

    const admin = useAdministrator();
    const manager = useManager();
    const fixedEmail = useRestriction('fixedEmail');

    const currentUser = useSelector((state) => state.session.user);
    const registrationEnabled = useSelector((state) => state.session.server.registration);
    const openIdForced = useSelector((state) => state.session.server.openIdForce);

    const mapStyles = useMapStyles();
    const commonUserAttributes = useCommonUserAttributes(t);
    const userAttributes = useUserAttributes(t);

    const { id } = useParams();
    const [item, setItem] = useState(id === currentUser.id.toString() ? currentUser : null);

    const [deleteEmail, setDeleteEmail] = useState();
    const [deleteFailed, setDeleteFailed] = useState(false);

    // Estado de Marca Blanca / White-Label
    const [brandingDomain, setBrandingDomain] = useState('');
    const [brandingTitle, setBrandingTitle] = useState('');
    const [brandingColor, setBrandingColor] = useState('#282833');
    const [brandingLogo, setBrandingLogo] = useState(null);
    const [brandingBackground, setBrandingBackground] = useState(null);
    const [brandingSaving, setBrandingSaving] = useState(false);
    const [brandingMsg, setBrandingMsg] = useState(null);

    const handleImageUpload = (e, setter) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('La imagen no debe superar los 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setter(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const saveBrandingData = async (revendaTargetId) => {
        const cleanDomain = (brandingDomain || '').trim();
        if (!cleanDomain) return;

        setBrandingSaving(true);
        setBrandingMsg(null);
        try {
            const resp = await fetch('/modulo/branding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: cleanDomain,
                    title: brandingTitle || 'GPS Tracking',
                    logo: brandingLogo,
                    background: brandingBackground,
                    colorPrimary: brandingColor,
                    revendaId: revendaTargetId || id || item?.id,
                }),
            });
            if (resp.ok) {
                setBrandingMsg({ type: 'success', text: `¡Marca guardada con éxito para ${cleanDomain}!` });
            } else {
                setBrandingMsg({ type: 'error', text: 'Error guardando configuración de marca' });
            }
        } catch (err) {
            setBrandingMsg({ type: 'error', text: `Error de conexión: ${err.message}` });
        } finally {
            setBrandingSaving(false);
        }
    };

    const handleDelete = useCatch(async () => {
        if (deleteEmail === currentUser.email) {
            setDeleteFailed(false);
            const response = await fetch(`/api/users/${currentUser.id}`, { method: 'DELETE' });
            if (response.ok) {
                navigate('/login');
                dispatch(sessionActions.updateUser(null));
            } else {
                throw Error(await response.text());
            }
        } else {
            setDeleteFailed(true);
        }
    });

    const query = useQuery();
    const [queryHandled, setQueryHandled] = useState(false);
    const attribute = query.get('attribute');

    useEffect(() => {
        if (!queryHandled && item && attribute) {
            if (!item.attributes.hasOwnProperty('attribute')) {
                const updatedAttributes = { ...item.attributes };
                updatedAttributes[attribute] = '';
                setItem({ ...item, attributes: updatedAttributes });
            }
            setQueryHandled(true);
        }
    }, [item, queryHandled, setQueryHandled, attribute]);

    const onItemSaved = (result) => {
        if (result.id === currentUser.id) {
            dispatch(sessionActions.updateUser(result));
        }
        if (brandingDomain) {
            saveBrandingData(result.id);
        }
    };

    const validate = () => item && item.name && item.email && (item.attributes.informacoes && item.attributes.informacoes.cpf || false) && item.phone && (item.id || item.password);

    useEffect(useCatch(async () => {
        if (id) {
            const response = await fetch(`/api/users/${id}`);
            const cliente = await response.json();

            setItem({ ...cliente, attributes: { ...cliente.attributes, nivel: 2, informacoes: { ...cliente.attributes.informacoes } } });

            // Cargar marca blanca si ya existe para este revendedor
            try {
                const bResp = await fetch(`/modulo/branding/revenda/${id}`);
                if (bResp.ok) {
                    const bData = await bResp.json();
                    if (bData && bData.found) {
                        setBrandingDomain(bData.domain || '');
                        setBrandingTitle(bData.title || '');
                        setBrandingColor(bData.colorPrimary || '#282833');
                        setBrandingLogo(bData.logo || null);
                        setBrandingBackground(bData.background || null);
                    }
                }
            } catch (err) {}
        } else {
            setItem({ ...item, attributes: { nivel: 2, informacoes: {} } });
        }
    }), []);

    return (
        <>           
            <EditItemView
                endpoint="users"
                item={item}
                setItem={setItem}
                defaultItem={admin ? { deviceLimit: -1 } : {}}
                validate={validate}
                onItemSaved={onItemSaved}
                menu={<SettingsMenu />}
                breadcrumbs={['settingsTitle', 'settingsUser']}
            >
                {item && (
                    <>
                        <Accordion defaultExpanded={!attribute}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">
                                    Informações
                                </Typography>
                            </AccordionSummary>

                            <AccordionDetails className={'m-3 form-row'} >
                                <span className={`form-group col-sm-12 ${classes.details} `}>
                                    <TextField
                                        value={item.name || ''}
                                        onChange={(event) => setItem({ ...item, name: event.target.value })}
                                        label={t('sharedName')}
                                    />
                                </span>
                                <span className={`form-group col-sm-6 ${classes.details} `}>
                                    <TextField
                                        value={(item.attributes.informacoes && item.attributes.informacoes.cpf) || ''}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, informacoes: { ...item.attributes.informacoes, cpf: e.target.value } } })}
                                        label={'CPF'}
                                        type={'number'}
                                    />
                                </span>

                                <span className={`form-group col-sm-6 ${classes.details} `}>
                                    <TextField
                                        value={item.phone || ''}
                                        onChange={(event) => setItem({ ...item, phone: event.target.value })}
                                        label={t('sharedPhone')}
                                    />
                                </span>

                                <span className={`form-group col-sm-6 ${classes.details} `}>
                                    <TextField
                                        value={(item.attributes.informacoes && item.attributes.informacoes.endereco) || ''}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, informacoes: { ...item.attributes.informacoes, endereco: e.target.value } } })}
                                        label={'Endereço'}
                                    />
                                </span>

                                <span className={`form-group col-sm-3 ${classes.details} `}>
                                    <TextField
                                        value={(item.attributes.informacoes && item.attributes.informacoes.numero) || ''}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, informacoes: { ...item.attributes.informacoes, numero: e.target.value } } })}
                                        label={'Número'}
                                    />
                                </span>

                                <span className={`form-group col-sm-3 ${classes.details} `}>
                                    <TextField
                                        value={(item.attributes.informacoes && item.attributes.informacoes.bairro) || ''}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, informacoes: { ...item.attributes.informacoes, bairro: e.target.value } } })}
                                        label={'Bairro'}
                                    />
                                </span>

                                <span className={`form-group col-sm-4 ${classes.details} `}>
                                    <TextField
                                        value={(item.attributes.informacoes && item.attributes.informacoes.cidade) || ''}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, informacoes: { ...item.attributes.informacoes, cidade: e.target.value } } })}
                                        label={'Cidade'}
                                    />
                                </span>

                                <span className={`form-group col-sm-4 ${classes.details} `}>
                                    <TextField
                                        value={(item.attributes.informacoes && item.attributes.informacoes.uf) || ''}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, informacoes: { ...item.attributes.informacoes, uf: e.target.value } } })}
                                        label={'UF'}
                                    />
                                </span>

                                <span className={`form-group col-sm-4 ${classes.details} `}>
                                    <TextField
                                        value={(item.attributes.informacoes && item.attributes.informacoes.cep) || ''}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, informacoes: { ...item.attributes.informacoes, cep: e.target.value } } })}
                                        label={'CEP'}
                                    />
                                </span>

                                <span className={`form-group col-sm-6 ${classes.details} `}>
                                    <TextField
                                        value={(item.attributes.informacoes && item.attributes.informacoes.complement) || ''}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, informacoes: { ...item.attributes.informacoes, complement: e.target.value } } })}
                                        label={'Complemento'}
                                    />
                                </span>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion defaultExpanded={!attribute}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">
                                    {t('sharedRequired')}
                                </Typography>
                            </AccordionSummary>

                            <AccordionDetails className={'m-3 form-row'}>
                                <span className={`form-group col-sm-6 ${classes.details} `}>
                                    <TextField
                                        value={item.email || ''}
                                        onChange={(event) => setItem({ ...item, email: event.target.value })}
                                        label={t('userEmail')}
                                        disabled={fixedEmail}
                                    />
                                </span>

                                <span className={`form-group col-sm-6 ${classes.details} `}>
                                    {!openIdForced && (
                                        <TextField
                                            type="password"
                                            onChange={(event) => setItem({ ...item, password: event.target.value })}
                                            label={t('userPassword')}
                                        />
                                    )}
                                </span>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion defaultExpanded={Boolean(brandingDomain)}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
                                    <PaletteIcon color="primary" />
                                    🎨 Personalización de Marca (Marca Blanca / Dominio Propio)
                                </Typography>
                            </AccordionSummary>

                            <AccordionDetails className={'m-3 form-row'}>
                                {brandingMsg && (
                                    <div className="col-12 mb-3">
                                        <Alert severity={brandingMsg.type} onClose={() => setBrandingMsg(null)}>
                                            {brandingMsg.text}
                                        </Alert>
                                    </div>
                                )}

                                <span className={`form-group col-sm-6 ${classes.details}`}>
                                    <TextField
                                        value={brandingDomain}
                                        onChange={(e) => setBrandingDomain(e.target.value)}
                                        label="Subdominio / Dominio del Revendedor"
                                        placeholder="ej: gps3.ubiqsat.com"
                                        helperText="El dominio que escribirá el cliente para entrar a la plataforma (sin https://)"
                                    />
                                </span>

                                <span className={`form-group col-sm-6 ${classes.details}`}>
                                    <TextField
                                        value={brandingTitle}
                                        onChange={(e) => setBrandingTitle(e.target.value)}
                                        label="Título de la Plataforma / Pestaña"
                                        placeholder="ej: Ubiqsat GPS Tracking"
                                        helperText="Nombre que aparecerá en la pestaña del navegador"
                                    />
                                </span>

                                <span className={`form-group col-sm-6 ${classes.details}`}>
                                    <TextField
                                        value={brandingColor}
                                        onChange={(e) => setBrandingColor(e.target.value)}
                                        type="color"
                                        label="Color Corporativo"
                                        helperText="Color principal de botones y detalles"
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ minHeight: 60 }}
                                    />
                                </span>

                                <div className="col-sm-12 my-2">
                                    <hr />
                                </div>

                                {/* SECCIÓN SUBIDA DE LOGO */}
                                <div className="form-group col-sm-6">
                                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                        Logo del Revendedor (Pantalla de Login):
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        component="label"
                                        startIcon={<CloudUploadIcon />}
                                        fullWidth
                                        sx={{ mb: 1 }}
                                    >
                                        Seleccionar Logo (PNG / SVG / JPG)
                                        <input
                                            type="file"
                                            hidden
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e, setBrandingLogo)}
                                        />
                                    </Button>

                                    {brandingLogo ? (
                                        <Box sx={{
                                            mt: 1,
                                            p: 2,
                                            border: '1px dashed #ccc',
                                            borderRadius: 2,
                                            background: '#f9f9f9',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center'
                                        }}>
                                            <img
                                                src={brandingLogo}
                                                alt="Logo Preview"
                                                style={{ maxWidth: '100%', maxHeight: '90px', objectFit: 'contain' }}
                                            />
                                            <Button
                                                size="small"
                                                color="error"
                                                startIcon={<DeleteIcon />}
                                                onClick={() => setBrandingLogo(null)}
                                                sx={{ mt: 1 }}
                                            >
                                                Quitar Logo
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Typography variant="caption" color="textSecondary">
                                            (Si no se sube un logo propio, se mostrará el nombre de su empresa en texto estilizado).
                                        </Typography>
                                    )}
                                </div>

                                {/* SECCIÓN SUBIDA DE FONDO */}
                                <div className="form-group col-sm-6">
                                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                        Fondo de Pantalla de Login:
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        component="label"
                                        startIcon={<CloudUploadIcon />}
                                        fullWidth
                                        sx={{ mb: 1 }}
                                    >
                                        Seleccionar Fondo (JPG / PNG)
                                        <input
                                            type="file"
                                            hidden
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e, setBrandingBackground)}
                                        />
                                    </Button>

                                    {brandingBackground ? (
                                        <Box sx={{
                                            mt: 1,
                                            p: 2,
                                            border: '1px dashed #ccc',
                                            borderRadius: 2,
                                            background: '#f9f9f9',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center'
                                        }}>
                                            <img
                                                src={brandingBackground}
                                                alt="Background Preview"
                                                style={{ maxWidth: '100%', maxHeight: '90px', objectFit: 'cover', borderRadius: 4 }}
                                            />
                                            <Button
                                                size="small"
                                                color="error"
                                                startIcon={<DeleteIcon />}
                                                onClick={() => setBrandingBackground(null)}
                                                sx={{ mt: 1 }}
                                            >
                                                Quitar Fondo
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Typography variant="caption" color="textSecondary">
                                            (Si no se sube un fondo, se aplicará un fondo corporativo oscuro neutral).
                                        </Typography>
                                    )}
                                </div>

                                <div className="col-12 mt-3">
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        disabled={brandingSaving || !brandingDomain}
                                        onClick={() => saveBrandingData(id)}
                                        startIcon={brandingSaving ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                                    >
                                        {brandingSaving ? 'Guardando Marca...' : 'Guardar Personalización de Marca'}
                                    </Button>
                                </div>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">
                                    {t('sharedPreferences')}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails className={classes.details}>

                                <FormControl>
                                    <InputLabel>{t('mapDefault')}</InputLabel>
                                    <Select
                                        label={t('mapDefault')}
                                        value={item.map || 'locationIqStreets'}
                                        onChange={(e) => setItem({ ...item, map: e.target.value })}
                                    >
                                        {mapStyles.filter((style) => style.available).map((style) => (
                                            <MenuItem key={style.id} value={style.id}>
                                                <Typography component="span">{style.title}</Typography>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl>
                                    <InputLabel>{t('settingsCoordinateFormat')}</InputLabel>
                                    <Select
                                        label={t('settingsCoordinateFormat')}
                                        value={item.coordinateFormat || 'dd'}
                                        onChange={(event) => setItem({ ...item, coordinateFormat: event.target.value })}
                                    >
                                        <MenuItem value="dd">{t('sharedDecimalDegrees')}</MenuItem>
                                        <MenuItem value="ddm">{t('sharedDegreesDecimalMinutes')}</MenuItem>
                                        <MenuItem value="dms">{t('sharedDegreesMinutesSeconds')}</MenuItem>
                                    </Select>
                                </FormControl>

                                <FormControl>
                                    <InputLabel>{t('settingsSpeedUnit')}</InputLabel>
                                    <Select
                                        label={t('settingsSpeedUnit')}
                                        value={(item.attributes && item.attributes.speedUnit) || 'kn'}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, speedUnit: e.target.value } })}
                                    >
                                        <MenuItem value="kn">{t('sharedKn')}</MenuItem>
                                        <MenuItem value="kmh">{t('sharedKmh')}</MenuItem>
                                        <MenuItem value="mph">{t('sharedMph')}</MenuItem>
                                    </Select>
                                </FormControl>

                                <FormControl>
                                    <InputLabel>{t('settingsDistanceUnit')}</InputLabel>
                                    <Select
                                        label={t('settingsDistanceUnit')}
                                        value={(item.attributes && item.attributes.distanceUnit) || 'km'}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, distanceUnit: e.target.value } })}
                                    >
                                        <MenuItem value="km">{t('sharedKm')}</MenuItem>
                                        <MenuItem value="mi">{t('sharedMi')}</MenuItem>
                                        <MenuItem value="nmi">{t('sharedNmi')}</MenuItem>
                                    </Select>
                                </FormControl>

                                <FormControl>
                                    <InputLabel>{t('settingsAltitudeUnit')}</InputLabel>
                                    <Select
                                        label={t('settingsAltitudeUnit')}
                                        value={(item.attributes && item.attributes.altitudeUnit) || 'm'}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, altitudeUnit: e.target.value } })}
                                    >
                                        <MenuItem value="m">{t('sharedMeters')}</MenuItem>
                                        <MenuItem value="ft">{t('sharedFeet')}</MenuItem>
                                    </Select>
                                </FormControl>

                                <FormControl>
                                    <InputLabel>{t('settingsVolumeUnit')}</InputLabel>
                                    <Select
                                        label={t('settingsVolumeUnit')}
                                        value={(item.attributes && item.attributes.volumeUnit) || 'ltr'}
                                        onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, volumeUnit: e.target.value } })}
                                    >
                                        <MenuItem value="ltr">{t('sharedLiter')}</MenuItem>
                                        <MenuItem value="usGal">{t('sharedUsGallon')}</MenuItem>
                                        <MenuItem value="impGal">{t('sharedImpGallon')}</MenuItem>
                                    </Select>
                                </FormControl>

                                <SelectField
                                    value={(item.attributes && item.attributes.timezone) || ''}
                                    emptyValue=""
                                    onChange={(e) => setItem({ ...item, attributes: { ...item.attributes, timezone: e.target.value } })}
                                    endpoint="/api/server/timezones"
                                    keyGetter={(it) => it}
                                    titleGetter={(it) => it}
                                    label={t('sharedTimezone')}
                                />

                                <TextField
                                    value={item.poiLayer || ''}
                                    onChange={(event) => setItem({ ...item, poiLayer: event.target.value })}
                                    label={t('mapPoiLayer')}
                                />

                                <FormGroup>
                                    <FormControlLabel
                                        control={<Checkbox checked={item.twelveHourFormat} onChange={(event) => setItem({ ...item, twelveHourFormat: event.target.checked })} />}
                                        label={t('settingsTwelveHourFormat')}
                                    />
                                </FormGroup>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">
                                    {t('sharedLocation')}
                                </Typography>
                            </AccordionSummary>

                            <AccordionDetails className={classes.details}>
                                <TextField
                                    type="number"
                                    value={item.latitude || 0}
                                    onChange={(event) => setItem({ ...item, latitude: Number(event.target.value) })}
                                    label={t('positionLatitude')}
                                />

                                <TextField
                                    type="number"
                                    value={item.longitude || 0}
                                    onChange={(event) => setItem({ ...item, longitude: Number(event.target.value) })}
                                    label={t('positionLongitude')}
                                />

                                <TextField
                                    type="number"
                                    value={item.zoom || 0}
                                    onChange={(event) => setItem({ ...item, zoom: Number(event.target.value) })}
                                    label={t('serverZoom')}
                                />

                                <Button
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => {
                                        const { lng, lat } = map.getCenter();
                                        setItem({
                                            ...item,
                                            latitude: Number(lat.toFixed(6)),
                                            longitude: Number(lng.toFixed(6)),
                                            zoom: Number(map.getZoom().toFixed(1)),
                                        });
                                    }}
                                >
                                    {t('mapCurrentLocation')}
                                </Button>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">
                                    {t('sharedPermissions')}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails className={classes.details}>
                                <TextField
                                    label={t('userExpirationTime')}
                                    type="date"
                                    value={(item.expirationTime && dayjs(item.expirationTime).locale('en').format('YYYY-MM-DD')) || '2099-01-01'}
                                    onChange={(e) => setItem({ ...item, expirationTime: dayjs(e.target.value, 'YYYY-MM-DD').locale('en').format() })}
                                    disabled={!manager}
                                />
                                <TextField
                                    type="number"
                                    value={item.deviceLimit || 0}
                                    onChange={(e) => setItem({ ...item, deviceLimit: Number(e.target.value) })}
                                    label={t('userDeviceLimit')}
                                    disabled={!admin}
                                />
                                <TextField
                                    type="number"
                                    value={item.userLimit || 0}
                                    onChange={(e) => setItem({ ...item, userLimit: Number(e.target.value) })}
                                    label={t('userUserLimit')}
                                    disabled={!admin}
                                />
                                <FormGroup>
                                    <FormControlLabel
                                        control={<Checkbox checked={item.disabled} onChange={(e) => setItem({ ...item, disabled: e.target.checked })} />}
                                        label={t('sharedDisabled')}
                                        disabled={!manager}
                                    />
                                    <FormControlLabel
                                        control={<Checkbox checked={item.administrator} onChange={(e) => setItem({ ...item, administrator: e.target.checked })} />}
                                        label={t('userAdmin')}
                                        disabled={!admin}
                                    />
                                    <FormControlLabel
                                        control={<Checkbox checked={item.readonly} onChange={(e) => setItem({ ...item, readonly: e.target.checked })} />}
                                        label={t('serverReadonly')}
                                        disabled={!manager}
                                    />
                                    <FormControlLabel
                                        control={<Checkbox checked={item.deviceReadonly} onChange={(e) => setItem({ ...item, deviceReadonly: e.target.checked })} />}
                                        label={t('userDeviceReadonly')}
                                        disabled={!manager}
                                    />
                                    <FormControlLabel
                                        control={<Checkbox checked={item.limitCommands} onChange={(e) => setItem({ ...item, limitCommands: e.target.checked })} />}
                                        label={t('userLimitCommands')}
                                        disabled={!manager}
                                    />
                                    <FormControlLabel
                                        control={<Checkbox checked={item.disableReports} onChange={(e) => setItem({ ...item, disableReports: e.target.checked })} />}
                                        label={t('userDisableReports')}
                                        disabled={!manager}
                                    />
                                    <FormControlLabel
                                        control={<Checkbox checked={item.fixedEmail} onChange={(e) => setItem({ ...item, fixedEmail: e.target.checked })} />}
                                        label={t('userFixedEmail')}
                                        disabled={!manager}
                                    />
                                </FormGroup>
                            </AccordionDetails>
                        </Accordion>

                        <EditAttributesAccordion
                            attribute={attribute}
                            attributes={item.attributes}
                            setAttributes={(attributes) => setItem({ ...item, attributes })}
                            definitions={{ ...commonUserAttributes, ...userAttributes }}
                            focusAttribute={attribute}
                        />

                        {registrationEnabled && item.id === currentUser.id && !manager && (
                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="subtitle1" color="error">
                                        {t('userDeleteAccount')}
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails className={classes.details}>
                                    <TextField
                                        value={deleteEmail}
                                        onChange={(event) => setDeleteEmail(event.target.value)}
                                        label={t('userEmail')}
                                        error={deleteFailed}
                                    />
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        onClick={handleDelete}
                                        startIcon={<DeleteForeverIcon />}
                                    >
                                        {t('userDeleteAccount')}
                                    </Button>
                                </AccordionDetails>
                            </Accordion>
                        )}
                    </>
                )}
            </EditItemView>
        </>
    );
};

export default ClientePage;
