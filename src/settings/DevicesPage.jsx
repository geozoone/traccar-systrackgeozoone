import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableRow, TableCell, TableHead, TableBody, Box, Button, Chip, Tooltip, Typography,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useEffectAsync } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import CollectionFab from './components/CollectionFab';
import CollectionActions from './components/CollectionActions';
import TableShimmer from '../common/components/TableShimmer';
import SearchHeader, { filterByKeyword } from './components/SearchHeader';
import ImportDevicesDialog from './components/ImportDevicesDialog';
import { usePreference } from '../common/util/preferences';
import { formatTime } from '../common/util/formatter';
import { useDeviceReadonly, useCliente } from '../common/util/permissions';
import useSettingsStyles from './common/useSettingsStyles';

const DevicesPage = () => {
  const classes = useSettingsStyles();
  const navigate = useNavigate();
  const t = useTranslation();

  const groups = useSelector((state) => state.groups.items);

  const hours12 = usePreference('twelveHourFormat');

  const deviceReadonly = useDeviceReadonly();
  const cliente = useCliente();

  const [timestamp, setTimestamp] = useState(Date.now());
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffectAsync(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/devices');
      if (response.ok) {
        setItems(await response.json());
      } else {
        throw Error(await response.text());
      }
    } finally {
      setLoading(false);
    }
  }, [timestamp]);

  const actionConnections = {
    key: 'connections',
    title: t('sharedConnections'),
    icon: <LinkIcon fontSize="small" />,
    handler: (deviceId) => navigate(`/settings/device/${deviceId}/connections`),
  };

  const [filterNoGroup, setFilterNoGroup] = useState(false);

  const orphanCount = items.filter((d) => !d.groupId).length;

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'deviceTitle']}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1, gap: 1 }}>
        <Box flexGrow={1} display="flex" alignItems="center" gap={1.5}>
          <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />
          {orphanCount > 0 && (
            <Chip
              label={`⚠️ ${orphanCount} Sin Grupo`}
              color={filterNoGroup ? 'warning' : 'default'}
              variant={filterNoGroup ? 'filled' : 'outlined'}
              onClick={() => setFilterNoGroup(!filterNoGroup)}
              title="Filtrar solo vehículos sin grupo asignado"
              sx={{ fontWeight: 'bold', cursor: 'pointer', height: 38 }}
            />
          )}
        </Box>
        {!deviceReadonly && !cliente && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<UploadFileIcon />}
            onClick={() => setImportOpen(true)}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              ml: 2,
              height: 42,
              px: 2.5,
              background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
              boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
            }}
          >
            Importar Excel / CSV
          </Button>
        )}
      </Box>
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('deviceIdentifier')}</TableCell>
            <TableCell>{t('groupParent')}</TableCell>
            <TableCell>{t('sharedPhone')}</TableCell>
            <TableCell>{t('deviceModel')}</TableCell>
            <TableCell>{t('deviceContact')}</TableCell>
            {!cliente && <TableCell>Notas / Instalación</TableCell>}
            <TableCell>{t('userExpirationTime')}</TableCell>
            <TableCell className={classes.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {!loading ? items
            .filter(filterByKeyword(searchKeyword))
            .filter((item) => (filterNoGroup ? !item.groupId : true))
            .map((item) => {
              const inst = (item.attributes && item.attributes.instalacion) || {};
              const notaTexto = inst.notas || (item.attributes && (item.attributes.notas || item.attributes.Notas)) || '';
              const resumenInstalacion = [
                notaTexto,
                inst.datosInstalacion ? `📍 ${inst.datosInstalacion}` : '',
                inst.instalador ? `👷 ${inst.instalador}` : '',
                inst.fechaInstalacion ? `📅 ${inst.fechaInstalacion}` : '',
              ].filter(Boolean).join(' • ');

              const tooltipDetalle = (
                <Box sx={{ p: 0.5, fontSize: '0.8rem', lineHeight: 1.5 }}>
                  {inst.fechaInstalacion && <div><b>📅 Fecha Inst.:</b> {inst.fechaInstalacion}</div>}
                  {inst.instalador && <div><b>👷 Instalador:</b> {inst.instalador}</div>}
                  {inst.lugarInstalacion && <div><b>🏙️ Lugar:</b> {inst.lugarInstalacion}</div>}
                  {inst.corteMotor && <div><b>⚡ Corte Motor:</b> {inst.corteMotor}</div>}
                  {inst.datosInstalacion && <div><b>📍 Ubicación GPS:</b> {inst.datosInstalacion}</div>}
                  {inst.accesorios && <div><b>🔌 Accesorios:</b> {inst.accesorios}</div>}
                  {inst.claveGps && <div><b>🔑 Clave SMS:</b> {inst.claveGps}</div>}
                  {inst.planSim && <div><b>📶 Plan SIM:</b> {inst.planSim}</div>}
                  {notaTexto && <div style={{ marginTop: 4 }}><b>📝 Notas:</b> {notaTexto}</div>}
                </Box>
              );

              return (
            <TableRow key={item.id} sx={!item.groupId ? { backgroundColor: 'rgba(239, 68, 68, 0.05)' } : {}}>
              <TableCell sx={{ fontWeight: 'bold' }}>{item.name}</TableCell>
              <TableCell>{item.uniqueId}</TableCell>
              <TableCell>
                {item.groupId ? (
                  groups[item.groupId]?.name || `Grupo #${item.groupId}`
                ) : (
                  <Chip size="small" label="⚠️ Sin Grupo" color="error" variant="outlined" sx={{ fontWeight: 'bold' }} />
                )}
              </TableCell>
              <TableCell>{item.phone}</TableCell>
              <TableCell>{item.model}</TableCell>
              <TableCell>{item.contact}</TableCell>
              {!cliente && (
                <TableCell sx={{ maxWidth: 240 }}>
                  {resumenInstalacion || inst.corteMotor ? (
                    <Tooltip title={tooltipDetalle} arrow placement="top">
                      <Box sx={{ cursor: 'help' }}>
                        {inst.corteMotor && inst.corteMotor.startsWith('Sí') && (
                          <Chip
                            size="small"
                            label="⚡ Relay"
                            color="info"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem', mr: 0.5, mb: 0.3, fontWeight: 'bold' }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.8rem',
                            color: 'text.secondary',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 220,
                          }}
                        >
                          {resumenInstalacion || inst.corteMotor}
                        </Typography>
                      </Box>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                  )}
                </TableCell>
              )}
              <TableCell>{formatTime(item.expirationTime, 'date', hours12)}</TableCell>
              <TableCell className={classes.columnAction} padding="none">
                <CollectionActions
                  itemId={item.id}
                  editPath="/settings/device"
                  endpoint="devices"
                  setTimestamp={setTimestamp}
                  customActions={[actionConnections]}
                  readonly={deviceReadonly}
                />
              </TableCell>
            </TableRow>
              );
            }) : (<TableShimmer columns={cliente ? 7 : 8} endAction />)}
        </TableBody>
      </Table>
      <CollectionFab editPath="/settings/device" disabled={deviceReadonly || !!cliente} />

      {/* Modal de Importación Masiva Excel / CSV */}
      <ImportDevicesDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImportSuccess={() => setTimestamp(Date.now())}
      />
    </PageLayout>
  );
};

export default DevicesPage;
