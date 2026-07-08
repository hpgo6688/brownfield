import featureSegments from '../../config/feature-segments.json';

export type FeatureSegmentMap = typeof featureSegments;

export function getFeatureSegmentId(featureId: string): number {
  const segmentId = featureSegments[featureId as keyof FeatureSegmentMap];
  if (segmentId == null) {
    throw new Error(
      `Missing Metro segment id for feature "${featureId}". Add it to config/feature-segments.json.`,
    );
  }
  return segmentId;
}

export function hasFeatureSegmentId(featureId: string): boolean {
  return featureSegments[featureId as keyof FeatureSegmentMap] != null;
}
