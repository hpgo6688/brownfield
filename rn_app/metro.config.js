const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/** Deterministic module IDs so feature bundles stay compatible with the main bundle. */
function createModuleIdFactory() {
  return modulePath => {
    let hash = 0;
    for (let i = 0; i < modulePath.length; i += 1) {
      hash = (hash * 31 + modulePath.charCodeAt(i)) >>> 0;
    }
    return hash % 1000000000;
  };
}

const config = {
  serializer: {
    createModuleIdFactory,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
