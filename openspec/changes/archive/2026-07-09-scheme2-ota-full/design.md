## Context

The brownfield project integrates RN via `@callstack/react-native-brownfield` — **one JS Runtime singleton** per app.

### Product split (what users see in the native shell)

```
Native Shell menu
├── 原生页面
├── React Native · 核心 RN（Scheme 1）     ← 本地固定，不走 manifest
│     HomeScreen / ProfileScreen / SettingsScreen
└── React Native · 远程业务（Remote）      ← manifest 动态入口 + OTA
      order / promo / …（服务端可增删）
```

### Technical mapping

| Product | Implementation | Notes |
|---------|----------------|-------|
| Scheme 1 core RN | Single main bundle + `LocalReactNativeScreenView(moduleName:)` | No bundle-server required |
| Remote business block | Scheme 2 tech: manifest + split sub-bundles + `FeatureHost` + OTA | Same `rn_app`, same BrownfieldLib, same Runtime |

Remote is **not** Re.Pack 方案三 and **not** a second XCFramework 方案四 unless Remote business later requires a different RN version (explicit future decision).

### Current demo problem

Early implementation used `screens/dynamic/Dynamic*Screen` as **copies** of Scheme 1 tabs (`home`, `profile`, `settings`). That was useful for A/B comparison but is **not** the target product model. Remote entries should represent **new business surfaces** independent of core tabs.

### OTA gap (before this change)

Server-side manifest v2, upload, and Admin exist (Fastify + Prisma). Client-side cache, Release split load, and Remote-only page model still need alignment.

## Goals / Non-Goals

**Goals:**

- End-to-end OTA for **Remote entries**: build → upload → manifest → client compare → download → verify → cache → split load
- Admin can **register new Remote entries** and publish bundles without app release
- Native menu shows Remote block from manifest; Scheme 1 menu unchanged
- Shared `bundleUpdater` callable from `FeatureHost`, Remote RN pages, and optional native triggers
- Release load via iOS `SplitBundleLoader` (no duplicate React / no full-bundle `eval`)
- Fallback: last good cache → main-bundle built-in Remote registry (offline / first launch)
- Dev: Metro + `USE_METRO_BUNDLES=true` + `modulesOnly=true`

**Non-Goals:**

- OTA for Scheme 1 (`HomeScreen`, etc.)
- OTA for main/bootstrap bundle (`index.js` / BrownfieldLib) — requires native App update
- Re.Pack Module Federation (multi-bundle.md 方案三)
- Second RN repo / XCFramework for Remote (方案四) in v1
- Android split loader
- Gray release / A-B engine
- CodePush / Expo Updates
- Hermes `.hbc` in v1

## Decisions

### 1. Naming: Remote (product) vs Scheme 2 (tech)

**Choice:** User-facing labels use **「远程业务 / Remote entries」**. Docs refer to **Scheme 2** only when describing split-bundle + manifest + OTA mechanics.

**Rationale:** Avoid implying Remote = duplicate of Scheme 1 pages or a separate RN app.

### 2. Remote entry content model

**Choice:** Remote pages live in `rn_app/screens/remote/` with matching `bundles/<entryId>/index.js` sub-bundle entries. Seed examples: `order`, `promo` — **not** mirrors of `home/profile/settings`.

**Rationale:** Remote block is an extensible business area; manifest controls which entries appear.

**Alternative:** Keep Dynamic* mirror pages — rejected for product clarity.

### 3. Manifest persistence: Prisma + SQLite

**Choice:** `Feature` and `BundleRelease` models in Prisma (replaces original `manifest.store.json` design).

**Rationale:** Upload, rollback, and Admin need relational history; already implemented in bundle-server v2.

### 4. Version identity: semver + sha256 hash

**Choice:** Each Remote entry carries `version` and `hash` (`sha256:<hex>`). Client compares semver first; hash verifies download integrity.

### 5. Client cache: react-native-fs

**Choice:** `DocumentDirectory/rn-bundles/<entryId>/<version>.jsbundle` + `metadata.json`; keep latest 2 versions per entry.

### 6. Release load: SplitBundleLoader native module

**Choice:** `SplitBundleLoader.load(fileUrl)` → `RCTCxxBridge executeApplicationScript` on existing bridge.

**Rationale:** Full-bundle `eval` duplicates React → hooks crash.

### 7. Shared orchestration: bundleUpdater.ts

**Choice:** `checkAndUpdateFeature`, `preloadFeatures`, `getCachedFeatureVersion` — used by FeatureHost and any RN screen.

### 8. Main bundle fallback registry

**Choice:** `index.js` registers built-in Remote features via `registerFeature()` for offline/first-launch fallback only.

**Trade-off:** Main bundle includes last-shipped Remote pages; OTA overrides registry after successful split load.

### 9. Create Remote entry via Admin

**Choice:** Add `POST /api/features` (or Admin form) to register new `featureId`, `title`, `icon`, `moduleName`, `metroEntry` before first upload.

**Rationale:** Remote block must grow without code deploy to bundle-server seed.

### 10. OTA trigger matrix

| Trigger | Scope | Implementation |
|---------|-------|----------------|
| Native menu refresh | Remote **menu visibility** | `BundleManifestService.load()` |
| FeatureHost enter page | Remote **bundle content** | `bundleUpdater.checkAndUpdateFeature` |
| Remote RN settings UI | Manual check | e.g. button on a Remote page |
| Silent preload | Remote bundles | `preloadFeatures([...])` |
| Scheme 1 pages | N/A | Never OTA |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Terminology confusion (Scheme 2 vs Remote vs Re.Pack 3) | This design doc + doc updates |
| Split bundle includes React if misbuilt | CI hash checks; Metro shared moduleId factory |
| RN 0.86 bridge API drift | Test Release on simulator; gate on SplitBundleLoader availability |
| Cache growth | Prune to 2 versions per entry |
| Main + OTA module ID collision | Shared `createModuleIdFactory` in metro.config.js |
| Upload API security (dev) | Document production API key requirement |

## Migration Plan

1. Update OpenSpec + docs terminology (this change)
2. Reseed: `order`, `promo` Remote entries; deprecate mirror `home/profile/settings` dynamic demo
3. Rename menu section in `ContentView` to Remote / 远程业务
4. Ship client OTA (cache, updater, SplitBundleLoader)
5. Admin: create-entry API
6. Rebuild `brownfield:package:ios:debug`
7. Rollback: disable entry in manifest or activate prior release

## Open Questions

- Exact Remote v1 pages: `order` + `promo` vs one `activity` entry first?
- Whether built-in fallback in main bundle ships all Remote pages or only a minimal stub per entry
- Startup preload: native manifest-only vs JS `preloadFeatures` on app launch
