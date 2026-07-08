#import "SplitBundleLoader.h"

#import <React/RCTBridge+Private.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>

@interface RCTCxxBridge : RCTBridge
- (void)executeApplicationScript:(NSData *)script url:(NSURL *)url async:(BOOL)async;
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
  if (bridge == nil || bridge.batchedBridge == nil) {
    reject(@"NO_BRIDGE", @"React Native bridge is not ready", nil);
    return;
  }

  RCTCxxBridge *cxxBridge = (RCTCxxBridge *)bridge.batchedBridge;
  if (!cxxBridge.valid) {
    reject(@"NO_BRIDGE", @"React Native bridge is not valid", nil);
    return;
  }

  [cxxBridge executeApplicationScript:data url:url async:YES];
  resolve(nil);
}

@end
