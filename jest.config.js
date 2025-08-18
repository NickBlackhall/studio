const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

const config = {
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/unit/**/*.test.(ts|tsx)'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.dom.setup.ts'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testEnvironmentOptions: { customExportConditions: ['node'] },
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.node.setup.ts'],
    }
  ]
};

module.exports = createJestConfig(config);