## Context

Remote feature development has two distinct lifecycles:

| Path | When it runs | How changes apply |
|------|--------------|-------------------|
| `screens/remote/` | Metro dev (`npm start`, DEBUG Metro mode) | HMR immediately |
| OTA screens (today `screens/ota/`) | After `build:bundles` + upload + OTA load | Requires rebuild & upload |

Developers naturally edit under `screens/` during feature work. Top-level `screens/ota/` looks like a normal screen folder but **is invisible to Metro dev** — a footgun introduced by the prefix-isolation change.

## Goals / Non-Goals

**Goals:**

- Make OTA-only code visually and physically distinct from Metro dev code
- Fail fast (lint/CI) when runtime or Metro paths import OTA bundle sources
- Document a single “edit UI here during dev” location (shared components + `screens/remote/`)
- Keep OTA screens able to show OTA-specific markers (badge, copy) without duplicating all business logic

**Non-Goals:**

- Separate RN project or repo for OTA bundles
- Auto-sync/copy from `screens/remote/` to OTA on every save (hides the build step, wrong mental model)
- Changing manifest/featureId or runtime loading logic

## Decisions

### 1. Colocate OTA screens under `bundles/ota_<id>/screens/`

**Decision:** Delete top-level `screens/ota/`. Move `OrderScreen.tsx` / `PromoScreen.tsx` to:

```
bundles/ota_order/screens/OrderScreen.tsx
bundles/ota_promo/screens/PromoScreen.tsx
```

Bundle entry `bundles/ota_order/index.js` imports from `./screens/OrderScreen`.

**Rationale:** `bundles/` is already understood as “split bundle / upload artifacts.” Developers editing Metro UI stay in `screens/remote/`; OTA-specific wrappers live next to the entry that gets uploaded.

**Alternative considered:** Keep `screens/ota/` with README only — rejected; directory placement still invites mistaken edits.

### 2. Shared UI in `screens/remote/components/`

**Decision:** Extract order list, promo list, hero layout into shared components (e.g. `OrderList`, `PromoList`). Metro `screens/remote/OrderScreen.tsx` composes shared + Metro badge. OTA `bundles/ota_order/screens/OrderScreen.tsx` composes shared + OTA badge.

**Rationale:** Most day-to-day UI work happens once in shared components; OTA files stay thin and rarely touched.

**Import direction:** Shared components MUST NOT import from `bundles/ota_*` or OTA screens. OTA screens MAY import from `screens/remote/components/`.

### 3. ESLint `no-restricted-imports`

**Decision:** Add rules:

- Forbid importing `**/screens/ota/**` (legacy path) from any file outside `bundles/ota_*`
- Forbid importing `**/bundles/ota_*/**` from `screens/remote/**`, `src/features/**`, `index.js`, except allowed shared-component paths if under `screens/remote/components/` consumed by OTA via explicit allowlist

Practical rule set:

```js
// Disallow runtime imports of OTA bundle dirs
patterns: [
  { group: ['**/bundles/ota_*', '**/bundles/ota_*/*'], message: 'OTA bundle code is build-only. Edit screens/remote/ for Metro dev.' }
]
// Applied to: screens/remote/**, src/**, index.js — EXCLUDE bundles/ota_* themselves
```

### 4. Metro blocklist for dev server

**Decision:** Extend `metro.config.js` with `resolver.blockList` excluding:

- `bundles/ota_.*/` (entire OTA bundle trees from casual dev imports)
- Legacy `screens/ota/` if present

**Rationale:** Even without ESLint, Metro won't serve OTA bundle sources into the main graph during `npm start`.

### 5. `verify:ota-scope` script

**Decision:** Node script run in CI and documented pre-upload:

1. Build main-bundle module graph from `index.js` (reuse `build-bundles.js` helper or lightweight Metro graph)
2. Assert zero modules under `bundles/ota_` or `screens/ota`
3. Exit non-zero with readable report

**Rationale:** Lint catches static imports; graph check catches dynamic/re-export edge cases.

### 6. README guard files (not code comments only)

**Decision:**

- `screens/remote/README.md` — “Edit here for Metro dev. UI building blocks in `./components/`.”
- `bundles/README.md` — “OTA upload bundles only. Changes require `npm run build:bundles` + upload. Do not import from app runtime.”

Each OTA screen file gets a one-line file header comment: `// BUILD/UPLOAD ONLY — not used by Metro dev`.

## Risks / Trade-offs

- **[Risk] Shared components pull Metro-only deps into OTA bundle** → Mitigate: keep shared components RN-primitive only; no `metroDevFeatures` / bundleUpdater imports in shared layer
- **[Risk] ESLint false positives for bundle entry files** → Mitigate: override eslint config for `bundles/ota_*/**`
- **[Risk] Developers still edit OTA wrapper for badge text** → Acceptable; README + header comment clarify upload required

## Migration Plan

1. Extract shared components from current remote/ota screens
2. Move OTA screens into `bundles/ota_*/screens/`, update entries and split filters
3. Delete `screens/ota/`
4. Add ESLint, Metro blocklist, verify script, READMEs
5. Update docs; run `build:bundles` + upload smoke test

## Open Questions

- Should `verify:ota-scope` run on every PR or only pre-upload docs? → Default: add npm script; wire to CI if repo has RN CI
- Rename `screens/remote/` to `screens/remote-dev/`? → Out of scope; too disruptive for minimal gain
