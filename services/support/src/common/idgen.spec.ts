/**
 * Identifier generation.
 *
 * The property that matters is ordering within a single millisecond: the keyset
 * cursor breaks ties on the id, so two ids minted back to back must compare in
 * the order they were minted or a page boundary silently drops a row.
 */
import { newId } from './idgen';

describe('newId', () => {
  it('carries the prefix and 26 base32 characters', () => {
    expect(newId('tkt')).toMatch(/^tkt_[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('never repeats', () => {
    const ids = new Set(Array.from({ length: 5_000 }, () => newId('tkt')));
    expect(ids.size).toBe(5_000);
  });

  it('sorts lexically in mint order, including within one millisecond', () => {
    const ids = Array.from({ length: 5_000 }, () => newId('tkt'));
    expect([...ids].sort()).toEqual(ids);
  });

  it('uses no ambiguous letters, so an id read aloud is unambiguous', () => {
    expect(newId('tkt').slice(4)).not.toMatch(/[ILOU]/);
  });
});
