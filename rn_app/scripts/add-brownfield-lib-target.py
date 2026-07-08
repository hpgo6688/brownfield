#!/usr/bin/env python3
"""Add BrownfieldLib framework target to rn_app Xcode project."""

from __future__ import annotations

import pathlib
import re
import sys

PROJECT = pathlib.Path(__file__).resolve().parents[1] / "ios" / "rn_app.xcodeproj" / "project.pbxproj"

# Reuse stable IDs from RNApp demo (adapted for rn_app naming in comments only)
IDS = {
    "brownfield_swift_ref": "79F35E8A2EEC1D4500E64860",
    "brownfield_swift_build": "79F35E8C2EEC1D4500E64860",
    "brownfield_framework_ref": "79BD1EE32EEBFB76003AA29F",
    "brownfield_framework_link": "79BD1EE92EEBFB76003AA29F",
    "brownfield_framework_embed": "79BD1EEA2EEBFB76003AA29F",
    "brownfield_group": "79F35E8B2EEC1D4500E64860",
    "brownfield_target": "79BD1EE22EEBFB76003AA29F",
    "brownfield_headers": "79BD1EDE2EEBFB76003AA29F",
    "brownfield_sources": "79BD1EDF2EEBFB76003AA29F",
    "brownfield_frameworks": "79BD1EE02EEBFB76003AA29F",
    "brownfield_resources": "79BD1EE12EEBFB76003AA29F",
    "brownfield_bundle_script": "79BD1EF22EEBFC6F003AA29F",
    "brownfield_embed_phase": "79BD1EEB2EEBFB76003AA29F",
    "brownfield_pods_check": "24E8B7472F26616B6BFC142D",
    "brownfield_pods_resources": "5D40A0F9F23D3E7986C15E2B",
    "brownfield_pods_framework_ref": "C8D39C0AE446DAC8D403AA37",
    "brownfield_pods_framework_link": "1B625B895C45DE3B34C25771",
    "brownfield_pods_debug_xcconfig": "8A02E03D9F74B585B0A8F7F7",
    "brownfield_pods_release_xcconfig": "D8C030F60E402FD6CFBB3904",
    "brownfield_proxy": "79BD1EE72EEBFB76003AA29F",
    "brownfield_dependency": "79BD1EE82EEBFB76003AA29F",
    "brownfield_config_list": "79BD1EEE2EEBFB76003AA29F",
    "brownfield_debug_config": "79BD1EEC2EEBFB76003AA29F",
    "brownfield_release_config": "79BD1EED2EEBFB76003AA29F",
}


