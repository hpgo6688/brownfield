/**
 * DEV: register shared modules in the Metro host before native split segment
 * eval. Legacy split builds excluded these from output expecting the main bundle
 * to already define them; Metro lazy main may not have loaded them yet.
 *
 * Split bundles reference use-latest-callback/esm.mjs as module 745032085 — the
 * package root resolve may register a different id.
 */
export function preloadOtaSplitHostModules(): void {
  if (!__DEV__) {
    return;
  }

  try {
    require('use-latest-callback/esm.mjs');
    console.log('[OTA] preloaded use-latest-callback/esm.mjs in host');
  } catch {
    // Optional — new self-contained splits do not need every warm import.
  }

  try {
    require('use-latest-callback');
    console.log('[OTA] preloaded use-latest-callback in host');
  } catch {
    // Optional
  }

  try {
    require('use-sync-external-store/with-selector');
    console.log('[OTA] preloaded use-sync-external-store/with-selector in host');
  } catch {
    // Optional
  }
}
