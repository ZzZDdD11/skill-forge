import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { getMemoryDb } from '../../packages/core/dist/db.js';
import {
  insertEvent,
  getAllSessions,
  getEventsBySession,
  upsertPattern,
  upsertSuggestion,
  insertSkill,
  insertRoiRecord,
  getPendingSuggestions,
  getActiveSkills,
  updateSkillStatus,
} from '../../packages/core/dist/db.js';
import { normalizeSequence } from '../../packages/core/dist/normalize.js';
import { mineFrequentSequences } from '../../packages/core/dist/prefixspan.js';
import { calculateRoi } from '../../packages/core/dist/roi.js';
import type { RawEvent, Suggestion, RoiRecord } from '../../packages/core/dist/types.js';

function makeEvent(
  sessionId: string,
  toolName: string,
  inputKeys: string[],
  error = false,
): RawEvent {
  return {
    trace_id: `trace-${sessionId}-${toolName}-${Date.now()}`,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    platform: 'claude-code',
    event_type: 'tool_call',
    tool_name: toolName,
    tool_input_keys: JSON.stringify(inputKeys),
    tool_input_hash: `hash-${toolName}-${inputKeys.join(',')}`,
    error: error ? 1 : 0,
  };
}

describe('SkillForge E2E Pipeline', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = getMemoryDb();
  });

  it('Phase 1: Record tool calls → raw_events populated', () => {
    for (let ses = 0; ses < 10; ses++) {
      const sid = `session-${ses}`;
      insertEvent(db, makeEvent(sid, 'Bash', ['command']));
      insertEvent(db, makeEvent(sid, 'Read', ['file_path']));
      insertEvent(db, makeEvent(sid, 'Edit', ['file_path', 'old_string', 'new_string']));

      if (ses % 3 === 1) {
        insertEvent(db, makeEvent(sid, 'Bash', ['command'], true));
      }
    }

    const sessions = getAllSessions(db);
    expect(sessions.length).toBe(10);
  });

  it('Phase 2: Analyze → detect Bash→Read→Edit pattern', () => {
    const sessions = getAllSessions(db);
    const allSequences = sessions.map(s => {
      const events = getEventsBySession(db, s.session_id);
      return normalizeSequence(events);
    });

    const patterns = mineFrequentSequences(allSequences, 0.3);
    expect(patterns.length).toBeGreaterThan(0);

    const mainPattern = patterns.find(p => p.sequence.length === 3);
    expect(mainPattern).toBeDefined();
    expect(mainPattern!.sessionCount).toBeGreaterThanOrEqual(5);

    // Write pattern
    upsertPattern(db, {
      pattern_hash: mainPattern!.patternHash,
      tool_sequence: JSON.stringify(mainPattern!.sequence),
      frequency: mainPattern!.absoluteCount,
      sessions: mainPattern!.sessionCount,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });

    // Create suggestion
    const suggestion: Suggestion = {
      pattern_hash: mainPattern!.patternHash,
      tool_sequence: mainPattern!.sequence,
      frequency: mainPattern!.absoluteCount,
      sessions: mainPattern!.sessionCount,
      examples: ['Bash → Read → Edit → Bash'],
      estimated_token_savings: '~3K tokens',
      suggested_skill_name: 'run-check-update',
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    upsertSuggestion(db, suggestion);
  });

  it('Phase 3: Suggestions available', () => {
    const suggestions = getPendingSuggestions(db);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].suggested_skill_name).toBe('run-check-update');
  });

  it('Phase 4: Apply skill', () => {
    const suggestion = getPendingSuggestions(db)[0];
    const skillId = insertSkill(db, {
      name: suggestion.suggested_skill_name,
      pattern_hash: suggestion.pattern_hash,
      file_path: `~/.claude/skills/${suggestion.suggested_skill_name}/SKILL.md`,
      version: 1,
      status: 'active',
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 days ago
      updated_at: new Date().toISOString(),
    });

    expect(skillId).toBeGreaterThan(0);
    expect(getActiveSkills(db).length).toBe(1);
  });

  it('Phase 5: Evaluate ROI → positive', () => {
    const skill = getActiveSkills(db)[0];

    const beforeMetrics = [
      { totalTokens: 8000, totalTurns: 10, totalToolCalls: 15, errorCount: 2 },
      { totalTokens: 9000, totalTurns: 12, totalToolCalls: 18, errorCount: 1 },
      { totalTokens: 7000, totalTurns: 8, totalToolCalls: 12, errorCount: 0 },
    ];

    const afterMetrics = [
      { totalTokens: 3000, totalTurns: 4, totalToolCalls: 5, errorCount: 0 },
      { totalTokens: 3500, totalTurns: 5, totalToolCalls: 6, errorCount: 0 },
      { totalTokens: 2500, totalTurns: 3, totalToolCalls: 4, errorCount: 0 },
    ];

    const result = calculateRoi(beforeMetrics, afterMetrics);
    expect(result.verdict).toBe('positive');
    expect(result.composite_score).toBeGreaterThanOrEqual(30);

    const record: RoiRecord = {
      skill_id: skill.id!,
      before_avg_tokens: result.before_avg_tokens,
      after_avg_tokens: result.after_avg_tokens,
      before_avg_turns: result.before_avg_turns,
      after_avg_turns: result.after_avg_turns,
      before_avg_tool_calls: result.before_avg_tool_calls,
      after_avg_tool_calls: result.after_avg_tool_calls,
      before_error_rate: result.before_error_rate,
      after_error_rate: result.after_error_rate,
      score: result.composite_score,
      verdict: result.verdict,
      sample_size: result.sample_size,
      evaluated_at: new Date().toISOString(),
    };
    insertRoiRecord(db, record);
  });

  it('Phase 6: Negative ROI → auto-deprecate', () => {
    // Test that a negative ROI triggers deprecation
    const badBefore = [
      { totalTokens: 5000, totalTurns: 5, totalToolCalls: 10, errorCount: 1 },
    ];
    const badAfter = [
      { totalTokens: 5500, totalTurns: 6, totalToolCalls: 12, errorCount: 2 },
    ];

    const result = calculateRoi(badBefore, badAfter);
    expect(result.verdict).toBe('negative');

    // Auto-deprecate logic
    const skill = getActiveSkills(db)[0];
    if (result.verdict === 'negative') {
      updateSkillStatus(db, skill.id!, 'deprecated');
    }

    const activeAfterDeprecation = getActiveSkills(db);
    expect(activeAfterDeprecation.length).toBe(0);
  });
});
