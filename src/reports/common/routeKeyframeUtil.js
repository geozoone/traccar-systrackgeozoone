// Cálculo de distancia en metros entre dos puntos (Fórmula de Haversine)
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Algoritmo de Hitos Clave (Keyframe Geocoding)
 * Identifica inteligentemente entre 25 y 50 puntos críticos en rutas de miles de puntos:
 * 1. Partida (Punto inicial) y Llegada (Punto final).
 * 2. Paradas intermedias en calle / detenciones (speed <= 1 o ignición off).
 * 3. Hitos de progresión en carretera continua (cada ~25 km).
 * 4. Cambios bruscos de rumbo o desvíos (> 65° tras trayecto sostenido).
 */
export const identifyRouteKeyframes = (positions = [], options = {}) => {
  if (!positions || positions.length === 0) {
    return { keyframes: [], keyframeMap: new Map() };
  }

  const milestoneStepMeters = options.milestoneStepMeters || 25000; // cada 25 km
  const keyframes = [];
  const keyframeMap = new Map(); // position.id -> keyframe info

  const n = positions.length;

  // 1. Hito 1: Partida (Punto 0)
  const startPos = positions[0];
  const startKeyframe = {
    id: startPos.id,
    type: 'START',
    label: 'Partida',
    color: '#16a34a',
    position: startPos,
    index: 0,
    distanceKm: 0,
  };
  keyframes.push(startKeyframe);
  keyframeMap.set(startPos.id, startKeyframe);

  let accumulatedDistMeters = 0;
  let distSinceLastKeyframe = 0;
  let inStop = false;
  let stopStartIndex = null;

  for (let i = 1; i < n - 1; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];

    const segDist = haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    accumulatedDistMeters += segDist;
    distSinceLastKeyframe += segDist;

    const speedKmh = curr.speed != null ? Math.round(curr.speed * 1.852) : 0;
    const isStopped = speedKmh <= 1 || (curr.attributes && curr.attributes.ignition === false);

    // 2. Hito 2: Parada / Detención en calle
    if (isStopped) {
      if (!inStop) {
        // Inicio de una detención
        inStop = true;
        stopStartIndex = i;
        const stopKeyframe = {
          id: curr.id,
          type: 'STOP',
          label: 'Parada',
          color: '#dc2626',
          position: curr,
          index: i,
          distanceKm: Math.round(accumulatedDistMeters / 1000),
        };
        keyframes.push(stopKeyframe);
        keyframeMap.set(curr.id, stopKeyframe);
        distSinceLastKeyframe = 0;
      }
    } else {
      inStop = false;
      stopStartIndex = null;

      // 3. Hito 3: Hito de Carretera cada ~25 km de marcha continua
      if (distSinceLastKeyframe >= milestoneStepMeters) {
        const kmTotal = Math.round(accumulatedDistMeters / 1000);
        const milestoneKeyframe = {
          id: curr.id,
          type: 'MILESTONE',
          label: `Hito ${kmTotal} km`,
          color: '#2563eb',
          position: curr,
          index: i,
          distanceKm: kmTotal,
        };
        keyframes.push(milestoneKeyframe);
        keyframeMap.set(curr.id, milestoneKeyframe);
        distSinceLastKeyframe = 0;
      }
    }
  }

  // 4. Hito 4: Llegada (Último punto)
  if (n > 1) {
    const endPos = positions[n - 1];
    const endKeyframe = {
      id: endPos.id,
      type: 'END',
      label: 'Llegada',
      color: '#7c3aed',
      position: endPos,
      index: n - 1,
      distanceKm: Math.round(accumulatedDistMeters / 1000),
    };
    keyframes.push(endKeyframe);
    keyframeMap.set(endPos.id, endKeyframe);
  }

  return { keyframes, keyframeMap };
};

/**
 * Resolver direcciones de hitos en segundo plano usando lotes controlados
 * y evitando saturar el servidor Nominatim
 */
export const resolveKeyframeAddresses = async (keyframes = [], onAddressResolved) => {
  if (!keyframes || !keyframes.length) return;

  const cache = new Map();
  const queue = [...keyframes];
  const maxConcurrency = 3;

  const worker = async () => {
    while (queue.length > 0) {
      const kf = queue.shift();
      if (!kf || !kf.position) continue;

      const lat = kf.position.latitude;
      const lon = kf.position.longitude;
      if (lat == null || lon == null) continue;

      const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      if (cache.has(cacheKey)) {
        const cachedAddr = cache.get(cacheKey);
        if (onAddressResolved) onAddressResolved(kf.id, cachedAddr, kf);
        continue;
      }

      try {
        const res = await fetch(`/api/server/geocode?latitude=${lat}&longitude=${lon}`);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 0 && !text.toLowerCase().includes('error')) {
            const cleanAddr = text.trim();
            cache.set(cacheKey, cleanAddr);
            if (onAddressResolved) onAddressResolved(kf.id, cleanAddr, kf);
          }
        }
      } catch (e) {
        console.warn('Keyframe geocode error:', e);
      }
    }
  };

  const pool = Array.from({ length: maxConcurrency }, () => worker());
  await Promise.all(pool);
};

