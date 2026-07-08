#import "SplitBundleLoader.h"

#import <React/RCTBridge+Private.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTBridgeProxy.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>
#import <objc/runtime.h>

#if __has_include(<RNSplitBundleLoaderSpec/RNSplitBundleLoaderSpec.h>)
#import <RNSplitBundleLoaderSpec/RNSplitBundleLoaderSpec.h>
#endif

#ifndef RCT_REMOVE_LEGACY_ARCH
@interface RCTCxxBridge (SplitBundleLoaderPrivate)
@end
#endif

@interface RCTBridgeProxy (SplitBundleLoaderPrivate)
- (RCTBridgeProxy *)object;
- (void)registerSegmentWithId:(NSUInteger)segmentId path:(NSString *)path;
@end

static BOOL IsBridgelessProxy(RCTBridge *bridge)
{
  if (bridge == nil) {
    return NO;
  }

  // NSProxy subclasses report methods via methodSignatureForSelector:, so
  // respondsToSelector: is unreliable for RCTBridgeProxy. Compare the real class.
  return [NSStringFromClass(object_getClass(bridge)) isEqualToString:@"RCTBridgeProxy"];
}

@implementation SplitBundleLoader {
  __weak RCTBridge *_bridge;
  __weak RCTBridgeProxy *_bridgeProxy;
}

@synthesize bridge = _bridge;

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)setBridge:(RCTBridge *)bridge
{
  _bridge = bridge;
  if (IsBridgelessProxy(bridge)) {
    _bridgeProxy = (RCTBridgeProxy *)bridge;
    NSLog(@"[SplitBundleLoader] setBridge: cached RCTBridgeProxy");
    return;
  }

  _bridgeProxy = nil;
  NSLog(
      @"[SplitBundleLoader] setBridge: class=%@",
      bridge != nil ? NSStringFromClass(object_getClass(bridge)) : @"(nil)");
}

static BOOL InstanceImplementsRegisterSegment(id target)
{
  return class_getInstanceMethod(object_getClass(target), @selector(registerSegmentWithId:path:)) != NULL;
}

static void InvokeRegisterSegment(id target, NSUInteger segmentId, NSString *path)
{
  [(id)target registerSegmentWithId:segmentId path:path];
}

static RCTBridge *ActiveBridge(SplitBundleLoader *module)
{
  if (module->_bridgeProxy != nil) {
    return (RCTBridge *)module->_bridgeProxy;
  }

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

static BOOL RegisterFeatureSegment(
    SplitBundleLoader *module,
    RCTBridge *bridge,
    NSUInteger segmentId,
    NSString *path,
    RCTPromiseRejectBlock reject)
{
  RCTBridgeProxy *cachedProxy = module->_bridgeProxy;
  if (cachedProxy != nil) {
    NSLog(
        @"[SplitBundleLoader] cached bridgeless proxy registerSegmentWithId:%lu path:%@",
        (unsigned long)segmentId,
        path);
    [cachedProxy registerSegmentWithId:segmentId path:path];
    return YES;
  }

  NSLog(@"[SplitBundleLoader] bridge class=%@", NSStringFromClass(object_getClass(bridge)));

  // RCTBridgeProxy (bridgeless): call directly — never use respondsToSelector on NSProxy.
  if (IsBridgelessProxy(bridge)) {
    NSLog(
        @"[SplitBundleLoader] bridgeless proxy registerSegmentWithId:%lu path:%@",
        (unsigned long)segmentId,
        path);
    [(RCTBridgeProxy *)bridge registerSegmentWithId:segmentId path:path];
    return YES;
  }

#ifndef RCT_REMOVE_LEGACY_ARCH
  RCTBridge *batchedBridge = bridge.batchedBridge ?: bridge;
  if ([batchedBridge isKindOfClass:[RCTCxxBridge class]]) {
    RCTCxxBridge *cxxBridge = (RCTCxxBridge *)batchedBridge;
    if (!cxxBridge.valid) {
      reject(@"NO_BRIDGE", @"React Native bridge is not valid", nil);
      return YES;
    }

    NSLog(@"[SplitBundleLoader] legacy registerSegmentWithId:%lu path:%@", (unsigned long)segmentId, path);
    [cxxBridge registerSegmentWithId:segmentId path:path];
    return YES;
  }
#endif

  if (InstanceImplementsRegisterSegment(bridge)) {
    NSLog(@"[SplitBundleLoader] registerSegmentWithId:%lu path:%@", (unsigned long)segmentId, path);
    InvokeRegisterSegment(bridge, segmentId, path);
    return YES;
  }

  return NO;
}

- (void)load:(NSString *)fileUrl
    segmentId:(double)segmentId
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"[SplitBundleLoader] load called segmentId=%.0f fileUrl=%@", segmentId, fileUrl);

  if (segmentId < 0 || segmentId > UINT32_MAX) {
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

  NSUInteger resolvedSegmentId = (NSUInteger)segmentId;
  if (!RegisterFeatureSegment(self, bridge, resolvedSegmentId, path, reject)) {
    NSString *bridgeClass = NSStringFromClass(object_getClass(bridge));
    reject(
        @"NO_LOADER",
        [NSString
            stringWithFormat:
                @"Split bundle loading is unavailable for this React Native runtime (bridge=%@). Rebuild BrownfieldLib and Clean Build in Xcode.",
            bridgeClass],
        nil);
    return;
  }

  resolve(nil);
}

RCT_EXPORT_METHOD(load
                  : (NSString *)fileUrl segmentId
                  : (nonnull NSNumber *)segmentId resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)
{
  [self load:fileUrl segmentId:segmentId.doubleValue resolve:resolve reject:reject];
}

#ifdef __cplusplus
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
#if __has_include(<RNSplitBundleLoaderSpec/RNSplitBundleLoaderSpec.h>)
  return std::make_shared<facebook::react::NativeSplitBundleLoaderSpecJSI>(params);
#else
  return nullptr;
#endif
}
#endif

@end
