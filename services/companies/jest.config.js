/**
 * Tests run against TypeScript sources directly; the suite must be runnable
 * before `nest build` has ever produced a dist.
 *
 * Anything that needs Postgres reads TEST_DATABASE_URL and skips itself when it
 * is unset, so `pnpm test` is green on a laptop with no database and still
 * exercises the tenant boundary in CI.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/../jest.setup.js'],
  // A database test sets up and tears down two tenants; the default 5s is tight
  // for a first connection to a cold container.
  testTimeout: 30_000,
};
