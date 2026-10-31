import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableRow, TableCell, TableHead, TableBody, Box, Button,
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

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'deviceTitle']}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1 }}>
        <Box flexGrow={1}>
          <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />
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
            <TableCell>{t('userExpirationTime')}</TableCell>
            <TableCell className={classes.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {!loading ? items.filter(filterByKeyword(searchKeyword)).map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.uniqueId}</TableCell>
              <TableCell>{item.groupId ? groups[item.groupId]?.name : null}</TableCell>
              <TableCell>{item.phone}</TableCell>
              <TableCell>{item.model}</TableCell>
              <TableCell>{item.contact}</TableCell>
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
          )) : (<TableShimmer columns={7} endAction />)}
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
