import path from 'path';

function resolveSqliteUrl(rawUrl: string): string {
  if (!rawUrl.startsWith('file:')) {
    return rawUrl;
  }

  const filePath = rawUrl.slice('file:'.length);
  if (path.isAbsolute(filePath)) {
    return rawUrl;
  }

  // Match Prisma CLI: paths are relative to the bundle-server project root.
  const absolutePath = path.resolve(process.cwd(), filePath);
  return `file:${absolutePath}`;
}

export function getDatabaseUrl(): string {
  return resolveSqliteUrl(process.env.DATABASE_URL ?? 'file:data/bundle-server.db');
}
