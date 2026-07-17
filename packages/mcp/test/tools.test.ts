import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { getMemoryDb, insertEvent, upsertSuggestion, getPendingSuggestions } from '@skillforge/core';
import type { Suggestion } from '@skillforge/core';

describe('MCP Tools (unit)', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = getMemoryDb();
  });

  it('getPendingSuggestions returns empty when no suggestions', () => {
    const suggestions = getPendingSuggestions(db);
    expect(suggestions).toEqual([]);
  });

  it('getPendingSuggestions returns suggestions after upsert', () => {
    const suggestion: Suggestion = {
      pattern_hash: 'test-hash',
      tool_sequence: [{ tool_name: 'Bash', input_keys: ['command'] }],
      frequency: 5,
      sessions: 3,
      examples: ['example'],
      estimated_token_savings: '~1K tokens',
      suggested_skill_name: 'test-skill',
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    upsertSuggestion(db, suggestion);

    const pending = getPendingSuggestions(db);
    expect(pending.length).toBe(1);
    expect(pending[0].suggested_skill_name).toBe('test-skill');
  });
});
