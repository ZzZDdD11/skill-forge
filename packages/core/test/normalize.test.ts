import { describe, it, expect } from 'vitest';
import { normalizeSequence, computePatternHash } from '../src/normalize.js';
import { RawEvent } from '../src/types.js';

describe('normalizeSequence', () => {
  it('should extract tool_name and input_keys from tool_call events', () => {
    const events: RawEvent[] = [
      {
        trace_id: 't1', session_id: 's1',
        timestamp: '2026-01-01T00:00:00Z', platform: 'claude-code',
        event_type: 'tool_call', tool_name: 'Bash',
        tool_input_keys: '["command"]',
      },
      {
        trace_id: 't1', session_id: 's1',
        timestamp: '2026-01-01T00:00:01Z', platform: 'claude-code',
        event_type: 'tool_call', tool_name: 'Read',
        tool_input_keys: '["file_path"]',
      },
      {
        trace_id: 't1', session_id: 's1',
        timestamp: '2026-01-01T00:00:02Z', platform: 'claude-code',
        event_type: 'tool_result', tool_name: 'Bash',
        tool_input_keys: '["command"]',
      },
    ];

    const result = normalizeSequence(events);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ tool_name: 'Bash', input_keys: ['command'] });
    expect(result[1]).toEqual({ tool_name: 'Read', input_keys: ['file_path'] });
  });

  it('should sort input_keys alphabetically', () => {
    const events: RawEvent[] = [{
      trace_id: 't1', session_id: 's1',
      timestamp: '2026-01-01T00:00:00Z', platform: 'claude-code',
      event_type: 'tool_call', tool_name: 'Edit',
      tool_input_keys: '["new_string","file_path","old_string"]',
    }];

    const result = normalizeSequence(events);
    expect(result[0].input_keys).toEqual(['file_path', 'new_string', 'old_string']);
  });
});

describe('computePatternHash', () => {
  it('should produce the same hash for the same sequence', () => {
    const seq = [
      { tool_name: 'Bash', input_keys: ['command'] },
      { tool_name: 'Read', input_keys: ['file_path'] },
    ];
    expect(computePatternHash(seq)).toBe(computePatternHash(structuredClone(seq)));
  });

  it('should produce different hash for different sequences', () => {
    const a = [{ tool_name: 'Bash', input_keys: ['command'] }];
    const b = [{ tool_name: 'Read', input_keys: ['file_path'] }];
    expect(computePatternHash(a)).not.toBe(computePatternHash(b));
  });
});
