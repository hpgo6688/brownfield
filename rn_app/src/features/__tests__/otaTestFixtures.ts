/** Shared OTA bundle bodies for unit tests (passes validateOtaBundleContent). */
export function makeValidOtaBundleBody(featureId: string): string {
  const chunk = `
registerFeature('${featureId}', 'ota_${featureId}Screen', function OtaScreen() {}, { source: 'ota' });
AppRegistry.registerComponent('ota_${featureId}Screen', function OtaScreen() {});
// ota_ split bundle marker
__r(1);
`;
  return chunk.repeat(40);
}
