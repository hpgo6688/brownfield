import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';
import { getDatabaseUrl } from './db-url';

const adapter = new PrismaBetterSqlite3({
  url: getDatabaseUrl(),
});

export const prisma = new PrismaClient({ adapter });
