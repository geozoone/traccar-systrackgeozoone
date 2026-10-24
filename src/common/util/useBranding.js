import { useEffect, useState } from 'react';

let cachedBranding = null;

export const useBranding = () => {
  const [branding, setBranding] = useState(cachedBranding || {
    found: false,
    title: 'Geozoone',
    logo: null,
    background: null,
    colorPrimary: '#282833',
  });
  const [loading, setLoading] = useState(!cachedBranding);

  useEffect(() => {
    if (cachedBranding) return;

    const hostname = window.location.hostname;
    fetch(`/modulo/branding?domain=${encodeURIComponent(hostname)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.found) {
          cachedBranding = data;
          setBranding(data);
          if (data.title) {
            document.title = data.title;
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { branding, loading };
};

export default useBranding;
