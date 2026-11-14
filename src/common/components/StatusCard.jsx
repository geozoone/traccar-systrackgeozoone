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
import FollowTheSignsIcon from '@mui/icons-material/FollowTheSigns';

const useStyles = makeStyles((theme) => ({
    card: {
        pointerEvents: 'auto',
        width: '350px'//theme.dimensions.popupMaxWidth,
    },
    boxImagen: {
        width: '100%',
        padding: "10px"
    },
    media: {
        height: theme.dimensions.popupImageHeight,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-start'
    },
    boxInfo: {
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        fontSize: '12px',
        textAlign: 'center'
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
        textAlign: 'center'
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

const Icons = (name) => {
    const classes = useStyles();

    switch (name) {
        case 'Nível de Bateria':
            name = <BatteryFullIcon />;
            break;

        case 'Ignição':
            name = <KeyIcon />;
            break;

        case 'Hora do dispositivo':
            name = <QueryBuilderIcon />;
            break;

        case 'Velocidade':
            name = <SpeedIcon />;
            break;

        case 'Endereço':
            name = <MarkunreadMailboxIcon />;
            break;

        case 'Distância total':
            name = <SocialDistanceIcon />
            break;

        case 'Movimento':
            name = <FollowTheSignsIcon />
            break;

        case 'Direção':
            name = <SignpostIcon />
            break;

        case 'Bloqueado':
            name = <LockIcon />;
            break;


    }
    return name;
}

const StatusRow = ({ name, content }) => {
    const classes = useStyles();

    return (
        <TableRow className='border-bottom border-3'>
            <TableCell className={`${classes.cell}`}>
                <Typography variant="body2" >{Icons(name)}</Typography>
            </TableCell>

            <TableCell className={`${classes.cell2}`}>
                <Typography variant="body2" >{name}</Typography>
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
        const newItem = {
            name: 'Ancora (' + (device.name) + ')',
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
    }, [navigate, position]);

    const Compatilhar = () => {
        let latitude = (position.latitude) ? position.latitude : null;
        let longitude = (position.longitude) ? position.longitude : null;

        window.open(`https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`, '_blank');
    }

    const PopupExample = () => (

        <Popup trigger={AnchorIcon} >
            {close => (
                <div class="popup">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">CREAR ANCLAJE</h5>
                            <button type="button" class="close" className="close" onClick={close} data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <p>Quiere crear un ancla para el dispositivo. <br /><b>{device.name}</b> </p>

                            <table class="w-100">
                                {/* <tr>
                                    <td colspan="3" class="p-3 text-center">
                                        Bloquer
                                        <input type="radio" id="bloqueio" name="bloqueio" value="1" class="m-2" />
                                        Sim
                                        <input type="radio" id="bloqueio" name="bloqueio" value="0" class="m-2" />
                                        Não
                                    </td>
                                </tr> */}
                                <tr>
                                    <td class="p-2"><input type="radio" id="mt" name="mt" value="5" class="m-2" />5 mt</td>
                                    <td class="p-2"><input type="radio" id="mt" name="mt" value="10" class="m-2" />10 mt</td>
                                    <td class="p-2"><input type="radio" id="mt" name="mt" value="20" class="m-2" />20 mt</td>
                                </tr>
                                <tr>
                                    <td class="p-2"><input type="radio" id="mt" name="mt" value="50" class="m-2" />50 mt</td>
                                    <td class="p-2"><input type="radio" id="mt" name="mt" value="100" class="m-2" />100 mt</td>
                                    <td class="p-2"><input type="radio" id="mt" name="mt" value="200" class="m-2" />200 mt</td>
                                </tr>
                            </table>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onClick={CeiarAncora}>CREAR</button>
                        </div>
                    </div>
                </div>
            )}
        </Popup>
    );

    const CeiarAncora = useCatchCallback(async () => {
        const metros = document.getElementsByName("mt");

        let mt = 5;

        for (let i = 0; i < metros.length; i++) {
            if (metros[i].checked)
                mt = metros[i].value;
        }

        // const bloqueio = document.getElementsByName("bloqueio");

        // let blok = 0;

        // for (let i = 0; i < bloqueio.length; i++) {
        //     if(bloqueio[i].checked)   
        //        blok = bloqueio[i].value;
        // }

        const newItem = {
            name: 'Ancora (' + (device.name) + ')',
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
    }, [navigate, position]);

    const veiculo = (device.attributes.veiculo == undefined && {} || device.attributes.veiculo);

    return (
        <>
            <div className={classes.root}>
                {device && (
                    <Draggable
                        handle={`.${classes.media}, .${classes.header}`}
                    >
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
                                    >
                                    </CardMedia>
                                </div>
                            )}

                            <div className={classes.boxInfo}>
                                {Object.keys(veiculo).length && veiculo.marca && veiculo.modelo && device.contact && (
                                    <div className='w-75 p-2 m-1 border border-secondary rounded-pill fs-1'>
                                        {veiculo.marca} {veiculo.modelo} / Placa {device.contact}
                                    </div>
                                ) || ''}

                                <div className='w-75 p-2 m-1 border border-secondary rounded-pill fs-1'>{`${device.uniqueId}`}</div>
                            </div>

                            {position && (
                                <CardContent className={`${classes.content}`}>
                                    <Table size="small" classes={`${{ root: classes.table }} border border-primary`}>
                                        <TableBody>
                                            {positionItems.split(',').filter((key) => position.hasOwnProperty(key) || position.attributes.hasOwnProperty(key)).map((key) => (
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
                                    onClick={() => navigate(`/position/${position.id}`)}
                                >
                                    <LoupeIcon />
                                </IconButton>
                                <IconButton
                                    onClick={Compatilhar}
                                >
                                    <ShareIcon />
                                </IconButton>

                                {/* <IconButton
                                    onClick={handleGeofence}
                                >
                                    <ShareLocationIcon />
                                </IconButton> */}

                                <IconButton>
                                    <PopupExample />
                                </IconButton>

                                {/* <IconButton
                                    color="secondary"
                                    onClick={(e) => setAnchorEl(e.currentTarget)}
                                    disabled={!position}
                                >
                                    <PendingIcon />
                                </IconButton> */}

                                <IconButton
                                    onClick={() => navigate('/replay')}
                                    disabled={disableActions || !position}
                                >
                                    <ReplayIcon />
                                </IconButton>
                                <IconButton
                                    onClick={() => navigate(`/settings/device/${deviceId}/command`)}
                                    disabled={disableActions}
                                >
                                    <PublishIcon />
                                </IconButton>

                                {/* Button Bloqueio é Desbloqueio */}
                                <IconButton
                                    onClick={() => bloaqueio(deviceId)}
                                    disabled={disableActions || deviceReadonly}
                                >
                                    <Padlock />
                                </IconButton>

                                <IconButton
                                    onClick={() => navigate(`/settings/device/${deviceId}`)}
                                    disabled={disableActions || deviceReadonly}
                                >
                                    <EditIcon />
                                </IconButton>

                                {/* <IconButton
                                    onClick={() => setRemoving(true)}
                                    disabled={disableActions || deviceReadonly}
                                    className={classes.delete}
                                >
                                    <DeleteIcon />
                                </IconButton> */}
                            </CardActions>
                        </Card>
                    </Draggable>
                )}
            </div>
            {position && (

                <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                    <MenuItem onClick={() => navigate(`/position/${position.id}`)}><Typography color="secondary">{t('sharedShowDetails')}</Typography></MenuItem>
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
        </>
    );
};

export default StatusCard;
