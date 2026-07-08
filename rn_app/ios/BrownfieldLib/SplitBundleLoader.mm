#import "SplitBundleLoader.h"

#import <React/NSDataBigString.h>
#import <React/RCTBridge+Private.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTBridgeProxy+Cxx.h>
#import <React/RCTBridgeProxy.h>
#import <React/RCTCallInvoker.h>
#import <React/RCTCallInvokerModule.h>
#import <React/RCTCxxUtils.h>
#import <React/RCTLog.h>
#import <React/RCTUtils.h>

using facebook::react::deriveSourceURL;

#import <ReactCommon/CallInvoker.h>
#import <jsi/jsi.h>

#ifndef RCT_REMOVE_LEGACY_ARCH
@interface RCTCxxBridge (SplitBundleLoaderPrivate)
- (void)executeApplicationScript:(NSData *)script url:(NSURL *)url async:(BOOL)async;
@end
#endif

@interface RCTBridgeProxy (SplitBundleLoaderPrivate)
- (void *)runtime;
@end

@interface SplitBundleLoader () <RCTCallInvokerModule>
@end

@implementation SplitBundleLoader {
  __weak RCTBridge *_bridge;
  RCTCallInvoker *_callInvoker;
}

@synthesize bridge = _bridge;
@synthesize callInvoker = _callInvoker;

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

static RCTBridge *CurrentBridge(void)
{
  return [RCTBridge currentBridge];
}

static std::shared_ptr<facebook::react::CallInvoker> JSCallInvokerForModule(SplitBundleLoader *module, RCTBridge *bridge)
{
  if (module.callInvoker != nil) {
    return module.callInvoker.callInvoker;
  }

  RCTBridge *batchedBridge = bridge.batchedBridge ?: bridge;
  if ([batchedBridge isKindOfClass:[RCTBridgeProxy class]]) {
    return ((RCTBridgeProxy *)batchedBridge).jsCallInvoker;
  }

  return nullptr;
}

static void *RuntimeForBridge(RCTBridge *bridge)
{
  RCTBridge *batchedBridge = bridge.batchedBridge ?: bridge;

#ifndef RCT_REMOVE_LEGACY_ARCH
  if ([batchedBridge isKindOfClass:[RCTCxxBridge class]]) {
    return ((RCTCxxBridge *)batchedBridge).runtime;
  }
#endif

  if ([batchedBridge isKindOfClass:[RCTBridgeProxy class]]) {
    return [(RCTBridgeProxy *)batchedBridge runtime];
  }

  return nullptr;
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
                  : (NSString *)fileUrl resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)
{
  NSString *path = NormalizedFilePath(fileUrl);
  if (path.length == 0) {
    reject(@"EINVAL", @"Invalid bundle path", nil);
    return;
  }

  NSURL *url = [NSURL fileURLWithPath:path];
  if (![[NSFileManager defaultManager] fileExistsAtPath:path]) {
    reject(@"ENOENT", [NSString stringWithFormat:@"Cannot read bundle at %@", path], nil);
    return;
  }

  NSError *readError = nil;
  NSData *data = [NSData dataWithContentsOfFile:path options:0 error:&readError];
  if (data == nil) {
    reject(
        @"ENOENT",
        [NSString stringWithFormat:@"Cannot read bundle at %@ (%@)", path, readError.localizedDescription ?: @"unknown"],
        readError);
    return;
  }

  RCTBridge *bridge = self.bridge ?: CurrentBridge();
  if (bridge == nil) {
    reject(@"NO_BRIDGE", @"React Native bridge is not ready", nil);
    return;
  }

#ifndef RCT_REMOVE_LEGACY_ARCH
  RCTBridge *batchedBridge = bridge.batchedBridge ?: bridge;
  if ([batchedBridge isKindOfClass:[RCTCxxBridge class]]) {
    RCTCxxBridge *cxxBridge = (RCTCxxBridge *)batchedBridge;
    if (!cxxBridge.valid) {
      reject(@"NO_BRIDGE", @"React Native bridge is not valid", nil);
      return;
    }

    [cxxBridge executeApplicationScript:data url:url async:YES];
    resolve(nil);
    return;
  }
#endif

  void *runtimePtr = RuntimeForBridge(bridge);
  if (runtimePtr == nullptr) {
    reject(@"NO_RUNTIME", @"React Native runtime is not ready", nil);
    return;
  }

  std::shared_ptr<facebook::react::CallInvoker> callInvoker = JSCallInvokerForModule(self, bridge);
  if (callInvoker == nullptr) {
    reject(@"NO_INVOKER", @"React Native JS call invoker is not ready", nil);
    return;
  }

  NSString *sourceURL = deriveSourceURL(url);
  auto buffer = std::make_shared<facebook::react::NSDataBigString>(data);
  std::string sourceURLStd = sourceURL.UTF8String ?: "";

  callInvoker->invokeAsync([runtimePtr, buffer, sourceURLStd]() {
    try {
      auto &runtime = *reinterpret_cast<facebook::jsi::Runtime *>(runtimePtr);
      runtime.evaluateJavaScript(buffer, sourceURLStd);
    } catch (const std::exception &ex) {
      RCTLogError(@"SplitBundleLoader failed to evaluate bundle: %s", ex.what());
    } catch (...) {
      RCTLogError(@"SplitBundleLoader failed to evaluate bundle: unknown error");
    }
  });

  resolve(nil);
}

@end
