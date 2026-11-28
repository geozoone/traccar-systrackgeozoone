import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Chip,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import { geofencesActions } from '../../store';
import { map } from '../../map/core/MapView';
import FloatingStreetView from './FloatingStreetView';

const RADIUS_OPTIONS = [50, 100, 200, 500];
const SHARE_DURATION_OPTIONS = [
  { label: '1 Hora', hours: 1 },
  { label: '4 Horas', hours: 4 },
  { label: '24 Horas', hours: 24 },
  { label: '7 Días', hours: 168 },
];

const VehicleToolsBar = ({ device, position, address }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.session.user);

  const [streetViewOpen, setStreetViewOpen] = useState(false);
  const [geofenceOpen, setGeofenceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Estado de Geocerca Rápida
  const [geoName, setGeoName] = useState('');
  const [geoRadius, setGeoRadius] = useState(100);
  const [linkCurrentDevice, setLinkCurrentDevice] = useState(true);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [geoSuccess, setGeoSuccess] = useState('');

  // Estado de Compartir Ubicación
  const [shareHours, setShareHours] = useState(4);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  if (!device || !position || position.latitude == null || position.longitude == null) {
    return null;
  }

  const lat = Number(position.latitude);
  const lon = Number(position.longitude);
  const course = Math.round(Number(position.course || 0));
  const isReadonly = Boolean(user?.readonly || user?.deviceReadonly);

  // URL de Street View embebido sin API Key (orientado al rumbo del vehículo)
  const streetViewEmbedUrl = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lon}&cbp=12,${course},0,0,0&output=svembed`;
  const streetViewFullUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}&heading=${course}&pitch=0&fov=90`;

  const handleOpenGeofenceModal = () => {
    setGeoError('');
    setGeoSuccess('');
    if (!geoName && address && !address.includes('Obteniendo')) {
      const shortAddr = address.split(',')[0].trim();
      setGeoName(`Zona ${shortAddr.slice(0, 28)}`);
    }
    setGeofenceOpen(true);
  };

  const handleCreateQuickGeofence = async () => {
    const cleanName = (geoName || '').trim();
    if (!cleanName) {
      setGeoError('Ingresa un nombre para la geocerca.');
      return;
    }

    setGeoLoading(true);
    setGeoError('');
    setGeoSuccess('');

    try {
      // Formato WKT estándar de Traccar para geocerca circular: CIRCLE (lat lon, radiusMeters)
      const area = `CIRCLE (${lat.toFixed(6)} ${lon.toFixed(6)}, ${geoRadius})`;
      const response = await fetch('/api/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          description: `Creada desde ubicación de ${device.name} (${address || ''})`.trim(),
          area,
          attributes: {},
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || 'No se pudo crear la geocerca');
      }

      const createdGeo = await response.json();

      // Vincular automáticamente al vehículo actual si está marcado
      if (linkCurrentDevice && createdGeo?.id && device?.id) {
        await fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: device.id,
            geofenceId: createdGeo.id,
          }),
        }).catch(() => {});
      }

      // Actualizar store de geocercas para que se dibuje de inmediato en el mapa
      const listRes = await fetch('/api/geofences');
      if (listRes.ok) {
        const allGeos = await listRes.json();
        dispatch(geofencesActions.refresh(allGeos));
      }

      setGeoSuccess(`¡Geocerca "${cleanName}" (${geoRadius}m) creada y visible en el mapa!`);
      setTimeout(() => {
        setGeofenceOpen(false);
        setGeoSuccess('');
      }, 1400);
    } catch (err) {
      setGeoError(err.message || 'Error al guardar la geocerca');
    } finally {
      setGeoLoading(false);
    }
  };

  const handleOpenPolygonEditorHere = () => {
    setGeofenceOpen(false);
    try {
      map.jumpTo({
        center: [lon, lat],
        zoom: 17.5,
      });
    } catch {}
    navigate('/geofences');
  };

  const handleOpenShareModal = () => {
    setShareUrl('');
    setShareCopied(false);
    setShareOpen(true);
  };

  const handleGenerateShareLink = async (hours = shareHours) => {
    setShareLoading(true);
    setShareCopied(false);

    // 1. Motor propio de Visor Público en Vivo (/live/:token) con Marca Blanca del Revendedor
    try {
      const liveResp = await fetch('/modulo/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          deviceName: device.name,
          hours,
          createdBy: user?.email || user?.name || '',
        }),
      });
      if (liveResp.ok) {
        const data = await liveResp.json();
        if (data && data.token) {
          const liveLink = `${window.location.origin}/live/${encodeURIComponent(data.token)}`;
          setShareUrl(liveLink);
          setShareLoading(false);
          return;
        }
      }
    } catch {}

    // 2. Respaldo secundario: API nativa de Traccar /api/devices/share
    try {
      const expirationDate = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      const body = new URLSearchParams();
      body.append('deviceId', String(device.id));
      body.append('expiration', expirationDate);

      const response = await fetch('/api/devices/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (response.ok) {
        const token = (await response.text()).trim();
        if (token) {
          const liveLink = `${window.location.origin}/?token=${encodeURIComponent(token)}`;
          setShareUrl(liveLink);
          setShareLoading(false);
          return;
        }
      }
    } catch {}

    // 3. Último recurso si no hay conexión con el backend
    const fallbackGmaps = `https://www.google.com/maps?q=${lat},${lon}`;
    setShareUrl(fallbackGmaps);
    setShareLoading(false);
  };

  const handleCopyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    if (!shareUrl) return;
    const msg =
      `📍 *Ubicación en Vivo — ${device.name}*\n` +
      (address ? `🛣️ Lugar: ${address}\n` : '') +
      `⏱️ Enlace válido por ${shareHours}h:\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const btnStyle = {
    flex: 1,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    padding: '6px 4px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      {/* Barra compacta de 3 herramientas estilo GPSWOX */}
      <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }}>
        <button
          type="button"
          onClick={() => setStreetViewOpen(true)}
          style={btnStyle}
          title="Ver cámara de calle 360° (Street View) en la posición y rumbo del vehículo"
        >
          🧍 Street View
        </button>

        {!isReadonly && (
          <button
            type="button"
            onClick={handleOpenGeofenceModal}
            style={btnStyle}
            title="Crear geocerca en esta ubicación exacta"
          >
            ⭕ Geocerca
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            handleOpenShareModal();
            handleGenerateShareLink(shareHours);
          }}
          style={btnStyle}
          title="Compartir ubicación por WhatsApp o enlace temporal"
        >
          🔗 Compartir
        </button>

        {!isReadonly && (
          <button
            type="button"
            onClick={() => navigate(`/settings/device/${device.id}`)}
            style={{
              ...btnStyle,
              backgroundColor: '#eff6ff',
              borderColor: '#93c5fd',
              color: '#1d4ed8',
            }}
            title="Editar datos del vehículo (Placa, SIM, Modelo, Instalación)"
          >
            ✏️ Editar
          </button>
        )}
      </div>

      {/* 1. VENTANA FLOTANTE STREET VIEW 360° (Arrastrable, Redimensionable y Sin Bloquear el Mapa) */}
      <FloatingStreetView
        open={streetViewOpen}
        onClose={() => setStreetViewOpen(false)}
        deviceName={device.name}
        course={course}
        embedUrl={streetViewEmbedUrl}
        fullUrl={streetViewFullUrl}
        address={address}
        lat={lat}
        lon={lon}
      />

      {/* 2. MODAL CREAR GEOCERCA AQUÍ MISMO */}
      <Dialog
        open={geofenceOpen}
        onClose={() => !geoLoading && setGeofenceOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '16px' }}>
          ⭕ Crear Geocerca en Ubicación Actual
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            Vehículo: <strong>{device.name}</strong> ({lat.toFixed(5)}, {lon.toFixed(5)})
          </Typography>

          {geoError && <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>{geoError}</Alert>}
          {geoSuccess && <Alert severity="success" sx={{ mb: 1.5, py: 0.5 }}>{geoSuccess}</Alert>}

          <TextField
            label="Nombre de la Geocerca (Ej: Almacén Cliente)"
            value={geoName}
            onChange={(e) => setGeoName(e.target.value)}
            fullWidth
            size="small"
            autoFocus
            sx={{ mb: 2 }}
          />

          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.8 }}>
            Radio del perímetro circular:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            {RADIUS_OPTIONS.map((r) => (
              <Chip
                key={r}
                label={`${r} m`}
                clickable
                color={geoRadius === r ? 'primary' : 'default'}
                variant={geoRadius === r ? 'filled' : 'outlined'}
                onClick={() => setGeoRadius(r)}
                sx={{ fontWeight: 600, flex: 1 }}
              />
            ))}
          </Box>

          <FormControlLabel
            control={(
              <Checkbox
                checked={linkCurrentDevice}
                onChange={(e) => setLinkCurrentDevice(e.target.checked)}
                size="small"
              />
            )}
            label={<Typography variant="body2">Vincular automáticamente a <strong>{device.name}</strong></Typography>}
          />

          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #cbd5e1', textAlign: 'center' }}>
            <Button
              size="small"
              variant="text"
              onClick={handleOpenPolygonEditorHere}
              sx={{ textTransform: 'none', fontSize: '12px', fontWeight: 600 }}
            >
              ✏️ ¿Prefieres dibujar un Polígono a medida en este punto? Ir al editor →
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.2 }}>
          <Button onClick={() => setGeofenceOpen(false)} disabled={geoLoading} color="inherit" size="small">
            Cancelar
          </Button>
          <Button
            onClick={handleCreateQuickGeofence}
            disabled={geoLoading}
            variant="contained"
            size="small"
            sx={{ fontWeight: 700 }}
          >
            {geoLoading ? <CircularProgress size={18} color="inherit" /> : '💾 Guardar Geocerca'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 3. MODAL COMPARTIR UBICACIÓN EN VIVO */}
      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '16px' }}>
          🔗 Compartir Ubicación — {device.name}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
            Duración del enlace temporal en vivo:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {SHARE_DURATION_OPTIONS.map((opt) => (
              <Chip
                key={opt.hours}
                label={opt.label}
                clickable
                color={shareHours === opt.hours ? 'primary' : 'default'}
                variant={shareHours === opt.hours ? 'filled' : 'outlined'}
                onClick={() => {
                  setShareHours(opt.hours);
                  handleGenerateShareLink(opt.hours);
                }}
                sx={{ fontWeight: 600, flex: 1, fontSize: '11.5px' }}
              />
            ))}
          </Box>

          <TextField
            label="Enlace para compartir"
            value={shareLoading ? 'Generando enlace seguro...' : shareUrl}
            fullWidth
            size="small"
            InputProps={{ readOnly: true }}
            sx={{ mb: 1.5 }}
          />

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={handleCopyShareLink}
              disabled={shareLoading || !shareUrl}
              variant="outlined"
              fullWidth
              size="small"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {shareCopied ? '✓ ¡Copiado!' : '📋 Copiar Link'}
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              disabled={shareLoading || !shareUrl}
              variant="contained"
              fullWidth
              size="small"
              sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, textTransform: 'none', fontWeight: 700 }}
            >
              📲 WhatsApp
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1 }}>
          <Button onClick={() => setShareOpen(false)} size="small">
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VehicleToolsBar;

