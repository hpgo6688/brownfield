import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { getDatabaseUrl } from '../src/lib/db-url';

const adapter = new PrismaBetterSqlite3({
  url: getDatabaseUrl(),
});

const prisma = new PrismaClient({ adapter });

const remoteEntries = [
  {
    id: 'order',
    title: '订单',
    icon: 'cart',
    moduleName: 'ota_OrderScreen',
    metroEntry: 'bundles/ota_order/index',
  },
  {
    id: 'promo',
    title: '活动',
    icon: 'sparkles',
    moduleName: 'ota_PromoScreen',
    metroEntry: 'bundles/ota_promo/index',
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
