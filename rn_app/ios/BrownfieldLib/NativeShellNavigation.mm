#import "NativeShellNavigation.h"

#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>

static NSString *const kPopToNativeNotification = @"PopToNative";

@implementation NativeShellNavigation

RCT_EXPORT_MODULE(NativeShellNavigation);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_EXPORT_METHOD(popToNative)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSNotificationCenter defaultCenter] postNotificationName:kPopToNativeNotification object:nil];
  });
}

@end
