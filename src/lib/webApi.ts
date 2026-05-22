const webApiBaseUrl = process.env.EXPO_PUBLIC_WEB_API_BASE_URL?.trim();

if (!webApiBaseUrl) {
  console.warn(
    'Missing EXPO_PUBLIC_WEB_API_BASE_URL. Native screens that call the web API will not work until it is configured.',
  );
}

export function buildWebApiUrl(
  path: string,
  query: Record<string, string> = {},
) {
  if (!webApiBaseUrl) return null;

  const baseUrl = webApiBaseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const queryString = Object.entries(query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${baseUrl}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
}
