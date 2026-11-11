export function normalizeBaseUrl(value = '') {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

export function normalizePath(pathname = '') {
  const value = String(pathname ?? '').trim();
  return value.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function resolveApiUrl(pathname = '', baseUrl = '') {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const cleanPath = normalizePath(pathname);
  if (!cleanBase) {
    return cleanPath ? `/${cleanPath}` : '/';
  }
  return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
}

export function buildPiConfig({ host = '', port = '' } = {}) {
  const piHost = String(host ?? '').trim();
  const piPort = String(port ?? '').trim();
  const portSuffix = piPort ? `:${piPort}` : '';
  const httpScheme = piPort ? 'http' : 'https';
  const wsScheme = piPort ? 'ws' : 'wss';
  const baseUrl = piHost ? `${httpScheme}://${piHost}${portSuffix}` : '';

  return {
    host: piHost,
    port: piPort,
    baseUrl,
    wsUrl: piHost ? `${wsScheme}://${piHost}${portSuffix}/ws` : '',
    streamUrl: piHost ? `${httpScheme}://${piHost}${portSuffix}/stream` : '',
  };
}
