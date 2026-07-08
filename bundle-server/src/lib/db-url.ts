import path from 'path';

function resolveSqliteUrl(rawUrl: string): string {
  if (!rawUrl.startsWith('file:')) {
    return rawUrl;
  }

  const filePath = rawUrl.slice('file:'.length);
  if (path.isAbsolute(filePath)) {
    return rawUrl;
  }

  // DATABASE_URL paths are relative to prisma/schema.prisma
  const absolutePath = path.resolve(process.cwd(), 'prisma', filePath);
  return `file:${absolutePath}`;
}

export function getDatabaseUrl(): string {
  return resolveSqliteUrl(process.env.DATABASE_URL ?? 'file:../data/bundle-server.db');
}
