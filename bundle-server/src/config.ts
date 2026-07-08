import path from 'path';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  metroHost: process.env.METRO_HOST ?? 'http://127.0.0.1:8081',
  useMetroBundles: process.env.USE_METRO_BUNDLES === 'true',
  distDir: path.join(__dirname, '..', 'dist', 'bundles'),
  manifestVersion: 2,
};

export function getBaseUrl(protocol: string, host: string) {
  return `${protocol}://${host}`;
}
