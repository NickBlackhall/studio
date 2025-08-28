const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

const config = {
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  // Handle ES modules in node_modules (like jose library)
  transformIgnorePatterns: [
    'node_modules/(?!(jose)/)'
  ],
  // Explicitly add TypeScript transformation and module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
    '^.+\\.m?js$': ['babel-jest', { presets: ['next/babel'] }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/unit/**/*.test.(ts|tsx)'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.dom.setup.ts'],
      transformIgnorePatterns: [
        'node_modules/(?!(jose)/)'
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      transform: {
        '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
        '^.+\\.m?js$': ['babel-jest', { presets: ['next/babel'] }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testEnvironmentOptions: { customExportConditions: ['node'] },
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.node.setup.ts'],
      transformIgnorePatterns: [
        'node_modules/(?!(jose)/)'
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      transform: {
        '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
        '^.+\\.m?js$': ['babel-jest', { presets: ['next/babel'] }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    }
  ]
};

module.exports = createJestConfig(config);