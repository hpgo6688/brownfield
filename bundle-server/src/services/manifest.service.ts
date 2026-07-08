import semver from 'semver';
import { config, getBaseUrl } from '../config';
import { prisma } from '../lib/prisma';

export type ManifestFeature = {
  id: string;
  title: string;
  icon: string;
  moduleName: string;
  version: string;
  hash: string;
  bundleUrl: string;
  minAppVersion: string;
};

export type ManifestResponse = {
  version: number;
  updatedAt: string;
  mode: 'metro' | 'static';
  manifestUrl: string;
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

  for (const row of rows) {
    if (params.appVersion && semver.valid(params.appVersion) && semver.valid(row.minAppVersion)) {
      if (semver.lt(params.appVersion, row.minAppVersion)) {
        continue;
      }
    }

    const version = row.activeRelease?.version ?? '0.0.0';
    const hash = row.activeRelease?.hash ?? 'sha256:unset';

    features.push({
      id: row.id,
      title: row.title,
      icon: row.icon,
      moduleName: row.moduleName,
      version,
      hash,
      bundleUrl: buildBundleUrl(baseUrl, row),
      minAppVersion: row.minAppVersion,
    });
  }

  return {
    version: config.manifestVersion,
    updatedAt: new Date().toISOString(),
    mode: config.useMetroBundles ? 'metro' : 'static',
    manifestUrl: `${baseUrl}/api/manifest`,
    features,
  };
}
