## Why

After `ota-bundle-prefix-isolation`, Remote pages split into `screens/remote/` (Metro dev) and `screens/ota/` (OTA upload bundles). Both directories sit under `screens/` and look equally “editable,” so developers may change `screens/ota/` expecting Metro HMR — or skip rebuilding/uploading after OTA UI changes. **`screens/ota/` only takes effect after `build:bundles` + upload**, not during `npm start`. We need structural and tooling guardrails so the build-only scope is obvious and violations fail fast.

## What Changes

- Relocate OTA screen sources from top-level `screens/ota/` into **`bundles/ota_<featureId>/screens/`** (colocated with split bundle entries — build/upload territory)
- Extract shared presentational UI to **`screens/remote/components/`** (or `screens/shared/remote/`) imported by Metro screens and OTA bundle screens — single place for business UI edits during dev
- Add **ESLint `no-restricted-imports`** (and optional CI script) blocking `screens/ota/**` imports outside `bundles/ota_*`; block Metro/runtime code from importing OTA bundle internals
- Add **Metro dev blocklist** so `screens/ota/` (if any legacy path remains) and `bundles/ota_*` are not resolvable in the main dev graph
- Add **README guard files** at `screens/remote/README.md` and `bundles/README.md` explaining edit → build → upload workflow
- Add **`npm run verify:ota-scope`** — static check in CI/pre-upload that main bundle graph and Metro dev entry paths exclude OTA-only modules
- Update docs (`dynamic-multi-bundle.md`) with a clear “where to edit” table
- **BREAKING**: Remove `screens/ota/` top-level directory; update imports in `bundles/ota_*` and `build-bundles.js` split filters

## Capabilities

### New Capabilities

- `ota-screens-colocation`: OTA UI lives under `bundles/ota_<id>/screens/`, not alongside Metro dev screens
- `ota-screens-dev-guardrails`: Lint, Metro blocklist, verify script, and docs prevent accidental Metro dev edits to OTA-only paths

### Modified Capabilities

- `ota-bundle-build-prefix` (change `ota-bundle-prefix-isolation`): Split filter paths move from `screens/ota/` to `bundles/ota_*/screens/`

## Impact

- **rn_app**: `bundles/ota_*`, remove `screens/ota/`, new shared components, `.eslintrc.js`, `metro.config.js`, `scripts/verify-ota-scope.js`, `package.json` scripts
- **Docs**: `dynamic-multi-bundle.md`, new README guard files
- **CI** (optional): run `verify:ota-scope` on PR
- **No runtime/API changes** to FeatureHost, bundle-server, or native shell
