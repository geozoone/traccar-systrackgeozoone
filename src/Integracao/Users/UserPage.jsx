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
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
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

const UserPage = () => {
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
    };

    const validate = () => item && item.name && item.email && (item.attributes.informacoes && item.attributes.informacoes.cpf || false) && item.phone && (item.id || item.password);

    useEffect(useCatch(async () => {
        if (id) {
            const response = await fetch(`/api/users/${id}`);
            const data = await response.json();

            // console.log(cliente);

            setItem({ ...data, attributes: { ...data.attributes,  informacoes: { ...data.attributes.informacoes } } });
        } else {
            setItem({ ...item, attributes: { informacoes: {} } });
        }
    }), []);

    return (
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

                            {(currentUser.administrator == 1) && (
                            <span className={`form-group col-sm-6 ${classes.details} `}>
                                <FormControl>
                                    <InputLabel>{t('mapDefault')}</InputLabel>
                                    <Select
                                        label={t('mapDefault')}
                                        value={item.attributes.nivel || 1}
                                        onChange={(e) => setItem({ ...item, attributes:{ nivel: e.target.value } })}
                                    >
                                        <MenuItem key={2} value={2}>
                                            <Typography component="span">Revenda</Typography>
                                        </MenuItem>

                                        <MenuItem key={3} value={3}>
                                            <Typography component="span">Cliente</Typography>
                                        </MenuItem>

                                        <MenuItem key={1} value={1}>
                                            <Typography component="span">Usuario</Typography>
                                        </MenuItem>

                                    </Select>
                                </FormControl>
                            </span>
                            )}
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
    );
};

export default UserPage;
