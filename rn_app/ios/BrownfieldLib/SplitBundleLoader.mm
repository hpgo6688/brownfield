#import "SplitBundleLoader.h"

#import <React/NSDataBigString.h>
#import <React/RCTBridge+Private.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTBridgeProxy+Cxx.h>
#import <React/RCTBridgeProxy.h>
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

@implementation SplitBundleLoader

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(load
                  : (NSString *)fileUrl resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)
{
  NSURL *url = nil;
  if ([fileUrl hasPrefix:@"/"]) {
    url = [NSURL fileURLWithPath:fileUrl];
  } else {
    url = [NSURL URLWithString:fileUrl];
  }

  if (url == nil) {
    reject(@"EINVAL", @"Invalid bundle URL", nil);
    return;
  }

  NSData *data = [NSData dataWithContentsOfURL:url];
  if (data == nil) {
    reject(@"ENOENT", [NSString stringWithFormat:@"Cannot read bundle at %@", fileUrl], nil);
    return;
  }

  RCTBridge *bridge = self.bridge;
  if (bridge == nil) {
    reject(@"NO_BRIDGE", @"React Native bridge is not ready", nil);
    return;
  }

  RCTBridge *batchedBridge = bridge.batchedBridge ?: bridge;

#ifndef RCT_REMOVE_LEGACY_ARCH
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

  RCTBridgeProxy *bridgeProxy = (RCTBridgeProxy *)batchedBridge;
  void *runtimePtr = [bridgeProxy runtime];
  if (runtimePtr == nullptr) {
    reject(@"NO_RUNTIME", @"React Native runtime is not ready", nil);
    return;
  }

  std::shared_ptr<facebook::react::CallInvoker> callInvoker = bridgeProxy.jsCallInvoker;
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
