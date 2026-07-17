/** MCP 记录的原始事件 */
export interface RawEvent {
  id?: number;
  trace_id: string;
  session_id: string;
  timestamp: string;
  platform: string;
  event_type: 'tool_call' | 'tool_result' | 'session_start' | 'session_end';
  tool_name?: string;
  tool_input_keys?: string;
  tool_input_hash?: string;
  duration_ms?: number;
  error?: number;
}

/** 标准化的工具调用（用于模式挖掘） */
export interface NormalizedCall {
  tool_name: string;
  input_keys: string[];
}

/** 检测到的重复模式 */
export interface Pattern {
  id?: number;
  pattern_hash: string;
  tool_sequence: string;
  frequency: number;
  sessions: number;
  first_seen: string;
  last_seen: string;
}

/** 创建的 Skill */
export interface Skill {
  id?: number;
  name: string;
  pattern_hash: string;
  file_path: string;
  version: number;
  status: 'active' | 'deprecated' | 'retired';
  created_at: string;
  updated_at: string;
}

/** ROI 评估记录 */
export interface RoiRecord {
  id?: number;
  skill_id: number;
  before_avg_tokens: number;
  after_avg_tokens: number;
  before_avg_turns: number;
  after_avg_turns: number;
  before_avg_tool_calls: number;
  after_avg_tool_calls: number;
  before_error_rate: number;
  after_error_rate: number;
  score: number;
  verdict: 'positive' | 'neutral' | 'negative';
  sample_size: number;
  evaluated_at: string;
}

/** 给 Agent 的建议 */
export interface Suggestion {
  id?: number;
  pattern_hash: string;
  tool_sequence: NormalizedCall[];
  frequency: number;
  sessions: number;
  examples: string[];
  estimated_token_savings: string;
  suggested_skill_name: string;
  status: 'pending' | 'applied' | 'dismissed';
  created_at: string;
}

/** 分析选项 */
export interface AnalyzeOptions {
  since?: string;
  minFrequency?: number;
  minSessions?: number;
}

/** 汇总统计 */
export interface Stats {
  totalEvents: number;
  totalSessions: number;
  totalPatterns: number;
  activeSkills: number;
  totalTokensSaved: number;
  positiveSkills: number;
  negativeSkills: number;
}
