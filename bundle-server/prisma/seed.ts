import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedFeatures = [
  {
    id: 'home',
    title: '首页',
    icon: 'house',
    moduleName: 'DynamicHomeScreen',
    metroEntry: 'bundles/home/index',
  },
  {
    id: 'profile',
    title: '个人中心',
    icon: 'person',
    moduleName: 'DynamicProfileScreen',
    metroEntry: 'bundles/profile/index',
  },
  {
    id: 'settings',
    title: '设置',
    icon: 'gearshape',
    moduleName: 'DynamicSettingsScreen',
    metroEntry: 'bundles/settings/index',
  },
];

async function main() {
  for (const feature of seedFeatures) {
    await prisma.feature.upsert({
      where: { id: feature.id },
      create: {
        ...feature,
        enabled: true,
        minAppVersion: '1.0.0',
      },
      update: {
        title: feature.title,
        icon: feature.icon,
        moduleName: feature.moduleName,
        metroEntry: feature.metroEntry,
      },
    });
  }

  console.log(`Seeded ${seedFeatures.length} features.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
