#if __has_include(<RNSplitBundleLoaderSpec/RNSplitBundleLoaderSpec.h>)
#import <RNSplitBundleLoaderSpec/RNSplitBundleLoaderSpec.h>

@interface SplitBundleLoader : NativeSplitBundleLoaderSpecBase <NativeSplitBundleLoaderSpec>
@end
#else
#import <React/RCTBridgeModule.h>

@interface SplitBundleLoader : NSObject <RCTBridgeModule>
@end
#endif
