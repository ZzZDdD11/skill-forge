import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getMemoryDb, getPendingSuggestions } from '@skillforge/core';
import Database from 'better-sqlite3';

describe('CLI commands (unit)', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = getMemoryDb();
  });

  it('init creates all required tables', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];

    const names = tables.map(t => t.name);
    expect(names).toContain('raw_events');
    expect(names).toContain('patterns');
    expect(names).toContain('skills');
    expect(names).toContain('roi_records');
    expect(names).toContain('suggestions');
    expect(names).toContain('schema_version');
  });

  it('list shows empty suggestions initially', () => {
    const suggestions = getPendingSuggestions(db);
    expect(suggestions).toEqual([]);
  });
});
