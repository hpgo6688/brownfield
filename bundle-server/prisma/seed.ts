import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import { PrismaClient } from '../src/generated/prisma/client';

function getDatabaseUrl(): string {
  const rawUrl = process.env.DATABASE_URL ?? 'file:../data/bundle-server.db';
  if (!rawUrl.startsWith('file:')) {
    return rawUrl;
  }

  const filePath = rawUrl.slice('file:'.length);
  if (path.isAbsolute(filePath)) {
    return rawUrl;
  }

  return `file:${path.resolve(process.cwd(), 'prisma', filePath)}`;
}

const adapter = new PrismaBetterSqlite3({
  url: getDatabaseUrl(),
});

const prisma = new PrismaClient({ adapter });

const remoteEntries = [
  {
    id: 'order',
    title: '订单',
    icon: 'cart',
    moduleName: 'OrderScreen',
    metroEntry: 'bundles/order/index',
  },
  {
    id: 'promo',
    title: '活动',
    icon: 'sparkles',
    moduleName: 'PromoScreen',
    metroEntry: 'bundles/promo/index',
  },
];

const deprecatedDemoIds = ['home', 'profile', 'settings'];

async function main() {
  await prisma.feature.deleteMany({
    where: { id: { in: deprecatedDemoIds } },
  });

  for (const entry of remoteEntries) {
    await prisma.feature.upsert({
      where: { id: entry.id },
      create: {
        ...entry,
        enabled: true,
        minAppVersion: '1.0.0',
      },
      update: {
        title: entry.title,
        icon: entry.icon,
        moduleName: entry.moduleName,
        metroEntry: entry.metroEntry,
        enabled: true,
      },
    });
  }

  console.log(`Seeded ${remoteEntries.length} Remote entries (order, promo).`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
