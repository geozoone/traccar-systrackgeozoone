import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
    Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import ReportFilter from './components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import { useCatch } from '../reactHelper';
import MapView, { map } from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import useReportStyles from './common/useReportStyles';
import TableShimmer from '../common/components/TableShimmer';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import { formatTime } from '../common/util/formatter';
import { usePreference } from '../common/util/preferences';
import { prefixString } from '../common/util/stringUtils';
import MapMarkers from '../map/MapMarkers';

const CombinedReportPage = () => {
    const classes = useReportStyles();
    const t = useTranslation();

    const devices = useSelector((state) => state.devices.items);

    const hours12 = usePreference('twelveHourFormat');

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modo de visualización: 'split' (dividido 50/50), 'map' (mapa completo 100%), 'table' (solo tabla)
    const [viewMode, setViewMode] = useState('split');

    // Reajustar el canvas del mapa al cambiar entre modos para evitar márgenes vacíos
    useEffect(() => {
        if (items.length > 0) {
            const timer = setTimeout(() => {
                try {
                    map.resize();
                } catch (e) {}
            }, 120);
            return () => clearTimeout(timer);
        }
    }, [viewMode, items.length]);

    const createMarkers = () => items.flatMap((item) => item.events
        .map((event) => item.positions.find((p) => event.positionId === p.id))
        .filter((position) => position != null)
        .map((position) => ({
            latitude: position.latitude,
            longitude: position.longitude,
        })));

    const handleSubmit = useCatch(async ({ deviceIds, groupIds, from, to }) => {
        const query = new URLSearchParams({ from, to });
        deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
        groupIds.forEach((groupId) => query.append('groupId', groupId));
        setLoading(true);
        try {
            const response = await fetch(`/api/reports/combined?${query.toString()}`);
            if (response.ok) {
                setItems(await response.json());
            } else {
                throw Error(await response.text());
            }
        } finally {
            setLoading(false);
        }
    });

    return (
        <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportCombined']}>
            <div className={classes.container}>
                {Boolean(items.length) && (
                    <div
                        className={classes.containerMap}
                        style={{
                            position: 'relative',
                            transition: 'all 0.25s ease',
                            ...(viewMode === 'map' ? { height: '100%', flex: 1, flexBasis: '100%' } : {}),
                            ...(viewMode === 'split' ? { height: '50%', flexBasis: '50%', flexShrink: 0 } : {}),
                            ...(viewMode === 'table' ? { display: 'none' } : {}),
                        }}
                    >
                        {/* Selector Flotante de Modos de Vista */}
                        <div
                            style={{
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                zIndex: 10,
                                display: 'flex',
                                backgroundColor: 'rgba(15, 23, 42, 0.90)',
                                backdropFilter: 'blur(8px)',
                                padding: '4px',
                                borderRadius: '8px',
                                boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
                                gap: '4px',
                                border: '1px solid rgba(255,255,255,0.15)',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setViewMode('map')}
                                style={{
                                    background: viewMode === 'map' ? '#0284c7' : 'transparent',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}
                                title="Ver el mapa completo al 100% (minimiza la tabla inferior)"
                            >
                                🗖 Mapa Completo
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('split')}
                                style={{
                                    background: viewMode === 'split' ? '#0284c7' : 'transparent',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}
                                title="Dividir vista: mapa arriba y tabla de eventos abajo"
                            >
                                ◫ Dividido
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('table')}
                                style={{
                                    background: viewMode === 'table' ? '#0284c7' : 'transparent',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}
                                title="Ver solo la tabla de eventos"
                            >
                                📄 Solo Tabla
                            </button>
                        </div>

                        {/* Botón flotante para restaurar tabla cuando se está en modo Mapa Completo */}
                        {viewMode === 'map' && (
                            <button
                                type="button"
                                onClick={() => setViewMode('split')}
                                style={{
                                    position: 'absolute',
                                    bottom: 16,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 10,
                                    backgroundColor: '#0f172a',
                                    color: '#ffffff',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    padding: '8px 18px',
                                    borderRadius: '9999px',
                                    boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }}
                            >
                                <span>📊</span>
                                <span>Restaurar Tabla y Filtros ▼</span>
                            </button>
                        )}

                        <MapView>
                            <MapGeofence />
                            {items.map((item) => (
                                <React.Fragment key={item.deviceId}>
                                    <MapRoutePath
                                        name={devices[item.deviceId]?.name}
                                        coordinates={item.route}
                                        positions={item.positions}
                                    />
                                    {item.positions && Boolean(item.positions.length) && (
                                        <MapRoutePoints positions={item.positions} />
                                    )}
                                </React.Fragment>
                            ))}
                            <MapMarkers markers={createMarkers()} />
                        </MapView>
                        <MapCamera coordinates={items.flatMap((item) => item.route)} />
                    </div>
                )}
                <div
                    className={classes.containerMain}
                    style={{
                        transition: 'all 0.25s ease',
                        ...(viewMode === 'map' ? { display: 'none' } : {}),
                        ...(viewMode === 'split' ? { flex: 1, overflow: 'auto' } : {}),
                        ...(viewMode === 'table' ? { height: '100%', flex: 1, overflow: 'auto' } : {}),
                    }}
                >
                    {/* Botón para regresar a mapa cuando se está en modo 'Solo Tabla' */}
                    {viewMode === 'table' && Boolean(items.length) && (
                        <div style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setViewMode('split')}
                                style={{
                                    background: '#0284c7',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '6px 14px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                🗺️ Ver Mapa y Ruta (◫ Dividido)
                            </button>
                        </div>
                    )}
                    <div className={classes.header}>
                        <ReportFilter handleSubmit={handleSubmit} showOnly multiDevice includeGroups />
                    </div>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('sharedDevice')}</TableCell>
                                <TableCell>{t('positionFixTime')}</TableCell>
                                <TableCell>{t('sharedType')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {!loading ? items.flatMap((item) => item.events.map((event, index) => (
                                <TableRow key={event.id}>
                                    <TableCell>{index ? '' : devices[item.deviceId].name}</TableCell>
                                    <TableCell>{formatTime(event.eventTime, 'seconds', hours12)}</TableCell>
                                    <TableCell>{t(prefixString('event', event.type))}</TableCell>
                                </TableRow>
                            ))) : (<TableShimmer columns={3} />)}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </PageLayout>
    );
};

export default CombinedReportPage;
