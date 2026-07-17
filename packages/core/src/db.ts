import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DDL, SCHEMA_VERSION } from './schema.js';
import { RawEvent, Pattern, Suggestion, Skill, RoiRecord } from './types.js';

let db: Database.Database | null = null;

export function getDbDir(): string {
  return join(homedir(), '.skillbot');
}

export function getDbPath(): string {
  return join(getDbDir(), 'logs.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  const dir = getDbDir();
  mkdirSync(dir, { recursive: true });

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  return db;
}

export function runMigrations(database: Database.Database): void {
  database.exec(DDL);

  const row = database.prepare(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  ).get() as { version: number } | undefined;

  const currentVersion = row?.version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    database.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)')
      .run(SCHEMA_VERSION);
  }
}

/** 测试用：获取内存数据库 */
export function getMemoryDb(): Database.Database {
  const memDb = new Database(':memory:');
  memDb.pragma('foreign_keys = ON');
  memDb.exec(DDL);
  return memDb;
}

/** 关闭数据库连接 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ============ raw_events CRUD ============

export function insertEvent(database: Database.Database, event: RawEvent): number {
  const stmt = database.prepare(`
    INSERT INTO raw_events (trace_id, session_id, timestamp, platform, event_type,
      tool_name, tool_input_keys, tool_input_hash, duration_ms, error)
    VALUES (@trace_id, @session_id, @timestamp, @platform, @event_type,
      @tool_name, @tool_input_keys, @tool_input_hash, @duration_ms, @error)
  `);
  const result = stmt.run({
    trace_id: event.trace_id,
    session_id: event.session_id,
    timestamp: event.timestamp,
    platform: event.platform,
    event_type: event.event_type,
    tool_name: event.tool_name ?? null,
    tool_input_keys: event.tool_input_keys ?? null,
    tool_input_hash: event.tool_input_hash ?? null,
    duration_ms: event.duration_ms ?? null,
    error: event.error ?? 0,
  });
  return Number(result.lastInsertRowid);
}

export function getEventsBySession(
  database: Database.Database,
  sessionId: string
): RawEvent[] {
  return database.prepare(
    'SELECT * FROM raw_events WHERE session_id = ? ORDER BY id ASC'
  ).all(sessionId) as RawEvent[];
}

export function getEventsSince(database: Database.Database, since: string): RawEvent[] {
  return database.prepare(
    'SELECT * FROM raw_events WHERE timestamp >= ? ORDER BY id ASC'
  ).all(since) as RawEvent[];
}

export function getAllSessions(
  database: Database.Database
): { session_id: string; count: number; first: string; last: string }[] {
  return database.prepare(`
    SELECT session_id,
           COUNT(*) as count,
           MIN(timestamp) as first,
           MAX(timestamp) as last
    FROM raw_events
    WHERE event_type = 'tool_call'
    GROUP BY session_id
    ORDER BY last DESC
  `).all() as any[];
}

// ============ patterns CRUD ============

export function upsertPattern(database: Database.Database, pattern: Pattern): void {
  database.prepare(`
    INSERT INTO patterns (pattern_hash, tool_sequence, frequency, sessions, first_seen, last_seen)
    VALUES (@pattern_hash, @tool_sequence, @frequency, @sessions, @first_seen, @last_seen)
    ON CONFLICT(pattern_hash) DO UPDATE SET
      frequency = excluded.frequency,
      sessions = excluded.sessions,
      last_seen = excluded.last_seen
  `).run(pattern);
}

export function getAllPatterns(database: Database.Database): Pattern[] {
  return database.prepare(
    'SELECT * FROM patterns ORDER BY frequency DESC'
  ).all() as Pattern[];
}

// ============ suggestions CRUD ============

export function upsertSuggestion(database: Database.Database, s: Suggestion): void {
  database.prepare(`
    INSERT INTO suggestions (pattern_hash, tool_sequence, frequency, sessions,
      examples, estimated_token_savings, suggested_skill_name, status, created_at)
    VALUES (@pattern_hash, @tool_sequence, @frequency, @sessions,
      @examples, @estimated_token_savings, @suggested_skill_name, @status, @created_at)
  `).run({
    ...s,
    examples: JSON.stringify(s.examples),
    tool_sequence: JSON.stringify(s.tool_sequence),
  });
}

export function getPendingSuggestions(database: Database.Database): Suggestion[] {
  const rows = database.prepare(
    "SELECT * FROM suggestions WHERE status = 'pending' ORDER BY frequency DESC"
  ).all() as any[];

  return rows.map(r => ({
    ...r,
    tool_sequence: JSON.parse(r.tool_sequence),
    examples: JSON.parse(r.examples),
  }));
}

export function updateSuggestionStatus(
  database: Database.Database,
  id: number,
  status: string
): void {
  database.prepare('UPDATE suggestions SET status = ? WHERE id = ?').run(status, id);
}

// ============ skills CRUD ============

export function insertSkill(database: Database.Database, skill: Skill): number {
  const result = database.prepare(`
    INSERT INTO skills (name, pattern_hash, file_path, version, status, created_at, updated_at)
    VALUES (@name, @pattern_hash, @file_path, @version, @status, @created_at, @updated_at)
  `).run(skill);
  return Number(result.lastInsertRowid);
}

export function getActiveSkills(database: Database.Database): Skill[] {
  return database.prepare(
    "SELECT * FROM skills WHERE status = 'active'"
  ).all() as Skill[];
}

export function updateSkillStatus(
  database: Database.Database,
  id: number,
  status: string
): void {
  database.prepare(
    "UPDATE skills SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, id);
}

// ============ roi_records CRUD ============

export function insertRoiRecord(database: Database.Database, record: RoiRecord): void {
  database.prepare(`
    INSERT INTO roi_records (skill_id, before_avg_tokens, after_avg_tokens,
      before_avg_turns, after_avg_turns, before_avg_tool_calls, after_avg_tool_calls,
      before_error_rate, after_error_rate, score, verdict, sample_size, evaluated_at)
    VALUES (@skill_id, @before_avg_tokens, @after_avg_tokens,
      @before_avg_turns, @after_avg_turns, @before_avg_tool_calls, @after_avg_tool_calls,
      @before_error_rate, @after_error_rate, @score, @verdict, @sample_size, @evaluated_at)
  `).run(record);
}

export function getLatestRoiForSkill(
  database: Database.Database,
  skillId: number
): RoiRecord | undefined {
  return database.prepare(
    'SELECT * FROM roi_records WHERE skill_id = ? ORDER BY evaluated_at DESC LIMIT 1'
  ).get(skillId) as RoiRecord | undefined;
}
