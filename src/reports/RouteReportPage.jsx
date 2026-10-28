import React, { Fragment, useCallback, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    IconButton, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import ReportFilter from './components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import PositionValue from '../common/components/PositionValue';
import ColumnSelect from './components/ColumnSelect';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import { useCatch } from '../reactHelper';
import MapView, { map } from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapPositions from '../map/MapPositions';
import useReportStyles from './common/useReportStyles';
import TableShimmer from '../common/components/TableShimmer';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import scheduleReport from './common/scheduleReport';

const RouteReportPage = () => {
    const navigate = useNavigate();
    const classes = useReportStyles();
    const t = useTranslation();

    const positionAttributes = usePositionAttributes(t);

    const devices = useSelector((state) => state.devices.items);

    const [available, setAvailable] = useState([]);
    const [columns, setColumns] = useState(['fixTime', 'latitude', 'longitude', 'speed', 'address']);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

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

    const onMapPointClick = useCallback((positionId) => {
        setSelectedItem(items.find((it) => it.id === positionId));
    }, [items, setSelectedItem]);

    const handleSubmit = useCatch(async ({ deviceIds, from, to, type }) => {
        const query = new URLSearchParams({ from, to });
        deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
        if (type === 'export') {
            window.location.assign(`/api/reports/route/xlsx?${query.toString()}`);
        } else if (type === 'mail') {
            const response = await fetch(`/api/reports/route/mail?${query.toString()}`);
            if (!response.ok) {
                throw Error(await response.text());
            }
        } else {
            setLoading(true);
            try {
                const response = await fetch(`/api/reports/route?${query.toString()}`, {
                    headers: { Accept: 'application/json' },
                });
                if (response.ok) {
                    setItems(await response.json());
                } else {
                    throw Error(await response.text());
                }
            } finally {
                setLoading(false);
            }
        }
    });

    const handleSchedule = useCatch(async (deviceIds, groupIds, report) => {
        report.type = 'route';
        const error = await scheduleReport(deviceIds, groupIds, report);
        if (error) {
            throw Error(error);
        } else {
            navigate('/reports/scheduled');
        }
    });

    return (
        <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportRoute']}>
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
                                title="Dividir vista: mapa arriba y tabla de posiciones abajo"
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
                                title="Ver solo la tabla de coordenadas"
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
                            {[...new Set(items.map((it) => it.deviceId))].map((deviceId) => {
                                const positions = items.filter((position) => position.deviceId === deviceId);
                                return (
                                    <Fragment key={deviceId}>
                                        <MapRoutePath positions={positions} />
                                        <MapRoutePoints positions={positions} onClick={onMapPointClick} />
                                    </Fragment>
                                );
                            })}
                            {selectedItem && (
                                <MapPositions positions={[selectedItem]} titleField="fixTime" />
                            )}
                        </MapView>
                        <MapCamera positions={items} />
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
                        <ReportFilter handleSubmit={handleSubmit} handleSchedule={handleSchedule} multiDevice>
                            <ColumnSelect
                                columns={columns}
                                setColumns={setColumns}
                                columnsArray={available}
                                rawValues
                                disabled={!items.length}
                            />
                        </ReportFilter>
                    </div>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell className={classes.columnAction} />
                                <TableCell>{t('sharedDevice')}</TableCell>
                                {columns.map((key) => (<TableCell key={key}>{positionAttributes[key]?.name || key}</TableCell>))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {!loading ? items.slice(0, 4000).map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className={classes.columnAction} padding="none">
                                        {selectedItem === item ? (
                                            <IconButton size="small" onClick={() => setSelectedItem(null)}>
                                                <GpsFixedIcon fontSize="small" />
                                            </IconButton>
                                        ) : (
                                            <IconButton size="small" onClick={() => setSelectedItem(item)}>
                                                <LocationSearchingIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </TableCell>
                                    <TableCell>{devices[item.deviceId].name}</TableCell>
                                    {columns.map((key) => (
                                        <TableCell key={key}>
                                            <PositionValue
                                                position={item}
                                                property={item.hasOwnProperty(key) ? key : null}
                                                attribute={item.hasOwnProperty(key) ? null : key}
                                            />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            )) : (<TableShimmer columns={columns.length + 2} startAction />)}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </PageLayout>
    );
};

export default RouteReportPage;
