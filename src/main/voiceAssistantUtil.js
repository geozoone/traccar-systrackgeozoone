import dayjs from 'dayjs';

// Normalizar texto plano eliminando tildes y caracteres especiales
export const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Normalización fonética para español (B/V intercambiables, C/S/Z, H muda, consonantes dobles)
export const phoneticNormalize = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/v/g, 'b')
    .replace(/z|c(?=[ei])/g, 's')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1'); // eliminar repetidas (nn -> n, etc.)
};

// Algoritmo de distancia de edición (Levenshtein)
export const levenshteinDistance = (s1, s2) => {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
};

// Similitud fonética entre 0.0 (totalmente diferente) y 1.0 (idéntico)
export const phoneticSimilarity = (str1, str2) => {
  const p1 = phoneticNormalize(str1);
  const p2 = phoneticNormalize(str2);
  if (!p1 || !p2) return 0;
  if (p1 === p2) return 1.0;
  if (p1.includes(p2) || p2.includes(p1)) return 0.88;

  const dist = levenshteinDistance(p1, p2);
  const maxLen = Math.max(p1.length, p2.length);
  return Math.max(0, 1 - (dist / maxLen));
};

// Diccionario de equivalencias fonéticas para marcas y geocercas industriales en Perú
const KNOWN_PHONETIC_ALIASES = {
  brenntag: ['brenta', 'brentag', 'brenda', 'venta', 'vrenta', 'bretag', 'brentak', 'brentan', 'breta'],
  chorrillos: ['chorillos', 'chori', 'chorillo', 'choriillos'],
  huachipa: ['huachipa', 'guachipa', 'wachipa'],
  callao: ['callao', 'cayao', 'callao'],
  lurin: ['lurin', 'lorin'],
  pisco: ['pisco', 'fisco'],
};

// Formato de fecha y hora natural para voz hablada
export const formatSpokenDateTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = dayjs(timestamp);
    const now = dayjs();
    const diffMinutes = now.diff(date, 'minute');
    const diffHours = now.diff(date, 'hour');
    const timeFormatted = date.format('h:mm A');

    if (diffMinutes < 2) {
      return `hace un momento a las ${timeFormatted}`;
    }
    if (diffMinutes < 60) {
      return `hace ${diffMinutes} minutos, a las ${timeFormatted}`;
    }
    if (now.isSame(date, 'day')) {
      return `hoy a las ${timeFormatted} (hace ${diffHours} horas)`;
    }
    if (now.subtract(1, 'day').isSame(date, 'day')) {
      return `ayer a las ${timeFormatted}`;
    }
    return `el ${date.format('D [de] MMMM [a las] h:mm A')}`;
  } catch (e) {
    return '';
  }
};

// Convertir rumbo en grados a dirección cardinal en español
export const getCardinalDirection = (course) => {
  if (course == null) return '';
  const directions = [
    'hacia el norte',
    'hacia el noreste',
    'hacia el este',
    'hacia el sureste',
    'hacia el sur',
    'hacia el suroeste',
    'hacia el oeste',
    'hacia el noroeste',
  ];
  const index = Math.round(course / 45) % 8;
  return directions[index];
};

// Tocar timbre/chime sonoro nativo con Web Audio API (0 costo, 100% offline)
export const playNotificationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Acorde de atención: D5 (587 Hz) -> A5 (880 Hz)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
};

