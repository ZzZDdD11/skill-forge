import { describe, it, expect } from 'vitest';
import { mineFrequentSequences } from '../src/prefixspan.js';
import { NormalizedCall } from '../src/types.js';

describe('mineFrequentSequences', () => {
  it('should find a repeated Bash→Read→Edit pattern across sessions', () => {
    const bash: NormalizedCall = { tool_name: 'Bash', input_keys: ['command'] };
    const read: NormalizedCall = { tool_name: 'Read', input_keys: ['file_path'] };
    const edit: NormalizedCall = { tool_name: 'Edit', input_keys: ['file_path', 'new_string', 'old_string'] };

    const sessions: NormalizedCall[][] = [
      [bash, read, edit, bash],
      [bash, read, edit],
      [bash, read, edit, read],
      [bash, read, edit],
      [read, edit],
    ];

    const results = mineFrequentSequences(sessions, 0.5);

    const triplet = results.find(r => r.sequence.length === 3);
    expect(triplet).toBeDefined();
    expect(triplet!.absoluteCount).toBeGreaterThanOrEqual(3);
  });

  it('should return empty for no patterns when support is high', () => {
    const sessions: NormalizedCall[][] = [
      [{ tool_name: 'Bash', input_keys: ['command'] }],
      [{ tool_name: 'Read', input_keys: ['file_path'] }],
    ];

    const results = mineFrequentSequences(sessions, 0.8);
    expect(results).toHaveLength(0);
  });

  it('should find frequent pairs', () => {
    const bash: NormalizedCall = { tool_name: 'Bash', input_keys: ['command'] };
    const read: NormalizedCall = { tool_name: 'Read', input_keys: ['file_path'] };

    const sessions: NormalizedCall[][] = [
      [bash, read],
      [bash, read],
      [bash, read],
      [bash],
    ];

    const results = mineFrequentSequences(sessions, 0.5);
    const pair = results.find(r => r.sequence.length === 2);
    expect(pair).toBeDefined();
    expect(pair!.absoluteCount).toBeGreaterThanOrEqual(3);
  });
});
