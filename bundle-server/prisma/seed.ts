import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