// Algoritmo matemático para comprobar si un punto (lat, lon) está dentro de una geocerca
export const isPositionInGeofence = (pos, geo) => {
  if (!pos || !geo) return false;

  // 1. Si Traccar ya lo tiene emparejado en geofenceIds
  if (Array.isArray(pos.geofenceIds) && pos.geofenceIds.includes(geo.id)) {
    return true;
  }

  const lat = pos.latitude;
  const lon = pos.longitude;
  if (lat == null || lon == null || !geo.area) return false;

  const area = geo.area.trim();

  // 2. Geocerca tipo CÍRCULO: CIRCLE (lat, lon, radio_en_metros)
  if (area.startsWith('CIRCLE')) {
    try {
      const raw = area.replace(/CIRCLE|\(|\)|,/g, ' ').trim().split(/\s+/);
      if (raw.length >= 3) {
        const cLat = Number(raw[0]);
        const cLon = Number(raw[1]);
        const radius = Number(raw[2]);
        if (!isNaN(cLat) && !isNaN(cLon) && !isNaN(radius)) {
          const R = 6371000;
          const dLat = ((cLat - lat) * Math.PI) / 180;
          const dLon = ((cLon - lon) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos((lat * Math.PI) / 180) * Math.cos((cLat * Math.PI) / 180)
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return (R * c) <= (radius + 20); // +20 metros de tolerancia GPS
        }
      }
    } catch (e) {
      console.warn('Error evaluating circle geofence:', e);
    }
  }

  // 3. Geocerca tipo POLÍGONO: POLYGON ((lon lat, lon lat, ...))
  if (area.startsWith('POLYGON')) {
    try {
      const coordStr = area.replace(/POLYGON|\(|\)/g, ' ').trim();
      const pairs = coordStr.split(',').map((p) => p.trim().split(/\s+/));
      const vs = pairs.map((p) => [Number(p[0]), Number(p[1])]).filter((p) => !isNaN(p[0]) && !isNaN(p[1]));

      if (vs.length >= 3) {
        const x = lon;
        const y = lat;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
          const xi = vs[i][0];
          const yi = vs[i][1];
          const xj = vs[j][0];
          const yj = vs[j][1];
          const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      }
    } catch (e) {
      console.warn('Error evaluating polygon geofence:', e);
    }
  }

  return false;
};

// Calcular área aproximada en m² para priorizar geocercas concéntricas (Menor Área = Mayor Prioridad)
export const calculateGeofenceArea = (geo) => {
  if (!geo || !geo.area) return Infinity;
  const areaStr = geo.area.trim();

  // Círculo: radio en metros -> Pi * r^2
  if (areaStr.startsWith('CIRCLE')) {
    try {
      const raw = areaStr.replace(/CIRCLE|\(|\)|,/g, ' ').trim().split(/\s+/);
      if (raw.length >= 3) {
        const radius = Number(raw[2]);
        if (!isNaN(radius)) {
          return Math.PI * radius * radius;
        }
      }
    } catch (e) {
      return Infinity;
    }
  }

  // Polígono: Shoelace formula escalada a metros
  if (areaStr.startsWith('POLYGON')) {
    try {
      const coordStr = areaStr.replace(/POLYGON|\(|\)/g, ' ').trim();
      const pairs = coordStr.split(',').map((p) => p.trim().split(/\s+/));
      const coords = pairs
        .map((p) => [Number(p[0]), Number(p[1])])
        .filter((p) => !isNaN(p[0]) && !isNaN(p[1]));

      if (coords.length >= 3) {
        const refLat = coords[0][1];
        const latMetersPerDeg = 111320;
        const lonMetersPerDeg = 111320 * Math.cos((refLat * Math.PI) / 180);

        let areaMeters = 0;
        const n = coords.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const xi = coords[i][0] * lonMetersPerDeg;
          const yi = coords[i][1] * latMetersPerDeg;
          const xj = coords[j][0] * lonMetersPerDeg;
          const yj = coords[j][1] * latMetersPerDeg;
          areaMeters += (xi * yj) - (xj * yi);
        }
        return Math.abs(areaMeters) / 2;
      }
    } catch (e) {
      return Infinity;
    }
  }

  return Infinity;
};

// Obtener todas las geocercas que contienen la posición, ordenadas de MENOR área a MAYOR área (Rampa primero, Macro-Zona después)
export const getContainingGeofencesSorted = (pos, geofenceList) => {
  if (!pos || !geofenceList || !geofenceList.length) return [];
  const inside = geofenceList.filter((g) => isPositionInGeofence(pos, g));
  return inside.sort((a, b) => calculateGeofenceArea(a) - calculateGeofenceArea(b));
};

