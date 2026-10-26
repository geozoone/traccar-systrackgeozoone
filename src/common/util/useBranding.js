import { useEffect, useState } from 'react';

const isMainGeozooneDomain = (host) => {
  if (!host) return true;
  return host === 'gps.geozoone.com' || host === 'geozoone.com' || host === 'localhost' || host === '127.0.0.1';
};

const getStorageKey = (host) => `geozoone_branding_${host}`;

let inMemoryCache = null;

const getInitialBranding = () => {
  if (typeof window === 'undefined') {
    return { found: false, title: 'Plataforma GPS', logo: null, background: null, colorPrimary: '#282833' };
  }
  const host = window.location.hostname;
  const isMain = isMainGeozooneDomain(host);

  // 1. Intentar memoria de sesión
  if (inMemoryCache) {
    return inMemoryCache;
  }

  // 2. Intentar leer sincrónicamente de localStorage (0 ms)
  try {
    const raw = localStorage.getItem(getStorageKey(host));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        if (parsed.title) {
          document.title = parsed.title;
        }
        inMemoryCache = parsed;
        return parsed;
      }
    }
  } catch (e) {}

  // 3. Fallback seguro inicial: Jamás poner "Geozoone" si es revendedor
  return {
    found: isMain,
    title: isMain ? 'Geozoone' : 'Plataforma GPS',
    logo: null,
    background: null,
    colorPrimary: '#282833',
  };
};

export const useBranding = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isReseller = !isMainGeozooneDomain(host);

  const [branding, setBranding] = useState(getInitialBranding);
  const [loading, setLoading] = useState(() => {
    // Si ya tenemos datos reales cargados (de memoria o localStorage), no bloqueamos
    return !inMemoryCache && !branding.found && isReseller;
  });

  useEffect(() => {
    if (!host) return;

    fetch(`/modulo/branding?domain=${encodeURIComponent(host)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.found) {
          inMemoryCache = data;
          setBranding(data);
          try {
            localStorage.setItem(getStorageKey(host), JSON.stringify(data));
          } catch (e) {}
          if (data.title) {
            document.title = data.title;
          }
        } else if (isReseller) {
          // El revendedor aún no ha subido logo ni fondo propio
          const emptyResellerBranding = {
            found: false,
            title: branding.title && branding.title !== 'Geozoone' ? branding.title : 'Plataforma GPS',
            logo: null,
            background: null,
            colorPrimary: '#282833',
          };
          setBranding(emptyResellerBranding);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [host, isReseller]);

  return { branding, loading, isReseller };
};

export default useBranding;
