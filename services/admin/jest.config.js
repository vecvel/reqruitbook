/**
 * Tests run against the TypeScript sources rather than dist, so a failing test
 * points at the line an editor is already showing.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  // A test that opens a pool and forgets to close it would otherwise hang CI
  // for the full default timeout with no indication of which suite did it.
  detectOpenHandles: true,
  forceExit: false,
  testTimeout: 20_000,
};
