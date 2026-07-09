import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import semver from 'semver';
import { config } from '../config';
import { prisma } from '../lib/prisma';

export async function ensureBundlesDir() {
  await fs.mkdir(config.bundlesDir, { recursive: true });
}

export function computeSha256(buffer: Buffer): string {
  const digest = createHash('sha256').update(buffer).digest('hex');
  return `sha256:${digest}`;
}

type ReleaseSizeSource = {
  sizeBytes?: number | null;
  filename: string;
};

export async function resolveReleaseSizeBytes(
  release: ReleaseSizeSource,
): Promise<number | null> {
  if (release.sizeBytes != null) {
    return release.sizeBytes;
  }

  const filePath = path.join(config.bundlesDir, release.filename);
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return null;
  }
}

async function enrichReleaseForAdmin<T extends ReleaseSizeSource>(release: T) {
  const sizeBytes = await resolveReleaseSizeBytes(release);
  return { ...release, sizeBytes };
}

export async function enrichFeatureForAdmin<
  T extends {
    activeRelease: ReleaseSizeSource | null;
    releases: ReleaseSizeSource[];
  },
>(feature: T): Promise<T> {
  const [activeRelease, releases] = await Promise.all([
    feature.activeRelease ? enrichReleaseForAdmin(feature.activeRelease) : null,
    Promise.all(feature.releases.map(enrichReleaseForAdmin)),
  ]);

  return {
    ...feature,
    activeRelease,
    releases,
  };
}

export async function createReleaseFromUpload(params: {
  featureId: string;
  version: string;
  buffer: Buffer;
  notes?: string;
  activate?: boolean;
}) {
  const { featureId, version, buffer, notes, activate = true } = params;

  if (!semver.valid(version)) {
    throw new Error(`Invalid semver: ${version}`);
  }

  const feature = await prisma.feature.findUnique({ where: { id: featureId } });
  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  const hash = computeSha256(buffer);
  const sizeBytes = buffer.byteLength;
  const filename = `ota_${featureId}.${version}.ios.jsbundle`;
  const filePath = path.join(config.bundlesDir, filename);

  await ensureBundlesDir();
  await fs.writeFile(filePath, buffer);

  const release = await prisma.bundleRelease.upsert({
    where: {
      featureId_version: { featureId, version },
    },
    create: {
      featureId,
      version,
      hash,
      filename,
      sizeBytes,
      notes,
    },
    update: {
      hash,
      filename,
      sizeBytes,
      notes,
    },
  });

  if (activate) {
    await prisma.feature.update({
      where: { id: featureId },
      data: { activeReleaseId: release.id },
    });
  }

  return release;
}

export async function activateRelease(featureId: string, releaseId: string) {
  const release = await prisma.bundleRelease.findFirst({
    where: { id: releaseId, featureId },
  });

  if (!release) {
    throw new Error('Release not found for this feature');
  }

  return enrichFeatureForAdmin(
    await prisma.feature.update({
      where: { id: featureId },
      data: { activeReleaseId: release.id },
      include: {
        activeRelease: true,
        releases: { orderBy: { createdAt: 'desc' } },
      },
    }),
  );
}

export async function rollbackFeature(featureId: string, releaseId: string) {
  return activateRelease(featureId, releaseId);
}

export async function deleteRelease(featureId: string, releaseId: string) {
  const release = await prisma.bundleRelease.findFirst({
    where: { id: releaseId, featureId },
  });

  if (!release) {
    throw new Error('Release not found for this feature');
  }

  const feature = await prisma.feature.findUnique({ where: { id: featureId } });
  if (!feature) {
    throw new Error('Feature not found');
  }

  if (feature.activeReleaseId === releaseId) {
    const fallback = await prisma.bundleRelease.findFirst({
      where: { featureId, id: { not: releaseId } },
      orderBy: { createdAt: 'desc' },
    });

    await prisma.feature.update({
      where: { id: featureId },
      data: { activeReleaseId: fallback?.id ?? null },
    });
  }

  await prisma.bundleRelease.delete({ where: { id: releaseId } });

  const filePath = path.join(config.bundlesDir, release.filename);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return enrichFeatureForAdmin(
    await prisma.feature.findUniqueOrThrow({
      where: { id: featureId },
      include: {
        activeRelease: true,
        releases: { orderBy: { createdAt: 'desc' } },
      },
    }),
  );
}

export async function toggleFeature(featureId: string, enabled?: boolean) {
  const feature = await prisma.feature.findUnique({ where: { id: featureId } });
  if (!feature) {
    throw new Error('Feature not found');
  }

  return enrichFeatureForAdmin(
    await prisma.feature.update({
      where: { id: featureId },
      data: { enabled: enabled ?? !feature.enabled },
      include: {
        activeRelease: true,
        releases: { orderBy: { createdAt: 'desc' } },
      },
    }),
  );
}

export async function listFeaturesAdmin() {
  const features = await prisma.feature.findMany({
    include: {
      activeRelease: true,
      releases: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { id: 'asc' },
  });

  return Promise.all(features.map(enrichFeatureForAdmin));
}

export async function createFeature(params: {
  id: string;
  title: string;
  icon?: string;
  moduleName: string;
  metroEntry: string;
  minAppVersion?: string;
  enabled?: boolean;
}) {
  const { id, title, icon, moduleName, metroEntry, minAppVersion, enabled } = params;

  if (!/^[a-z][a-z0-9-]*$/.test(id)) {
    throw new Error('Invalid feature id: use lowercase letters, numbers, hyphens');
  }

  const existing = await prisma.feature.findUnique({ where: { id } });
  if (existing) {
    throw new Error('Feature already exists');
  }

  return enrichFeatureForAdmin(
    await prisma.feature.create({
      data: {
        id,
        title,
        icon: icon ?? 'square.grid.2x2',
        moduleName,
        metroEntry,
        minAppVersion: minAppVersion ?? '1.0.0',
        enabled: enabled ?? true,
      },
      include: {
        activeRelease: true,
        releases: { orderBy: { createdAt: 'desc' } },
      },
    }),
  );
}
