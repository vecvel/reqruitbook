/**
 * Duration parsing.
 *
 * S3_PRESIGN_TTL is read by the Go services as a time.Duration, so this service
 * has to understand the same literal. Reading it as a bare number would mean a
 * second environment variable, or one value that means two things.
 */
import { parseDuration } from './config';

describe('parseDuration', () => {
  it.each([
    ['15m', 900],
    ['30s', 30],
    ['1h', 3600],
    ['2500ms', 3],
    ['  10m  ', 600],
    // A plain integer is seconds, which is what a naive operator would write.
    ['45', 45],
  ])('reads %s as %s seconds', (value, expected) => {
    expect(parseDuration(value, 900)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['soon', 'a word'],
    ['-5m', 'a negative duration'],
    ['0', 'zero, which would sign a URL that is already expired'],
    ['15 minutes', 'a unit the Go parser does not accept either'],
  ])('falls back on %s (%s)', (value) => {
    expect(parseDuration(value, 900)).toBe(900);
  });
});
