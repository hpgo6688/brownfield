import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import semver from 'semver';
import { config } from '../config';
import { prisma } from '../lib/prisma';

export async function ensureDistDir() {
  await fs.mkdir(config.distDir, { recursive: true });
}

export function computeSha256(buffer: Buffer): string {
  const digest = createHash('sha256').update(buffer).digest('hex');
  return `sha256:${digest}`;
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
  const filename = `${featureId}.${version}.ios.jsbundle`;
  const filePath = path.join(config.distDir, filename);

  await ensureDistDir();
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
      notes,
    },
    update: {
      hash,
      filename,
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

  return prisma.feature.update({
    where: { id: featureId },
    data: { activeReleaseId: release.id },
    include: {
      activeRelease: true,
      releases: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function rollbackFeature(featureId: string, releaseId: string) {
  return activateRelease(featureId, releaseId);
}

export async function toggleFeature(featureId: string, enabled?: boolean) {
  const feature = await prisma.feature.findUnique({ where: { id: featureId } });
  if (!feature) {
    throw new Error('Feature not found');
  }

  return prisma.feature.update({
    where: { id: featureId },
    data: { enabled: enabled ?? !feature.enabled },
    include: {
      activeRelease: true,
      releases: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function listFeaturesAdmin() {
  return prisma.feature.findMany({
    include: {
      activeRelease: true,
      releases: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { id: 'asc' },
  });
}
