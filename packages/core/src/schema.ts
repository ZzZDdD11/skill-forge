export const SCHEMA_VERSION = 1;

export const DDL = `
CREATE TABLE IF NOT EXISTS raw_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'claude-code',
  event_type TEXT NOT NULL CHECK(event_type IN ('tool_call','tool_result','session_start','session_end')),
  tool_name TEXT,
  tool_input_keys TEXT,
  tool_input_hash TEXT,
  duration_ms INTEGER,
  error INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_hash TEXT UNIQUE NOT NULL,
  tool_sequence TEXT NOT NULL,
  frequency INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  first_seen TEXT,
  last_seen TEXT
);

CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pattern_hash TEXT NOT NULL,
  file_path TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','deprecated','retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roi_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id INTEGER NOT NULL,
  before_avg_tokens REAL,
  after_avg_tokens REAL,
  before_avg_turns REAL,
  after_avg_turns REAL,
  before_avg_tool_calls REAL,
  after_avg_tool_calls REAL,
  before_error_rate REAL,
  after_error_rate REAL,
  score REAL,
  verdict TEXT CHECK(verdict IN ('positive','neutral','negative')),
  sample_size INTEGER DEFAULT 0,
  evaluated_at TEXT NOT NULL,
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_hash TEXT NOT NULL,
  tool_sequence TEXT NOT NULL,
  frequency INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  examples TEXT NOT NULL,
  estimated_token_savings TEXT,
  suggested_skill_name TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','applied','dismissed')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_events_session ON raw_events(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_raw_events_type ON raw_events(event_type);
CREATE INDEX IF NOT EXISTS idx_raw_events_timestamp ON raw_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);
`;
