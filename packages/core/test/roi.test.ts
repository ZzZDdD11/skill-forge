import { describe, it, expect } from 'vitest';
import { calculateRoi, SessionMetrics } from '../src/roi.js';

describe('calculateRoi', () => {
  it('should return positive verdict when token usage drops significantly', () => {
    const before: SessionMetrics[] = [
      { totalTokens: 8000, totalTurns: 10, totalToolCalls: 15, errorCount: 2 },
      { totalTokens: 9000, totalTurns: 12, totalToolCalls: 18, errorCount: 1 },
      { totalTokens: 7000, totalTurns: 8, totalToolCalls: 12, errorCount: 0 },
    ];

    const after: SessionMetrics[] = [
      { totalTokens: 3000, totalTurns: 4, totalToolCalls: 5, errorCount: 0 },
      { totalTokens: 3500, totalTurns: 5, totalToolCalls: 6, errorCount: 0 },
      { totalTokens: 2500, totalTurns: 3, totalToolCalls: 4, errorCount: 0 },
    ];

    const result = calculateRoi(before, after);
    expect(result.verdict).toBe('positive');
    expect(result.composite_score).toBeGreaterThanOrEqual(30);
    expect(result.token_score).toBeGreaterThan(50);
  });

  it('should return negative verdict when nothing improves', () => {
    const before: SessionMetrics[] = [
      { totalTokens: 5000, totalTurns: 5, totalToolCalls: 10, errorCount: 1 },
    ];
    const after: SessionMetrics[] = [
      { totalTokens: 5500, totalTurns: 6, totalToolCalls: 12, errorCount: 2 },
    ];

    const result = calculateRoi(before, after);
    expect(result.verdict).toBe('negative');
    expect(result.composite_score).toBeLessThan(10);
  });

  it('should clamp scores to 0-100', () => {
    const before: SessionMetrics[] = [
      { totalTokens: 100, totalTurns: 1, totalToolCalls: 1, errorCount: 0 },
    ];
    const after: SessionMetrics[] = [
      { totalTokens: 1, totalTurns: 1, totalToolCalls: 1, errorCount: 0 },
    ];

    const result = calculateRoi(before, after);
    expect(result.token_score).toBeLessThanOrEqual(100);
    expect(result.turn_score).toBeLessThanOrEqual(100);
  });

  it('should handle empty before sessions gracefully', () => {
    const before: SessionMetrics[] = [];
    const after: SessionMetrics[] = [
      { totalTokens: 3000, totalTurns: 4, totalToolCalls: 5, errorCount: 0 },
    ];

    const result = calculateRoi(before, after);
    expect(result.token_score).toBe(0);
  });
});
