import React, { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import * as XLSX from 'xlsx';

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 16,
    background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(2, 3),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  dropzone: {
    border: `2px dashed ${theme.palette.primary.main}`,
    borderRadius: 12,
    padding: theme.spacing(3),
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(14, 165, 233, 0.05)' : 'rgba(14, 165, 233, 0.03)',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(14, 165, 233, 0.08)',
      borderColor: theme.palette.secondary.main,
    },
  },
  tableContainer: {
    maxHeight: 260,
    overflowY: 'auto',
    marginTop: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
  },
  footerStats: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));

const ImportDevicesDialog = ({ open, onClose, onImportSuccess }) => {
  const classes = useStyles();
  const fileInputRef = useRef(null);

  const groups = useSelector((state) => state.groups.items);
  const currentUser = useSelector((state) => state.session.user);

  const [selectedUser, setSelectedUser] = useState(currentUser?.id || '');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [usersList, setUsersList] = useState([]);

  const [parsedDevices, setParsedDevices] = useState([]);
  const [existingImeis, setExistingImeis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Cargar lista de clientes/usuarios para el selector
  React.useEffect(() => {
    if (open) {
      fetch('/api/users')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setUsersList(data);
          if (!selectedUser && data.length > 0) {
            setSelectedUser(currentUser?.id || data[0].id);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  // Descargar plantilla oficial
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        placa: 'T3M-891',
        imei: '868204030123456',
        modelo: 'Teltonika FMB920',
        sim: '+51987654321',
        categoria: 'truck',
        odometro_km: 45000,
        limite_velocidad: 90,
        chofer: 'Juan Perez',
      },
      {
        placa: 'ABC-123',
        imei: '352093081234567',
        modelo: 'Coban TK303G',
        sim: '+51912345678',
        categoria: 'car',
        odometro_km: 12500,
        limite_velocidad: 100,
        chofer: 'Carlos Rojas',
      },
      {
        placa: 'MOTO-01',
        imei: '012345678901234',
        modelo: 'Concox GT06',
        sim: '+51944556677',
        categoria: 'motorcycle',
        odometro_km: 3000,
        limite_velocidad: 80,
        chofer: 'Luis Gomez',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dispositivos');
    XLSX.writeFile(wb, 'Plantilla_Importacion_GeoZoone.xlsx');
  };

  // Procesar archivo Excel o CSV
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);
    setValidating(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        setStatusMessage({ type: 'warning', text: 'El archivo no contiene filas con datos.' });
        setValidating(false);
        return;
      }

      // Normalizar nombres de columnas (tolerancia a acentos, mayúsculas y nombres de OpenGTS)
      const normalized = rawRows.map((row, index) => {
        const getVal = (...keys) => {
          for (const k of keys) {
            for (const rk of Object.keys(row)) {
              if (rk.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                return String(row[rk]).trim();
              }
            }
          }
          return '';
        };

        const name = getVal('placa', 'name', 'nombre', 'deviceid', 'descripcion', 'description', 'vehiculo');
        const uniqueId = getVal('imei', 'uniqueid', 'idunico', 'unique_id', 'serial', 'imeinumber', 'id');
        const model = getVal('modelo', 'model', 'equipmenttype', 'gps');
        const phone = getVal('sim', 'phone', 'telefono', 'celular', 'simphonenumber');
        const contact = getVal('chofer', 'contact', 'conductor', 'contacto');
        const category = getVal('categoria', 'category', 'tipo', 'vehicletype') || 'car';
        const odometro = getVal('odometrokm', 'odometro', 'odometer');
        const velocidad = getVal('limitevelocidad', 'velocidad', 'speedlimit');

        return {
          id: index + 1,
          name,
          uniqueId,
          model,
          phone,
          contact,
          category: category.toLowerCase(),
          odometro_km: odometro,
          limite_velocidad: velocidad,
        };
      });

      setParsedDevices(normalized);

      // Pre-validar IMEIs contra el backend para semáforo visual
      const imeis = normalized.map((d) => d.uniqueId).filter(Boolean);
      try {
        const valRes = await fetch('/modulo/devices/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imeis }),
        });
        if (valRes.ok) {
          const valData = await valRes.json();
          setExistingImeis(valData.existingImeis || []);
        }
      } catch (err) {
        console.warn('No se pudo validar IMEIs previos:', err);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: `Error al leer archivo: ${err.message}` });
    } finally {
      setValidating(false);
    }
  };

  // Enviar importación masiva al backend
  const handleConfirmImport = async () => {
    if (parsedDevices.length === 0) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch('/modulo/devices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devices: parsedDevices,
          userId: selectedUser || currentUser?.id,
          groupId: selectedGroup || null,
          updateExisting,
        }),
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        setStatusMessage({
          type: 'success',
          text: `¡Importación completada! ${resData.inserted} vehículos creados, ${resData.updated || 0} actualizados, ${resData.skipped || 0} omitidos.`,
        });

        setTimeout(() => {
          if (onImportSuccess) onImportSuccess();
          handleClose();
        }, 1800);
      } else {
        throw new Error(resData.error || 'Error desconocido al importar flota.');
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setParsedDevices([]);
    setExistingImeis([]);
    setStatusMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  // Contadores de validación
  const validCount = parsedDevices.filter((d) => d.name && d.uniqueId && !existingImeis.includes(d.uniqueId)).length;
  const existingCount = parsedDevices.filter((d) => existingImeis.includes(d.uniqueId)).length;
  const invalidCount = parsedDevices.filter((d) => !d.name || !d.uniqueId).length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth classes={{ paper: classes.dialogPaper }}>
      <DialogTitle className={classes.header}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <CloudUploadIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h6" fontWeight="bold">
            Importación Masiva de Dispositivos (Excel / CSV)
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadTemplate}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Plantilla Oficial (.xlsx)
          </Button>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5 }}>
        {statusMessage && (
          <Alert severity={statusMessage.type} sx={{ mb: 2, borderRadius: 2 }}>
            {statusMessage.text}
          </Alert>
        )}

        {/* Selectores de asignación masiva */}
        <Box display="flex" gap={2} mb={2.5}>
          <FormControl fullWidth size="small">
            <InputLabel id="select-user-label">Asignar a Cliente / Empresa</InputLabel>
            <Select
              labelId="select-user-label"
              value={selectedUser}
              label="Asignar a Cliente / Empresa"
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              {usersList.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name} ({u.email || u.login})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="select-group-label">Asignar a Grupo (Opcional)</InputLabel>
            <Select
              labelId="select-group-label"
              value={selectedGroup}
              label="Asignar a Grupo (Opcional)"
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <MenuItem value="">
                <em>Ninguno (Sin Grupo)</em>
              </MenuItem>
              {Object.values(groups || {}).map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Zona Drag & Drop */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <Box className={classes.dropzone} onClick={() => fileInputRef.current?.click()}>
          <CloudUploadIcon color="primary" sx={{ fontSize: 44, mb: 1, opacity: 0.9 }} />
          <Typography variant="subtitle1" fontWeight="bold">
            Arrastra y suelta tu archivo Excel (.xlsx, .xls) o CSV (.csv) aquí
          </Typography>
          <Typography variant="body2" color="textSecondary">
            o haz clic para explorar tus documentos
          </Typography>
        </Box>

        {validating && (
          <Box mt={2}>
            <Typography variant="body2" color="textSecondary" mb={0.5}>
              Analizando archivo y validando duplicados...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {/* Tabla de Vista Previa */}
        {parsedDevices.length > 0 && (
          <Box className={classes.tableContainer}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Estado</TableCell>
                  <TableCell>Placa / Nombre</TableCell>
                  <TableCell>IMEI / ID GPS</TableCell>
                  <TableCell>Modelo</TableCell>
                  <TableCell>SIM / Teléfono</TableCell>
                  <TableCell>Categoría</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsedDevices.map((dev) => {
                  const isExisting = existingImeis.includes(dev.uniqueId);
                  const isInvalid = !dev.name || !dev.uniqueId;

                  return (
                    <TableRow key={dev.id} hover>
                      <TableCell>
                        {isInvalid ? (
                          <Chip
                            size="small"
                            icon={<ErrorOutlineIcon />}
                            label="Falta Placa o IMEI"
                            color="error"
                            variant="outlined"
                          />
                        ) : isExisting ? (
                          <Chip
                            size="small"
                            icon={<WarningAmberIcon />}
                            label="IMEI ya existe"
                            color="warning"
                            variant="outlined"
                          />
                        ) : (
                          <Chip
                            size="small"
                            icon={<CheckCircleIcon />}
                            label="Válido"
                            color="success"
                            variant="filled"
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{dev.name || '—'}</TableCell>
                      <TableCell>{dev.uniqueId || '—'}</TableCell>
                      <TableCell>{dev.model || '—'}</TableCell>
                      <TableCell>{dev.phone || '—'}</TableCell>
                      <TableCell>{dev.category || 'car'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Opciones adicionales */}
        {parsedDevices.length > 0 && (
          <Box mt={1.5} display="flex" justifyContent="space-between" alignItems="center">
            <FormControlLabel
              control={
                <Checkbox
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  color="primary"
                />
              }
              label="Actualizar datos si el IMEI ya existe en el sistema"
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
        <Box className={classes.footerStats}>
          {parsedDevices.length > 0 && (
            <Typography variant="body2" color="textSecondary">
              <b>{validCount}</b> listos para importar
              {existingCount > 0 && ` • ${existingCount} existentes`}
              {invalidCount > 0 && ` • ${invalidCount} incompletos`}
            </Typography>
          )}
        </Box>
        <Box display="flex" gap={1.5}>
          <Button onClick={handleClose} disabled={loading} color="inherit">
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={loading || parsedDevices.length === 0 || (validCount === 0 && !updateExisting)}
            onClick={handleConfirmImport}
            sx={{ borderRadius: 2, px: 3, fontWeight: 'bold' }}
          >
            {loading ? 'Importando Flota...' : `Confirmar e Importar ${validCount + (updateExisting ? existingCount : 0)} Vehículos`}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ImportDevicesDialog;
