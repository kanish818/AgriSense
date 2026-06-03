const PROD_API_BASE = 'https://agrisense-backend-h3a6.onrender.com/api';
const LOCAL_API_BASE = 'http://localhost:4001/api';

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function resolveApiBase() {
  const configured = (import.meta.env.VITE_API_URL || '').trim();

  if (configured) {
    try {
      const url = new URL(configured);
      if (typeof window !== 'undefined' && !isLocalHost(window.location.hostname) && isLocalHost(url.hostname)) {
        return PROD_API_BASE;
      }
      return configured.replace(/\/$/, '');
    } catch {
      return configured.replace(/\/$/, '');
    }
  }

  if (typeof window === 'undefined') {
    return LOCAL_API_BASE;
  }

  return isLocalHost(window.location.hostname) ? LOCAL_API_BASE : PROD_API_BASE;
}

export const API_BASE = resolveApiBase();
