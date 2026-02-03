/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  testMatch: [
    '<rootDir>/e2e/specs/**/*.e2e.ts',
    '<rootDir>/e2e/tests/**/*.test.ts'
  ],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: [
    'detox/runners/jest/reporter',
    [
      'jest-html-reporters',
      {
        publicPath: './e2e/reports',
        filename: 'e2e-report.html',
        expand: true,
        openReport: false,
        pageTitle: 'Festivals Mobile E2E Test Report',
      },
    ],
  ],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/e2e/init.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@e2e/(.*)$': '<rootDir>/e2e/$1',
  },
  collectCoverage: false,
  cacheDirectory: '<rootDir>/e2e/.cache',
  bail: 0,
  testEnvironmentOptions: {
    launchApp: false,
  },
};
