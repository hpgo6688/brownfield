import semver from 'semver';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { config, getBaseUrl } from '../config';
import { prisma } from '../lib/prisma';

const featureSegments = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../../rn_app/config/feature-segments.json'),
    'utf8',
  ),
) as Record<string, number>;

const SHARED_FEATURE_ID = 'shared';

export type ManifestFeature = {
  id: string;
  title: string;
  icon: string;
  moduleName: string;
  version: string;
  hash: string;
  bundleUrl: string;
  minAppVersion: string;
  segmentId: number;
  sizeBytes?: number | null;
};

export type ManifestSharedBundle = {
  version: string;
  hash: string;
  bundleUrl: string;
  segmentId: number;
  sizeBytes?: number | null;
};

export type ManifestResponse = {
  version: number;
  updatedAt: string;
  mode: 'metro' | 'static';
  manifestUrl: string;
  sharedBundle?: ManifestSharedBundle | null;
  features: ManifestFeature[];
};

function buildBundleUrl(
  baseUrl: string,
  feature: { metroEntry: string; activeRelease: { filename: string } | null },
) {
  if (config.useMetroBundles) {
    return `${config.metroHost}/${feature.metroEntry}.bundle?platform=ios&dev=true&minify=false&modulesOnly=true`;
  }

  const filename = feature.activeRelease?.filename;
  if (!filename) {
    return `${baseUrl}/bundles/${feature.metroEntry.split('/').pop()}.ios.jsbundle`;
  }

  return `${baseUrl}/bundles/${filename}`;
}

async function resolveBundleSizeBytes(
  filename: string | undefined,
  storedSizeBytes?: number | null,
): Promise<number | null> {
  if (storedSizeBytes != null) {
    return storedSizeBytes;
  }

  if (!filename) {
    return null;
  }

  const bundleFilePath = path.join(config.bundlesDir, filename);
  try {
    const stat = await fsPromises.stat(bundleFilePath);
    return stat.size;
  } catch {
    return null;
  }
}

export async function buildManifest(params: {
  protocol: string;
  host: string;
  appVersion?: string;
}): Promise<ManifestResponse> {
  const baseUrl = getBaseUrl(params.protocol, params.host);
  const rows = await prisma.feature.findMany({
    where: { enabled: true },
    include: { activeRelease: true },
    orderBy: { id: 'asc' },
  });

  const features: ManifestFeature[] = [];
  let sharedBundle: ManifestSharedBundle | null = null;

  for (const row of rows) {
    if (params.appVersion && semver.valid(params.appVersion) && semver.valid(row.minAppVersion)) {
      if (semver.lt(params.appVersion, row.minAppVersion)) {
        continue;
      }
    }

    const version = row.activeRelease?.version ?? '0.0.0';
    let hash = row.activeRelease?.hash ?? 'sha256:unset';
    const filename = row.activeRelease?.filename;

    if (!config.useMetroBundles && filename) {
      const bundleFilePath = path.join(config.bundlesDir, filename);
      try {
        await fsPromises.access(bundleFilePath);
      } catch {
        console.warn(
          `[manifest] bundle file missing for feature="${row.id}" filename="${filename}"`,
        );
        hash = 'sha256:unset';
      }
    }

    const segmentId = featureSegments[row.id];
    if (segmentId == null) {
      throw new Error(`Missing segment id for feature "${row.id}" in feature-segments.json`);
    }

    const sizeBytes = await resolveBundleSizeBytes(
      filename,
      row.activeRelease?.sizeBytes,
    );

    const bundleUrl = buildBundleUrl(baseUrl, row);

    if (row.id === SHARED_FEATURE_ID) {
      sharedBundle = {
        version,
        hash,
        bundleUrl,
        segmentId,
        sizeBytes,
      };
      continue;
    }

    features.push({
      id: row.id,
      title: row.title,
      icon: row.icon,
      moduleName: row.moduleName,
      version,
      hash,
      bundleUrl,
      minAppVersion: row.minAppVersion,
      segmentId,
      sizeBytes,
    });
  }

  return {
    version: config.manifestVersion,
    updatedAt: new Date().toISOString(),
    mode: config.useMetroBundles ? 'metro' : 'static',
    manifestUrl: `${baseUrl}/api/manifest`,
    sharedBundle,
    features,
  };
}
