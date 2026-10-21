import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import makeStyles from '@mui/styles/makeStyles';
import {
	IconButton, Tooltip, Avatar, ListItemAvatar, ListItemText, ListItemButton,
} from '@mui/material';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import Battery60Icon from '@mui/icons-material/Battery60';
import BatteryCharging60Icon from '@mui/icons-material/BatteryCharging60';
import Battery20Icon from '@mui/icons-material/Battery20';
import BatteryCharging20Icon from '@mui/icons-material/BatteryCharging20';
import ErrorIcon from '@mui/icons-material/Error';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { devicesActions } from '../store';
import {
	formatAlarm, formatBoolean, formatPercentage, formatStatus, getStatusColor,
} from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { mapIconKey, mapIcons } from '../map/core/preloadImages';
import { useAdministrator } from '../common/util/permissions';
import { ReactComponent as EngineIcon } from '../resources/images/data/engine.svg';
import { useAttributePreference } from '../common/util/preferences';

import KeyIcon from '@mui/icons-material/Key';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import NavigationIcon from '@mui/icons-material/Navigation';

dayjs.extend(relativeTime);

const useStyles = makeStyles((theme) => ({
	icon: {
		width: '25px',
		height: '25px',
		filter: 'brightness(0) invert(1)',
	},
	batteryText: {
		fontSize: '0.75rem',
		fontWeight: 'normal',
		lineHeight: '0.875rem',
	},
	success: {
		color: theme.palette.success.main,
	},
	warning: {
		color: theme.palette.warning.main,
	},
	error: {
		color: theme.palette.error.main,
	},
	neutral: {
		color: theme.palette.neutral.main,
	},
}));

const DeviceRow = ({ data, index, style }) => {
	const classes = useStyles();
	const dispatch = useDispatch();
	const t = useTranslation();

	const admin = useAdministrator();

	const item = data[index];
	const position = useSelector((state) => state.session.positions[item.id]);

	const devicePrimary = useAttributePreference('devicePrimary', 'name');
	const deviceSecondary = useAttributePreference('deviceSecondary', '');

	const veiculo = (item.attributes.veiculo == undefined && {} || item.attributes.veiculo);

	const secondaryText = () => {
		let status;
		if (item.status === 'online' || !item.lastUpdate) {
			status = formatStatus(item.status, t);
		} else {
			status = dayjs(item.lastUpdate).fromNow();
		}

		return (
			<>
				{/* {deviceSecondary && item[deviceSecondary] && `${item[deviceSecondary]} • `} */}
				{(Object.keys(veiculo).length && veiculo.cliente && `${item.attributes.veiculo.cliente}  • ` || (deviceSecondary && item[deviceSecondary] && `${item[deviceSecondary]}  • `))}
				<span className={classes[getStatusColor(item.status)]}>{status}</span>
			</>
		);
	};

	return (
		<div style={style}>
			<ListItemButton
				className='border-bottom'
				key={item.id}
				onClick={() => dispatch(devicesActions.selectId(item.id))}
				disabled={!admin && item.disabled}
			>
				<ListItemAvatar>
					<Avatar>
						<img className={classes.icon} src={mapIcons[mapIconKey(item.category)]} alt="" />
					</Avatar>
				</ListItemAvatar>
				<ListItemText
					primary={
						(Object.keys(veiculo).length &&
						     item.attributes.veiculo.marca && item.contact &&`${item.attributes.veiculo.marca} ${item.attributes.veiculo.modelo} / Placa ${item.contact}`
							|| `${item[devicePrimary]}`)
						} //${item[devicePrimary]}
					primaryTypographyProps={{ noWrap: true }}
					secondary={secondaryText()}
					secondaryTypographyProps={{ noWrap: true }}
				/>
				{position && (
					<>
						{position.attributes.hasOwnProperty('alarm') && (
							<Tooltip title={`${t('eventAlarm')}: ${formatAlarm(position.attributes.alarm, t)}`}>
								<IconButton size="small">
									<ReportGmailerrorredIcon fontSize="small" className={classes.error} />
								</IconButton>
							</Tooltip>
						)}
						{position.attributes.hasOwnProperty('ignition') && (
							<Tooltip title={`${t('positionIgnition')}: ${formatBoolean(position.attributes.ignition, t)}`}>
								<IconButton size="small">
									{position.attributes.ignition ? (
										<KeyIcon width={20} height={20} className={classes.success} />
									) : (
										<KeyIcon width={20} height={20} className={classes.neutral} />
									)}
								</IconButton>
							</Tooltip>
						)}

						{position.attributes.hasOwnProperty('motion') && (
							<Tooltip title={`${t('positionMotion')}: ${formatBoolean(position.attributes.motion, t)}`}>
								<IconButton size="small">
									{position.attributes.motion ? (
										<NavigationIcon width={20} height={20} className='text-success' />
									) : (
										<NavigationIcon width={20} height={20} className='text-muted' />
									)}
								</IconButton>
							</Tooltip>
						)}

						{position.attributes.hasOwnProperty('blocked') && (
							<Tooltip title={`${t('positionBlocked')}: ${formatBoolean(position.attributes.blocked, t)}`}>
								<IconButton size="small">
									{position.attributes.blocked ? (
										<LockOpenIcon width={20} height={20} className='text-danger' />
									) : (
										<LockOpenIcon width={20} height={20} className='text-muted' />
									)}
								</IconButton>
							</Tooltip>
						)}

						{position.attributes.hasOwnProperty('batteryLevel') && (
							<Tooltip title={`${t('positionBatteryLevel')}: ${formatPercentage(position.attributes.batteryLevel)}`}>
								<IconButton size="small">
									{position.attributes.batteryLevel > 70 ? (
										position.attributes.charge
											? (<BatteryChargingFullIcon fontSize="small" className={classes.success} />)
											: (<BatteryFullIcon fontSize="small" className={classes.success} />)
									) : position.attributes.batteryLevel > 30 ? (
										position.attributes.charge
											? (<BatteryCharging60Icon fontSize="small" className={classes.warning} />)
											: (<Battery60Icon fontSize="small" className={classes.warning} />)
									) : (
										position.attributes.charge
											? (<BatteryCharging20Icon fontSize="small" className={classes.error} />)
											: (<Battery20Icon fontSize="small" className={classes.error} />)
									)}
								</IconButton>
							</Tooltip>
						)}
					</>
				)}
			</ListItemButton>
		</div>
	);
};

export default DeviceRow;
