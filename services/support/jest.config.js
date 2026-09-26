/**
 * Tests run from source rather than from dist so a failure points at the line
 * the author wrote.
 *
 * Anything that needs Postgres reads TEST_DATABASE_URL and skips itself when it
 * is unset — a developer without a database still gets a green suite for the
 * pure logic, and CI, which sets the variable, still gets the tenancy proofs.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    // Type-checked rather than transpile-only: a spec that drifts from the code
    // it exercises should fail the suite, not compile away to something that
    // passes.
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  // The Postgres suites each open a pool; a shared one would leak between files.
  testTimeout: 20_000,
};
