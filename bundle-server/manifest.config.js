/**
 * Server-side feature registry.
 * Toggle `enabled` to control which RN entries appear in the native shell.
 */
module.exports = {
  version: 1,
  features: [
    {
      id: 'home',
      title: '首页',
      icon: 'house',
      enabled: true,
      moduleName: 'HomeScreen',
      bundleFile: 'home.ios.jsbundle',
      metroEntry: 'bundles/home/index',
    },
    {
      id: 'profile',
      title: '个人中心',
      icon: 'person',
      enabled: true,
      moduleName: 'ProfileScreen',
      bundleFile: 'profile.ios.jsbundle',
      metroEntry: 'bundles/profile/index',
    },
    {
      id: 'settings',
      title: '设置',
      icon: 'gearshape',
      enabled: true,
      moduleName: 'SettingsScreen',
      bundleFile: 'settings.ios.jsbundle',
      metroEntry: 'bundles/settings/index',
    },
  ],
};