def main() -> int:
    text = PROJECT.read_text()
    if "BrownfieldLib" in text:
        print("BrownfieldLib target already present")
        return 0

    i = IDS

    insert_build_files = f"""\t\t{i["brownfield_pods_framework_link"]} /* Pods_rn_app_BrownfieldLib.framework in Frameworks */ = {{isa = PBXBuildFile; fileRef = {i["brownfield_pods_framework_ref"]} /* Pods_rn_app_BrownfieldLib.framework */; }};
\t\t{i["brownfield_framework_link"]} /* BrownfieldLib.framework in Frameworks */ = {{isa = PBXBuildFile; fileRef = {i["brownfield_framework_ref"]} /* BrownfieldLib.framework */; }};
\t\t{i["brownfield_framework_embed"]} /* BrownfieldLib.framework in Embed Frameworks */ = {{isa = PBXBuildFile; fileRef = {i["brownfield_framework_ref"]} /* BrownfieldLib.framework */; settings = {{ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }}; }};
\t\t{i["brownfield_swift_build"]} /* BrownfieldLib.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {i["brownfield_swift_ref"]} /* BrownfieldLib.swift */; }};
"""
    text = text.replace(
        "/* End PBXBuildFile section */",
        insert_build_files + "/* End PBXBuildFile section */",
        1,
    )

    container_proxy = f"""
/* Begin PBXContainerItemProxy section */
\t\t{i["brownfield_proxy"]} /* PBXContainerItemProxy */ = {{
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = 83CBB9F71A601CBA00E9B192 /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = {i["brownfield_target"]};
\t\t\tremoteInfo = BrownfieldLib;
\t\t}};
/* End PBXContainerItemProxy section */

"""
    text = text.replace("/* Begin PBXFileReference section */", container_proxy + "/* Begin PBXFileReference section */", 1)

    embed_phase = f"""
/* Begin PBXCopyFilesBuildPhase section */
\t\t{i["brownfield_embed_phase"]} /* Embed Frameworks */ = {{
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 10;
\t\t\tfiles = (
\t\t\t\t{i["brownfield_framework_embed"]} /* BrownfieldLib.framework in Embed Frameworks */,
\t\t\t);
\t\t\tname = "Embed Frameworks";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXCopyFilesBuildPhase section */

"""
    text = text.replace("/* Begin PBXFileReference section */", embed_phase + "/* Begin PBXFileReference section */", 1)

    file_refs = f"""\t\t{i["brownfield_framework_ref"]} /* BrownfieldLib.framework */ = {{isa = PBXFileReference; explicitFileType = wrapper.framework; includeInIndex = 0; path = BrownfieldLib.framework; sourceTree = BUILT_PRODUCTS_DIR; }};
\t\t{i["brownfield_swift_ref"]} /* BrownfieldLib.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = BrownfieldLib.swift; sourceTree = "<group>"; }};
\t\t{i["brownfield_pods_debug_xcconfig"]} /* Pods-rn_app-BrownfieldLib.debug.xcconfig */ = {{isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.xcconfig; name = "Pods-rn_app-BrownfieldLib.debug.xcconfig"; path = "Target Support Files/Pods-rn_app-BrownfieldLib/Pods-rn_app-BrownfieldLib.debug.xcconfig"; sourceTree = "<group>"; }};
\t\t{i["brownfield_pods_framework_ref"]} /* Pods_rn_app_BrownfieldLib.framework */ = {{isa = PBXFileReference; explicitFileType = wrapper.framework; includeInIndex = 0; path = Pods_rn_app_BrownfieldLib.framework; sourceTree = BUILT_PRODUCTS_DIR; }};
\t\t{i["brownfield_pods_release_xcconfig"]} /* Pods-rn_app-BrownfieldLib.release.xcconfig */ = {{isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.xcconfig; name = "Pods-rn_app-BrownfieldLib.release.xcconfig"; path = "Target Support Files/Pods-rn_app-BrownfieldLib/Pods-rn_app-BrownfieldLib.release.xcconfig"; sourceTree = "<group>"; }};
"""
    text = text.replace(
        "\t\tED297162215061F000B7C4FE /* JavaScriptCore.framework */",
        file_refs + "\t\tED297162215061F000B7C4FE /* JavaScriptCore.framework */",
        1,
    )

    framework_phase = f"""
\t\t{i["brownfield_frameworks"]} /* Frameworks */ = {{
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t{i["brownfield_pods_framework_link"]} /* Pods_rn_app_BrownfieldLib.framework in Frameworks */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
"""
    text = text.replace("/* End PBXFrameworksBuildPhase section */", framework_phase + "/* End PBXFrameworksBuildPhase section */", 1)

    text = text.replace(
        "\t\t\tfiles = (\n\t\t\t\t0C80B921A6F3F58F76C31292 /* libPods-rn_app.a in Frameworks */,\n\t\t\t);",
        f"\t\t\tfiles = (\n\t\t\t\t{i['brownfield_framework_link']} /* BrownfieldLib.framework in Frameworks */,\n\t\t\t\t0C80B921A6F3F58F76C31292 /* libPods-rn_app.a in Frameworks */,\n\t\t\t);",
        1,
    )

    brownfield_group = f"""
\t\t{i["brownfield_group"]} /* BrownfieldLib */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t{i["brownfield_swift_ref"]} /* BrownfieldLib.swift */,
\t\t\t);
\t\t\tpath = BrownfieldLib;
\t\t\tsourceTree = "<group>";
\t\t}};
"""
    text = text.replace(
        "\t\t832341AE1AAA6A7D00B99B32 /* Libraries */ = {",
        brownfield_group + "\t\t832341AE1AAA6A7D00B99B32 /* Libraries */ = {",
        1,
    )

    text = text.replace(
        "\t\t\tchildren = (\n\t\t\t\t13B07FAE1A68108700A75B9A /* rn_app */,\n\t\t\t\t832341AE1AAA6A7D00B99B32 /* Libraries */,",
        "\t\t\tchildren = (\n\t\t\t\t13B07FAE1A68108700A75B9A /* rn_app */,\n\t\t\t\t832341AE1AAA6A7D00B99B32 /* Libraries */,\n\t\t\t\t" + i["brownfield_group"] + " /* BrownfieldLib */,",
        1,
    )

    text = text.replace(
        "\t\t\tchildren = (\n\t\t\t\t13B07F961A680F5B00A75B9A /* rn_app.app */,\n\t\t\t);",
        "\t\t\tchildren = (\n\t\t\t\t13B07F961A680F5B00A75B9A /* rn_app.app */,\n\t\t\t\t" + i["brownfield_framework_ref"] + " /* BrownfieldLib.framework */,\n\t\t\t);",
        1,
    )

    text = text.replace(
        "\t\t\tchildren = (\n\t\t\t\tED297162215061F000B7C4FE /* JavaScriptCore.framework */,\n\t\t\t\t5DCACB8F33CDC322A6C60F78 /* libPods-rn_app.a */,",
        "\t\t\tchildren = (\n\t\t\t\tED297162215061F000B7C4FE /* JavaScriptCore.framework */,\n\t\t\t\t5DCACB8F33CDC322A6C60F78 /* libPods-rn_app.a */,\n\t\t\t\t" + i["brownfield_pods_framework_ref"] + " /* Pods_rn_app_BrownfieldLib.framework */,\n\t\t\t\t" + i["brownfield_framework_ref"] + " /* BrownfieldLib.framework */,",
        1,
    )

    text = text.replace(
        "\t\t\tchildren = (\n\t\t\t\t3B4392A12AC88292D35C810B /* Pods-rn_app.debug.xcconfig */,\n\t\t\t\t5709B34CF0A7D63546082F79 /* Pods-rn_app.release.xcconfig */,\n\t\t\t);",
        "\t\t\tchildren = (\n\t\t\t\t3B4392A12AC88292D35C810B /* Pods-rn_app.debug.xcconfig */,\n\t\t\t\t5709B34CF0A7D63546082F79 /* Pods-rn_app.release.xcconfig */,\n\t\t\t\t" + i["brownfield_pods_debug_xcconfig"] + " /* Pods-rn_app-BrownfieldLib.debug.xcconfig */,\n\t\t\t\t" + i["brownfield_pods_release_xcconfig"] + " /* Pods-rn_app-BrownfieldLib.release.xcconfig */,\n\t\t\t);",
        1,
    )

    headers_phase = f"""
/* Begin PBXHeadersBuildPhase section */
\t\t{i["brownfield_headers"]} /* Headers */ = {{
\t\t\tisa = PBXHeadersBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXHeadersBuildPhase section */

"""
    text = text.replace("/* Begin PBXNativeTarget section */", headers_phase + "/* Begin PBXNativeTarget section */", 1)

    text = text.replace(
        "\t\t\tbuildPhases = (\n\t\t\t\tC38B50BA6285516D6DCD4F65 /* [CP] Check Pods Manifest.lock */,\n\t\t\t\t13B07F871A680F5B00A75B9A /* Sources */,\n\t\t\t\t13B07F8C1A680F5B00A75B9A /* Frameworks */,\n\t\t\t\t13B07F8E1A680F5B00A75B9A /* Resources */,\n\t\t\t\t00DD1BFF1BD5951E006B06BC /* Bundle React Native code and images */,\n\t\t\t\t00EEFC60759A1932668264C0 /* [CP] Embed Pods Frameworks */,\n\t\t\t\tE235C05ADACE081382539298 /* [CP] Copy Pods Resources */,\n\t\t\t);",
        "\t\t\tbuildPhases = (\n\t\t\t\tC38B50BA6285516D6DCD4F65 /* [CP] Check Pods Manifest.lock */,\n\t\t\t\t13B07F871A680F5B00A75B9A /* Sources */,\n\t\t\t\t13B07F8C1A680F5B00A75B9A /* Frameworks */,\n\t\t\t\t13B07F8E1A680F5B00A75B9A /* Resources */,\n\t\t\t\t00DD1BFF1BD5951E006B06BC /* Bundle React Native code and images */,\n\t\t\t\t00EEFC60759A1932668264C0 /* [CP] Embed Pods Frameworks */,\n\t\t\t\tE235C05ADACE081382539298 /* [CP] Copy Pods Resources */,\n\t\t\t\t" + i["brownfield_embed_phase"] + " /* Embed Frameworks */,\n\t\t\t);",
        1,
    )

    text = text.replace(
        "\t\t\tdependencies = (\n\t\t\t);\n\t\t\tname = rn_app;",
        "\t\t\tdependencies = (\n\t\t\t\t" + i["brownfield_dependency"] + " /* PBXTargetDependency */,\n\t\t\t);\n\t\t\tname = rn_app;",
        1,
    )

    brownfield_target = f"""
\t\t{i["brownfield_target"]} /* BrownfieldLib */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {i["brownfield_config_list"]} /* Build configuration list for PBXNativeTarget "BrownfieldLib" */;
\t\t\tbuildPhases = (
\t\t\t\t{i["brownfield_pods_check"]} /* [CP] Check Pods Manifest.lock */,
\t\t\t\t{i["brownfield_headers"]} /* Headers */,
\t\t\t\t{i["brownfield_sources"]} /* Sources */,
\t\t\t\t{i["brownfield_frameworks"]} /* Frameworks */,
\t\t\t\t{i["brownfield_resources"]} /* Resources */,
\t\t\t\t{i["brownfield_bundle_script"]} /* Bundle React Native code and images */,
\t\t\t\t{i["brownfield_pods_resources"]} /* [CP] Copy Pods Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = BrownfieldLib;
\t\t\tproductName = BrownfieldLib;
\t\t\tproductReference = {i["brownfield_framework_ref"]} /* BrownfieldLib.framework */;
\t\t\tproductType = "com.apple.product-type.framework";
\t\t}};
"""
    text = text.replace("/* End PBXNativeTarget section */", brownfield_target + "/* End PBXNativeTarget section */", 1)

    text = text.replace(
        "\t\t\ttargets = (\n\t\t\t\t13B07F861A680F5B00A75B9A /* rn_app */,\n\t\t\t);",
        "\t\t\ttargets = (\n\t\t\t\t13B07F861A680F5B00A75B9A /* rn_app */,\n\t\t\t\t" + i["brownfield_target"] + " /* BrownfieldLib */,\n\t\t\t);",
        1,
    )

    text = text.replace(
        "\t\t\t\tTargetAttributes = {\n\t\t\t\t\t13B07F861A680F5B00A75B9A = {\n\t\t\t\t\t\tLastSwiftMigration = 1120;\n\t\t\t\t\t};\n\t\t\t\t};",
        "\t\t\t\tTargetAttributes = {\n\t\t\t\t\t13B07F861A680F5B00A75B9A = {\n\t\t\t\t\t\tLastSwiftMigration = 1120;\n\t\t\t\t\t};\n\t\t\t\t\t" + i["brownfield_target"] + " = {\n\t\t\t\t\t\tCreatedOnToolsVersion = 26.4.1;\n\t\t\t\t\t};\n\t\t\t\t};",
        1,
    )

    resources_phase = f"""
\t\t{i["brownfield_resources"]} /* Resources */ = {{
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
"""
    text = text.replace("/* End PBXResourcesBuildPhase section */", resources_phase + "/* End PBXResourcesBuildPhase section */", 1)

    shell_scripts = f"""
\t\t{i["brownfield_pods_check"]} /* [CP] Check Pods Manifest.lock */ = {{
\t\t\tisa = PBXShellScriptBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\tinputPaths = (
\t\t\t\t"${{PODS_PODFILE_DIR_PATH}}/Podfile.lock",
\t\t\t\t"${{PODS_ROOT}}/Manifest.lock",
\t\t\t);
\t\t\tname = "[CP] Check Pods Manifest.lock";
\t\t\toutputPaths = (
\t\t\t\t"$(DERIVED_FILE_DIR)/Pods-rn_app-BrownfieldLib-checkManifestLockResult.txt",
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t\tshellPath = /bin/sh;
\t\t\tshellScript = "diff \\"${{PODS_PODFILE_DIR_PATH}}/Podfile.lock\\" \\"${{PODS_ROOT}}/Manifest.lock\\" > /dev/null\\nif [ $? != 0 ] ; then\\n    echo \\"error: The sandbox is not in sync with the Podfile.lock. Run 'pod install' or update your CocoaPods installation.\\" >&2\\n    exit 1\\nfi\\necho \\"SUCCESS\\" > \\"${{SCRIPT_OUTPUT_FILE_0}}\\"\\n";
\t\t\tshowEnvVarsInLog = 0;
\t\t}};
\t\t{i["brownfield_pods_resources"]} /* [CP] Copy Pods Resources */ = {{
\t\t\tisa = PBXShellScriptBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\tinputFileListPaths = (
\t\t\t\t"${{PODS_ROOT}}/Target Support Files/Pods-rn_app-BrownfieldLib/Pods-rn_app-BrownfieldLib-resources-${{CONFIGURATION}}-input-files.xcfilelist",
\t\t\t);
\t\t\tname = "[CP] Copy Pods Resources";
\t\t\toutputFileListPaths = (
\t\t\t\t"${{PODS_ROOT}}/Target Support Files/Pods-rn_app-BrownfieldLib/Pods-rn_app-BrownfieldLib-resources-${{CONFIGURATION}}-output-files.xcfilelist",
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t\tshellPath = /bin/sh;
\t\t\tshellScript = "\\"${{PODS_ROOT}}/Target Support Files/Pods-rn_app-BrownfieldLib/Pods-rn_app-BrownfieldLib-resources.sh\\"\\n";
\t\t\tshowEnvVarsInLog = 0;
\t\t}};
\t\t{i["brownfield_bundle_script"]} /* Bundle React Native code and images */ = {{
\t\t\tisa = PBXShellScriptBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\tinputPaths = (
\t\t\t\t"$(SRCROOT)/.xcode.env.local",
\t\t\t\t"$(SRCROOT)/.xcode.env",
\t\t\t);
\t\t\tname = "Bundle React Native code and images";
\t\t\toutputPaths = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t\tshellPath = /bin/sh;
\t\t\tshellScript = "set -e\\n\\nWITH_ENVIRONMENT=\\"$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh\\"\\nREACT_NATIVE_XCODE=\\"$REACT_NATIVE_PATH/scripts/react-native-xcode.sh\\"\\n\\n/bin/sh -c \\"\\\\\\"$WITH_ENVIRONMENT\\\\\\" \\\\\\"$REACT_NATIVE_XCODE\\\\\\"\\"\\n";
\t\t}};
"""
    text = text.replace("/* End PBXShellScriptBuildPhase section */", shell_scripts + "/* End PBXShellScriptBuildPhase section */", 1)

    sources_phase = f"""
\t\t{i["brownfield_sources"]} /* Sources */ = {{
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t{i["brownfield_swift_build"]} /* BrownfieldLib.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
"""
    text = text.replace("/* End PBXSourcesBuildPhase section */", sources_phase + "/* End PBXSourcesBuildPhase section */", 1)

    dependency = f"""
/* Begin PBXTargetDependency section */
\t\t{i["brownfield_dependency"]} /* PBXTargetDependency */ = {{
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = {i["brownfield_target"]} /* BrownfieldLib */;
\t\t\ttargetProxy = {i["brownfield_proxy"]} /* PBXContainerItemProxy */;
\t\t}};
/* End PBXTargetDependency section */

"""
    text = text.replace("/* Begin XCBuildConfiguration section */", dependency + "/* Begin XCBuildConfiguration section */", 1)

    brownfield_configs = f"""
\t\t{i["brownfield_debug_config"]} /* Debug */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbaseConfigurationReference = {i["brownfield_pods_debug_xcconfig"]} /* Pods-rn_app-BrownfieldLib.debug.xcconfig */;
\t\t\tbuildSettings = {{
\t\t\t\tBUILD_LIBRARY_FOR_DISTRIBUTION = YES;
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEFINES_MODULE = YES;
\t\t\t\tDYLIB_COMPATIBILITY_VERSION = 1;
\t\t\t\tDYLIB_CURRENT_VERSION = 1;
\t\t\t\tDYLIB_INSTALL_NAME_BASE = "@rpath";
\t\t\t\tENABLE_MODULE_VERIFIER = NO;
\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = NO;
\t\t\t\tGENERATE_INFOPLIST_FILE = YES;
\t\t\t\tINSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 15.1;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@loader_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = hailong.rnapp.BrownfieldLib;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME:c99extidentifier)";
\t\t\t\tSKIP_INSTALL = NO;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_INSTALL_OBJC_HEADER = NO;
\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t\tVERSIONING_SYSTEM = "apple-generic";
\t\t\t}};
\t\t\tname = Debug;
\t\t}};
\t\t{i["brownfield_release_config"]} /* Release */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbaseConfigurationReference = {i["brownfield_pods_release_xcconfig"]} /* Pods-rn_app-BrownfieldLib.release.xcconfig */;
\t\t\tbuildSettings = {{
\t\t\t\tBUILD_LIBRARY_FOR_DISTRIBUTION = YES;
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEFINES_MODULE = YES;
\t\t\t\tDYLIB_COMPATIBILITY_VERSION = 1;
\t\t\t\tDYLIB_CURRENT_VERSION = 1;
\t\t\t\tDYLIB_INSTALL_NAME_BASE = "@rpath";
\t\t\t\tENABLE_MODULE_VERIFIER = NO;
\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = NO;
\t\t\t\tGENERATE_INFOPLIST_FILE = YES;
\t\t\t\tINSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 15.1;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@loader_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = hailong.rnapp.BrownfieldLib;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME:c99extidentifier)";
\t\t\t\tSKIP_INSTALL = NO;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_INSTALL_OBJC_HEADER = NO;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t\tVERSIONING_SYSTEM = "apple-generic";
\t\t\t}};
\t\t\tname = Release;
\t\t}};
"""
    text = text.replace(
        "\t\t13B07F951A680F5B00A75B9A /* Release */ = {",
        brownfield_configs + "\t\t13B07F951A680F5B00A75B9A /* Release */ = {",
        1,
    )

    config_list = f"""
\t\t{i["brownfield_config_list"]} /* Build configuration list for PBXNativeTarget "BrownfieldLib" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{i["brownfield_debug_config"]} /* Debug */,
\t\t\t\t{i["brownfield_release_config"]} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};
"""
    text = text.replace("/* End XCConfigurationList section */", config_list + "/* End XCConfigurationList section */", 1)

    PROJECT.write_text(text)
    print(f"Patched {PROJECT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
