module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: [
        'index.js',
        'src/**/*.{js,jsx,ts,tsx}',
        'screens/remote/**/*.{js,jsx,ts,tsx}',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/bundles/ota_*', '**/bundles/ota_*/*'],
                message:
                  'OTA bundle code is build/upload only. Edit screens/remote/ for Metro dev.',
              },
            ],
          },
        ],
      },
    },
  ],
};
