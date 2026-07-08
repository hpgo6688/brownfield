#import "SplitBundleLoader.h"

#import <React/RCTBridge+Private.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTBridgeProxy.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>

#ifndef RCT_REMOVE_LEGACY_ARCH
@interface RCTCxxBridge (SplitBundleLoaderPrivate)
- (BOOL)isValid;
@end
#endif

@interface RCTBridgeProxy (SplitBundleLoaderPrivate)
- (RCTBridgeProxy *)object;
@end

@interface SplitBundleLoader ()
@end

@implementation SplitBundleLoader {
  __weak RCTBridge *_bridge;
}

@synthesize bridge = _bridge;

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

static RCTBridge *BridgeTarget(RCTBridge *bridge)
{
  return bridge.batchedBridge ?: bridge;
}

static BOOL IsBridgelessProxy(RCTBridge *bridge)
{
  return bridge != nil && [bridge respondsToSelector:@selector(object)];
}

static RCTBridge *ActiveBridge(SplitBundleLoader *module)
{
  RCTBridge *bridge = module.bridge;
  if (bridge != nil) {
    return bridge;
  }

  return [RCTBridge currentBridge];
}

static NSString *NormalizedFilePath(NSString *fileArgument)
{
  if ([fileArgument hasPrefix:@"file://"]) {
    NSURL *fileURL = [NSURL URLWithString:fileArgument];
    if (fileURL.path.length > 0) {
      return fileURL.path;
    }

    return [fileArgument substringFromIndex:7];
  }

  return fileArgument;
}

RCT_EXPORT_METHOD(load
                  : (NSString *)fileUrl segmentId
                  : (nonnull NSNumber *)segmentId resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)
{
  if (segmentId == nil) {
    reject(@"EINVAL", @"Missing Metro segment id", nil);
    return;
  }

  int64_t rawSegmentId = segmentId.longLongValue;
  if (rawSegmentId < 0 || rawSegmentId > UINT32_MAX) {
    reject(@"EINVAL", @"Metro segment id is out of range", nil);
    return;
  }

  NSString *path = NormalizedFilePath(fileUrl);
  if (path.length == 0) {
    reject(@"EINVAL", @"Invalid bundle path", nil);
    return;
  }

  if (![[NSFileManager defaultManager] fileExistsAtPath:path]) {
    reject(@"ENOENT", [NSString stringWithFormat:@"Cannot read bundle at %@", path], nil);
    return;
  }

  RCTBridge *bridge = ActiveBridge(self);
  if (bridge == nil) {
    reject(@"NO_BRIDGE", @"React Native bridge is not ready", nil);
    return;
  }

  RCTBridge *target = BridgeTarget(bridge);
  if (![target respondsToSelector:@selector(registerSegmentWithId:path:)]) {
    reject(
        @"NO_LOADER",
        @"Split bundle loading is unavailable for this React Native runtime. Rebuild BrownfieldLib.",
        nil);
    return;
  }

#ifndef RCT_REMOVE_LEGACY_ARCH
  if ([target isKindOfClass:[RCTCxxBridge class]]) {
    RCTCxxBridge *cxxBridge = (RCTCxxBridge *)target;
    if (!cxxBridge.valid) {
      reject(@"NO_BRIDGE", @"React Native bridge is not valid", nil);
      return;
    }
  }
#endif

  NSUInteger resolvedSegmentId = (NSUInteger)rawSegmentId;
  if (IsBridgelessProxy(target)) {
    RCTLogInfo(
        @"SplitBundleLoader (bridgeless proxy) registering segment %lu at %@",
        (unsigned long)resolvedSegmentId,
        path);
  } else {
    RCTLogInfo(@"SplitBundleLoader registering segment %lu at %@", (unsigned long)resolvedSegmentId, path);
  }

  [target registerSegmentWithId:resolvedSegmentId path:path];
  resolve(nil);
}

@end
