import React, { useState } from 'react';
import Popup from 'reactjs-popup';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Draggable from 'react-draggable';
import {
    Card,
    CardContent,
    Typography,
    CardActions,
    IconButton,
    Button,
    Table,
    TableBody,
    TableRow,
    TableCell,
    Menu,
    MenuItem,
    CardMedia,
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import CloseIcon from '@mui/icons-material/Close';
import ReplayIcon from '@mui/icons-material/Replay';
import PublishIcon from '@mui/icons-material/Publish';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PendingIcon from '@mui/icons-material/Pending';
import Padlock from '@mui/icons-material/Lock';

import { useTranslation } from './LocalizationProvider';
import RemoveDialog from './RemoveDialog';
import PositionValue from './PositionValue';
import { useDeviceReadonly } from '../util/permissions';
import usePositionAttributes from '../attributes/usePositionAttributes';
import { devicesActions } from '../../store';
import { useCatch, useCatchCallback } from '../../reactHelper';
import { useAttributePreference } from '../util/preferences';

import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import KeyIcon from '@mui/icons-material/Key';
import SpeedIcon from '@mui/icons-material/Speed';
import QueryBuilderIcon from '@mui/icons-material/QueryBuilder';
import LockIcon from '@mui/icons-material/Lock';

import ShareIcon from '@mui/icons-material/Share';
import ShareLocationIcon from '@mui/icons-material/ShareLocation';
import LoupeIcon from '@mui/icons-material/Loupe';
import AnchorIcon from '@mui/icons-material/Anchor';
import MarkunreadMailboxIcon from '@mui/icons-material/MarkunreadMailbox';
import SocialDistanceIcon from '@mui/icons-material/SocialDistance';
import SignpostIcon from '@mui/icons-material/Signpost';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Tooltip from '@mui/material/Tooltip';
import QuickCommandSecurityModal from './QuickCommandSecurityModal';
import { useRestriction } from '../util/permissions';
import FollowTheSignsIcon from '@mui/icons-material/FollowTheSigns';

const useStyles = makeStyles((theme) => ({
    card: {
        pointerEvents: 'auto',
        width: '350px',
    },
    boxImagen: {
        width: '100%',
        padding: "10px",
    },
    media: {
        height: theme.dimensions.popupImageHeight,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
    },
    boxInfo: {
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        fontSize: '12px',
        textAlign: 'center',
    },
    mediaButton: {
        color: theme.palette.primary.contrastText,
        mixBlendMode: 'difference',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing(1, 1, 0, 2),
    },
    content: {
        paddingTop: theme.spacing(1),
        paddingBottom: theme.spacing(1),
        maxHeight: theme.dimensions.cardContentMaxHeight,
        overflow: 'auto',
    },
    delete: {
        color: theme.palette.error.main,
    },
    icon: {
        width: '25px',
        height: '25px',
        filter: 'brightness(0) invert(1)',
    },
    table: {
        '& .MuiTableCell-sizeSmall': {
            paddingLeft: 0,
            paddingRight: 0,
        },
    },
    cell: {
        width: '50px',
        borderBottom: 'none',
        color: '#075561',
        padding: '0px 5px',
        textAlign: 'center',
    },
    cell2: {
        width: '150px',
        borderBottom: 'none',
        color: '#075561',
    },
    cell3: {
        width: '200px',
        borderBottom: 'none',
        color: '#075561',
    },
    actions: {
        justifyContent: 'space-between',
    },
    root: ({ desktopPadding }) => ({
        pointerEvents: 'none',
        position: 'fixed',
        zIndex: 5,
        left: '50%',
        [theme.breakpoints.up('md')]: {
            left: `calc(50% + ${desktopPadding} / 2)`,
            bottom: theme.spacing(3),
        },
        [theme.breakpoints.down('md')]: {
            left: '50%',
            bottom: `calc(${theme.spacing(3)} + ${theme.dimensions.bottomBarHeight}px)`,
        },
        transform: 'translateX(-50%)',
    }),
}));

const renderStatusIcon = (name) => {
    switch (name) {
        case 'Nível de Bateria':
            return <BatteryFullIcon />;
        case 'Ignição':
            return <KeyIcon />;
        case 'Hora do dispositivo':
            return <QueryBuilderIcon />;
        case 'Velocidade':
            return <SpeedIcon />;
        case 'Endereço':
            return <MarkunreadMailboxIcon />;
        case 'Distância total':
            return <SocialDistanceIcon />;
        case 'Movimento':
            return <FollowTheSignsIcon />;
        case 'Direção':
            return <SignpostIcon />;
        case 'Bloqueado':
            return <LockIcon />;
        default:
            return name;
    }
};

const StatusRow = ({ name, content }) => {
    const classes = useStyles();

    return (
        <TableRow className='border-bottom border-3'>
            <TableCell className={`${classes.cell}`}>
                <Typography variant="body2">{renderStatusIcon(name)}</Typography>
            </TableCell>

            <TableCell className={`${classes.cell2}`}>
                <Typography variant="body2">{name}</Typography>
            </TableCell>

            <TableCell className={`${classes.cell3}`}>
                <Typography variant="body2" color="textSecondary">{content}</Typography>
            </TableCell>
        </TableRow>
    );
};

const StatusCard = ({ deviceId, position, onClose, disableActions, desktopPadding = 0 }) => {
    const classes = useStyles({ desktopPadding });
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const t = useTranslation();

    const deviceReadonly = useDeviceReadonly();
    const device = useSelector((state) => state.devices.items[deviceId]);

    const deviceImage = device?.attributes?.deviceImage;

    const positionAttributes = usePositionAttributes(t);
    const positionItems = useAttributePreference('positionItems', 'speed,address,totalDistance,course');

    const [anchorEl, setAnchorEl] = useState(null);
    const [removing, setRemoving] = useState(false);

    // Seguridad de Comandos Rápidos GeoZoone (Estándar Wialon)
    const limitCommands = useRestriction('limitCommands');
    const [securityModalOpen, setSecurityModalOpen] = useState(false);
    const [selectedActionType, setSelectedActionType] = useState('engineStop');

    // Determinar si el vehículo tiene relay/corte instalado físicamente
    const hasEngineCut = Boolean(
        device?.attributes?.bloqueoMotor === true
        || device?.attributes?.hasCut === true
        || device?.attributes?.relayInstalled === true
        || device?.attributes?.instalacion?.corteMotor?.toString()?.startsWith('Sí')
    );

    const openSecurityCommand = (type) => {
        setSelectedActionType(type);
        setSecurityModalOpen(true);
    };

    const handleRemove = useCatch(async (removed) => {
        if (removed) {
            const response = await fetch('/api/devices');
            if (response.ok) {
                dispatch(devicesActions.refresh(await response.json()));
            } else {
                throw Error(await response.text());
            }
        }
        setRemoving(false);
    });

    const handleGeofence = useCatchCallback(async () => {
        if (!position) return;
        const newItem = {
            name: '',
            area: `CIRCLE (${position.latitude} ${position.longitude}, 10)`,
        };
        const response = await fetch('/api/geofences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem),
        });
        if (response.ok) {
            const item = await response.json();
            const permissionResponse = await fetch('/api/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: position.deviceId, geofenceId: item.id }),
            });
            if (!permissionResponse.ok) {
                throw Error(await permissionResponse.text());
            }
            navigate(`/settings/geofence/${item.id}`);
        } else {
            throw Error(await response.text());
        }
    }, [navigate, position]);

    const Ancora = useCatchCallback(async () => {
        if (!position || !device) return;
        const newItem = {
            name: 'Ancora (' + (device.name || '') + ')',
            area: `CIRCLE (${position.latitude} ${position.longitude}, 2)`,
        };
        const response = await fetch('/api/geofences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem),
        });
        if (response.ok) {
            const item = await response.json();
            const permissionResponse = await fetch('/api/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: position.deviceId, geofenceId: item.id }),
            });
            if (!permissionResponse.ok) {
                throw Error(await permissionResponse.text());
            }
            navigate(`/settings/geofence/${item.id}`);
        } else {
            throw Error(await response.text());
        }
    }, [navigate, position, device]);

    const Compatilhar = () => {
        if (!position) return;
        let latitude = position.latitude ? position.latitude : null;
        let longitude = position.longitude ? position.longitude : null;
        window.open(`https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`, '_blank');
    };

    const CeiarAncora = useCatchCallback(async () => {
        if (!position || !device) return;
        const metros = document.getElementsByName("mt");
        let mt = 5;
        for (let i = 0; i < metros.length; i++) {
            if (metros[i].checked)
                mt = metros[i].value;
        }

        const newItem = {
            name: 'Ancora (' + (device.name || '') + ')',
            area: `CIRCLE (${position.latitude} ${position.longitude}, ${mt})`,
        };
        const response = await fetch('/api/geofences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem),
        });
        if (response.ok) {
            const item = await response.json();
            const permissionResponse = await fetch('/api/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: position.deviceId, geofenceId: item.id }),
            });
            if (!permissionResponse.ok) {
                throw Error(await permissionResponse.text());
            }
            navigate(`/geofences/`);
        } else {
            throw Error(await response.text());
        }
    }, [navigate, position, device]);

    const PopupExample = () => (
        <Popup
            trigger={
                <IconButton title="Crear Anclaje" disabled={!position || disableActions}>
                    <AnchorIcon />
                </IconButton>
            }
            modal
            nested
        >
            {(close) => (
                <div style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', maxWidth: 350 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Typography variant="h6" style={{ fontSize: 16, fontWeight: 700 }}>CREAR ANCLAJE</Typography>
                        <IconButton size="small" onClick={close}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </div>
                    <div>
                        <Typography variant="body2" style={{ marginBottom: 10 }}>
                            ¿Desea crear un ancla para el dispositivo <b>{device?.name}</b>?
                        </Typography>
                        <table style={{ width: '100%', textAlign: 'center' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: 6 }}><label><input type="radio" id="mt5" name="mt" value="5" defaultChecked style={{ marginRight: 4 }} />5 mt</label></td>
                                    <td style={{ padding: 6 }}><label><input type="radio" id="mt10" name="mt" value="10" style={{ marginRight: 4 }} />10 mt</label></td>
                                    <td style={{ padding: 6 }}><label><input type="radio" id="mt20" name="mt" value="20" style={{ marginRight: 4 }} />20 mt</label></td>
                                </tr>
                                <tr>
                                    <td style={{ padding: 6 }}><label><input type="radio" id="mt50" name="mt" value="50" style={{ marginRight: 4 }} />50 mt</label></td>
                                    <td style={{ padding: 6 }}><label><input type="radio" id="mt100" name="mt" value="100" style={{ marginRight: 4 }} />100 mt</label></td>
                                    <td style={{ padding: 6 }}><label><input type="radio" id="mt200" name="mt" value="200" style={{ marginRight: 4 }} />200 mt</label></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                        <Button variant="contained" color="primary" onClick={() => { CeiarAncora(); close(); }}>
                            CREAR
                        </Button>
                    </div>
                </div>
            )}
        </Popup>
    );

    if (!device) {
        return null;
    }

    const veiculo = device?.attributes?.veiculo || {};

    return (
        <>
            <div className={classes.root}>
                <Draggable handle={`.${classes.media}, .${classes.header}`}>
                    <Card elevation={3} className={classes.card}>
                        <div className={classes.header}>
                            <Typography variant="body2" color="textSecondary">
                                {device.name}
                            </Typography>
                            <IconButton
                                size="small"
                                onClick={onClose}
                                onTouchStart={onClose}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </div>

                        {deviceImage && (
                            <div className={classes.boxImagen}>
                                <CardMedia
                                    className={classes.media}
                                    image={`/api/media/${device.uniqueId}/${deviceImage}`}
                                />
                            </div>
                        )}

                        <div className={classes.boxInfo}>
                            {Boolean(veiculo && veiculo.marca && veiculo.modelo && device.contact) && (
                                <div className='w-75 p-2 m-1 border border-secondary rounded-pill fs-1'>
                                    {veiculo.marca} {veiculo.modelo} / Placa {device.contact}
                                </div>
                            )}

                            <div className='w-75 p-2 m-1 border border-secondary rounded-pill fs-1'>{`${device.uniqueId}`}</div>
                        </div>

                        {position && (
                            <CardContent className={`${classes.content}`}>
                                <Table size="small" classes={{ root: classes.table }}>
                                    <TableBody>
                                        {positionItems.split(',').filter((key) => Boolean(position && (position[key] !== undefined || position.attributes?.[key] !== undefined))).map((key) => (
                                            <StatusRow
                                                key={key}
                                                name={positionAttributes.hasOwnProperty(key) ? positionAttributes[key].name : key}
                                                content={(
                                                    <PositionValue
                                                        position={position}
                                                        property={position.hasOwnProperty(key) ? key : null}
                                                        attribute={position.hasOwnProperty(key) ? null : key}
                                                    />
                                                )}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        )}
                        <CardActions classes={{ root: classes.actions }} disableSpacing>
                            <IconButton
                                onClick={() => position?.id && navigate(`/position/${position.id}`)}
                                disabled={!position}
                            >
                                <LoupeIcon />
                            </IconButton>
                            <IconButton
                                onClick={Compatilhar}
                                disabled={!position}
                            >
                                <ShareIcon />
                            </IconButton>

                            <PopupExample />

                            <IconButton
                                onClick={() => navigate('/replay')}
                                disabled={disableActions || !position}
                            >
                                <ReplayIcon />
                            </IconButton>

                            {/* Envío general de comandos (solo si NO está limitado) */}
                            {!limitCommands && !deviceReadonly && (
                                <Tooltip title={t('deviceCommand')}>
                                    <IconButton
                                        onClick={() => navigate(`/settings/device/${deviceId}/command`)}
                                        disabled={disableActions}
                                    >
                                        <PublishIcon />
                                    </IconButton>
                                </Tooltip>
                            )}

                            {/* Comandos Rápidos Blindados estilo Wialon: Motor (solo si tiene corte instalado) */}
                            {!deviceReadonly && hasEngineCut && (
                                <>
                                    <Tooltip title="Bloquear Motor (Corte de Combustible)">
                                        <IconButton
                                            onClick={() => openSecurityCommand('engineStop')}
                                            disabled={disableActions}
                                            color="error"
                                        >
                                            <LockIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Restaurar Motor (Habilitar Combustible)">
                                        <IconButton
                                            onClick={() => openSecurityCommand('engineResume')}
                                            disabled={disableActions}
                                            color="success"
                                        >
                                            <LockOpenIcon />
                                        </IconButton>
                                    </Tooltip>
                                </>
                            )}

                            {/* Reinicio Remoto del GPS (para todos los que tengan permisos de comando) */}
                            {!deviceReadonly && (
                                <Tooltip title="Reiniciar Rastreador GPS">
                                    <IconButton
                                        onClick={() => openSecurityCommand('rebootDevice')}
                                        disabled={disableActions}
                                        color="warning"
                                    >
                                        <RestartAltIcon />
                                    </IconButton>
                                </Tooltip>
                            )}

                            <IconButton
                                onClick={() => navigate(`/settings/device/${deviceId}`)}
                                disabled={disableActions || deviceReadonly}
                            >
                                <EditIcon />
                            </IconButton>
                        </CardActions>
                    </Card>
                </Draggable>
            </div>
            {position && (
                <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                    <MenuItem onClick={() => position?.id && navigate(`/position/${position.id}`)}><Typography color="secondary">{t('sharedShowDetails')}</Typography></MenuItem>
                    <MenuItem onClick={handleGeofence}>{t('sharedCreateGeofence')}</MenuItem>
                    <MenuItem component="a" target="_blank" href={`https://www.google.com/maps/search/?api=1&query=${position.latitude}%2C${position.longitude}`}>{t('linkGoogleMaps')}</MenuItem>
                    <MenuItem component="a" target="_blank" href={`http://maps.apple.com/?ll=${position.latitude},${position.longitude}`}>{t('linkAppleMaps')}</MenuItem>
                    <MenuItem component="a" target="_blank" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude}%2C${position.longitude}&heading=${position.course}`}>{t('linkStreetView')}</MenuItem>
                </Menu>
            )}
            <RemoveDialog
                open={removing}
                endpoint="devices"
                itemId={deviceId}
                onResult={(removed) => handleRemove(removed)}
            />
            {/* Modal de Confirmación y Seguridad de Comandos (Estándar Wialon) */}
            <QuickCommandSecurityModal
                open={securityModalOpen}
                onClose={() => setSecurityModalOpen(false)}
                device={device}
                position={position}
                actionType={selectedActionType}
            />
        </>
    );
};

export default StatusCard;
