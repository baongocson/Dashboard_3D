import { describe, expect, it } from 'vitest';
import { inferColumnType } from '../src/csv/inferColumnTypes.js';

describe('inferColumnType', () => {
  it('detects numeric columns', () => {
    expect(inferColumnType(['10', '20', '30.5'])).toBe('number');
  });

  it('preserves leading-zero identifiers as text', () => {
    expect(inferColumnType(['001', '002'])).toBe('text');
  });

  it('detects boolean columns', () => {
    expect(inferColumnType(['true', 'false'])).toBe('boolean');
  });

  it('detects ISO date columns', () => {
    expect(inferColumnType(['2026-11-09', '2026-11-10'])).toBe('text');
  });

  it('detects ISO UTC datetime columns', () => {
    expect(inferColumnType(['2026-11-09T10:00:00Z', '2026-11-10T10:00:00Z'])).toBe('text');
  });

  it('returns text for mixed data', () => {
    expect(inferColumnType(['10', 'Nguyen'])).toBe('text');
  });

  it('ignores missing values', () => {
    expect(inferColumnType(['10', null, '20'])).toBe('number');
  });

  it('returns text for an entirely missing column', () => {
    expect(inferColumnType([null, null])).toBe('text');
  });

  it('preserves unsafe integers as text', () => {
    expect(inferColumnType(['9007199254740993'])).toBe('text');
  });

  it('rejects invalid dates', () => {
    expect(inferColumnType(['2026-02-30'])).toBe('text');
  });
});
