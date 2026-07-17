export interface SessionMetrics {
  totalTokens: number;
  totalTurns: number;
  totalToolCalls: number;
  errorCount: number;
}

export interface RoiResult {
  before_avg_tokens: number;
  after_avg_tokens: number;
  before_avg_turns: number;
  after_avg_turns: number;
  before_avg_tool_calls: number;
  after_avg_tool_calls: number;
  before_error_rate: number;
  after_error_rate: number;
  token_score: number;
  turn_score: number;
  tool_score: number;
  error_score: number;
  composite_score: number;
  verdict: 'positive' | 'neutral' | 'negative';
  sample_size: number;
}

const WEIGHTS = {
  token: 0.35,
  turn: 0.25,
  tool: 0.20,
  error: 0.20,
} as const;

const VERDICT_THRESHOLDS = {
  positive: 30,
  neutral: 10,
} as const;

export function calculateRoi(
  beforeSessions: SessionMetrics[],
  afterSessions: SessionMetrics[],
): RoiResult {
  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const before_avg_tokens = avg(beforeSessions.map(s => s.totalTokens));
  const after_avg_tokens = avg(afterSessions.map(s => s.totalTokens));
  const before_avg_turns = avg(beforeSessions.map(s => s.totalTurns));
  const after_avg_turns = avg(afterSessions.map(s => s.totalTurns));
  const before_avg_tool_calls = avg(beforeSessions.map(s => s.totalToolCalls));
  const after_avg_tool_calls = avg(afterSessions.map(s => s.totalToolCalls));

  const before_error_rate = beforeSessions.length > 0
    ? beforeSessions.reduce((sum, s) => sum + s.errorCount, 0) /
      Math.max(1, beforeSessions.reduce((sum, s) => sum + s.totalToolCalls, 0))
    : 0;
  const after_error_rate = afterSessions.length > 0
    ? afterSessions.reduce((sum, s) => sum + s.errorCount, 0) /
      Math.max(1, afterSessions.reduce((sum, s) => sum + s.totalToolCalls, 0))
    : 0;

  const token_score = before_avg_tokens > 0
    ? ((before_avg_tokens - after_avg_tokens) / before_avg_tokens) * 100
    : 0;
  const turn_score = before_avg_turns > 0
    ? ((before_avg_turns - after_avg_turns) / before_avg_turns) * 100
    : 0;
  const tool_score = before_avg_tool_calls > 0
    ? ((before_avg_tool_calls - after_avg_tool_calls) / before_avg_tool_calls) * 100
    : 0;
  const error_score = (before_error_rate - after_error_rate) * 100;

  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  const composite_score =
    WEIGHTS.token * clamp(token_score) +
    WEIGHTS.turn * clamp(turn_score) +
    WEIGHTS.tool * clamp(tool_score) +
    WEIGHTS.error * clamp(Math.max(0, error_score));

  const verdict: RoiResult['verdict'] =
    composite_score >= VERDICT_THRESHOLDS.positive ? 'positive'
    : composite_score >= VERDICT_THRESHOLDS.neutral ? 'neutral'
    : 'negative';

  return {
    before_avg_tokens,
    after_avg_tokens,
    before_avg_turns,
    after_avg_turns,
    before_avg_tool_calls,
    after_avg_tool_calls,
    before_error_rate,
    after_error_rate,
    token_score: clamp(token_score),
    turn_score: clamp(turn_score),
    tool_score: clamp(tool_score),
    error_score: clamp(Math.max(0, error_score)),
    composite_score,
    verdict,
    sample_size: afterSessions.length,
  };
}
