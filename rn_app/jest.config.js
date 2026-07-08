module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'babel-jest',
      { presets: ['module:@react-native/babel-preset'] },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
