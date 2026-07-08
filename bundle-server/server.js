const cors = require('cors');
const express = require('express');
const fs = require('fs');
const path = require('path');

const manifestConfig = require('./manifest.config');

const app = express();
const PORT = process.env.PORT || 3001;
const METRO_HOST = process.env.METRO_HOST || 'http://127.0.0.1:8081';
const USE_METRO_BUNDLES = process.env.USE_METRO_BUNDLES === 'true';

const distDir = path.join(__dirname, 'dist', 'bundles');

app.use(cors());
app.use(express.json());

function buildManifest(req) {
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  const features = manifestConfig.features
    .filter(feature => feature.enabled)
    .map(feature => {
      const bundleUrl = USE_METRO_BUNDLES
        ? `${METRO_HOST}/${feature.metroEntry}.bundle?platform=ios&dev=true&minify=false`
        : `${baseUrl}/bundles/${feature.bundleFile}`;

      return {
        id: feature.id,
        title: feature.title,
        icon: feature.icon,
        moduleName: feature.moduleName,
        bundleUrl,
      };
    });

  return {
    version: manifestConfig.version,
    updatedAt: new Date().toISOString(),
    mode: USE_METRO_BUNDLES ? 'metro' : 'static',
    manifestUrl: `${baseUrl}/api/manifest`,
    features,
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/manifest', (req, res) => {
  res.json(buildManifest(req));
});

/** Toggle feature visibility at runtime (demo admin API). */
app.post('/api/features/:id/toggle', (req, res) => {
  const feature = manifestConfig.features.find(item => item.id === req.params.id);
  if (!feature) {
    res.status(404).json({ error: 'Feature not found' });
    return;
  }

  feature.enabled = req.body.enabled ?? !feature.enabled;
  res.json(buildManifest(req));
});

app.get('/api/features', (req, res) => {
  res.json({
    features: manifestConfig.features.map(feature => ({
      id: feature.id,
      title: feature.title,
      enabled: feature.enabled,
    })),
  });
});

app.use('/bundles', express.static(distDir));

app.use((req, res, next) => {
  if (req.path.startsWith('/bundles/')) {
    res.status(404).json({
      error: 'Bundle not found. Run: cd rn_app && npm run build:bundles',
    });
    return;
  }
  next();
});

app.listen(PORT, () => {
  const bundleCount = fs.existsSync(distDir)
    ? fs.readdirSync(distDir).filter(name => name.endsWith('.jsbundle')).length
    : 0;

  console.log(`Bundle server listening on http://127.0.0.1:${PORT}`);
  console.log(`Manifest: http://127.0.0.1:${PORT}/api/manifest`);
  console.log(`Mode: ${USE_METRO_BUNDLES ? 'metro (dev)' : 'static bundles'}`);
  console.log(`Static bundles in dist: ${bundleCount}`);
});
