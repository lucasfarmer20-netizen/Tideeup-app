import { describe, expect, it } from 'vitest';
import { safeNext } from '../next';

describe('safeNext', () => {
  it('keeps same-site paths, including a query string', () => {
    expect(safeNext('/pricing?plan=annual')).toBe('/pricing?plan=annual');
  });
  it('falls back for missing, absolute, protocol-relative or backslash targets', () => {
    for (const bad of [null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'pricing']) {
      expect(safeNext(bad)).toBe('/dashboard');
    }
    expect(safeNext(null, '/')).toBe('/');
  });
});