// Encontrar coincidencia inteligente de Geocerca (Exacta, Palabras Clave, Diccionario de Variantes y Similitud Fonética Levenshtein)
export const findMatchingGeofence = (rawQuery, geofenceList) => {
  const q = normalizeText(rawQuery);
  if (!geofenceList || !geofenceList.length || !q) return null;

  let bestGeo = null;
  let maxScore = 0;

  const queryWords = q.split(' ').filter((w) => w.length >= 2);

  for (const geo of geofenceList) {
    const geoNameNorm = normalizeText(geo.name);
    if (!geoNameNorm) continue;

    // 1. Coincidencia exacta o frase contenida completa (máxima prioridad)
    if (q.includes(geoNameNorm)) {
      const score = 200 + geoNameNorm.length;
      if (score > maxScore) {
        maxScore = score;
        bestGeo = geo;
      }
      continue;
    }

    const geoWords = geoNameNorm.split(' ').filter((w) => w.length >= 2);

    // 2. Coincidencias fonéticas y aliases conocidos
    let geoScore = 0;
    for (const gw of geoWords) {
      // 2.1 Aliases conocidos (ej. brenntag -> venta, brenta, etc.)
      const aliases = KNOWN_PHONETIC_ALIASES[gw] || [];
      for (const alias of aliases) {
        if (q.includes(alias)) {
          geoScore += 90;
        }
      }

      // 2.2 Comparar palabra a palabra usando Similitud Fonética Levenshtein
      for (const qw of queryWords) {
        if (qw === gw) {
          geoScore += 60;
        } else if (qw.length >= 4 && gw.length >= 4) {
          const sim = phoneticSimilarity(qw, gw);
          if (sim >= 0.72) {
            geoScore += Math.round(sim * 55);
          }
        }
      }
    }

    if (geoScore > maxScore) {
      maxScore = geoScore;
      bestGeo = geo;
    }
  }

  // 3. Fallback para palabras clave genéricas ("base", "patio", "cochera")
  if (!bestGeo && (q.includes('base') || q.includes('cochera') || q.includes('patio') || q.includes('planta'))) {
    bestGeo = geofenceList.find((g) => {
      const gn = normalizeText(g.name);
      return gn.includes('base') || gn.includes('cochera') || gn.includes('patio') || gn.includes('planta');
    });
  }

  // Considerar match válido solo si el puntaje superó el umbral
  return maxScore >= 40 ? bestGeo : null;
};

// Encontrar vehículo o conductor
export const findMatchingDevice = (rawQuery, deviceList, driverList = []) => {
  const q = normalizeText(rawQuery);
  if (!deviceList || !deviceList.length || !q) return null;

  const stopWords = [
    'que', 'vehiculos', 'vehiculo', 'unidades', 'unidad', 'carros', 'carro', 'moviles', 'movil',
    'estan', 'dentro', 'fuera', 'donde', 'esta', 'quienes', 'quien', 'como', 'flota', 'base',
    'chorrillos', 'hay', 'en', 'la', 'el', 'avisame', 'cuando', 'llegue', 'salga', 'se', 'mueva',
    'arranque', 'si', 'notificame', 'alerta', 'de', 'del', 'los', 'las', 'por', 'favor',
  ];

  // 1. Coincidencia exacta o por placa sin espacios (ej: "afd835" o "afd 835")
  for (const dev of deviceList) {
    const devName = normalizeText(dev.name);
    const devPlate = devName.replace(/\s+/g, '');
    const queryNoSpaces = q.replace(/\s+/g, '');

    if (devName && (q.includes(devName) || devName.includes(q))) {
      return dev;
    }
    if (devPlate.length >= 3 && queryNoSpaces.includes(devPlate)) {
      return dev;
    }
    const parts = devName.split(/[-\s]+/);
    for (const part of parts) {
      if (part.length >= 2 && !stopWords.includes(part) && q.includes(part)) {
        return dev;
      }
    }
  }

  // 2. Coincidencia por conductor
  for (const driver of driverList) {
    const driverName = normalizeText(driver.name);
    if (driverName.length >= 3 && q.includes(driverName)) {
      const linkedDev = deviceList.find((d) =>
        d.attributes?.driverUniqueId === driver.uniqueId
        || d.attributes?.driverId === driver.id
        || normalizeText(d.attributes?.driverName || '').includes(driverName)
        || normalizeText(d.name).includes(driverName),
      );
      if (linkedDev) return linkedDev;
    }
  }

  // 3. Coincidencia difusa por tokens de la consulta
  const words = q.split(' ').filter((w) => w.length >= 3 && !stopWords.includes(w));
  for (const word of words) {
    const found = deviceList.find((d) => normalizeText(d.name).includes(word));
    if (found) return found;
  }

  return null;
};

export default {
  normalizeText,
  phoneticNormalize,
  levenshteinDistance,
  phoneticSimilarity,
  formatSpokenDateTime,
  getCardinalDirection,
  playNotificationChime,
  isPositionInGeofence,
  calculateGeofenceArea,
  getContainingGeofencesSorted,
  findMatchingGeofence,
  findMatchingDevice,
};
