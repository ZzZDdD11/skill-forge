import Database from 'better-sqlite3';
import { insertEvent, hashInput } from 'autoskill-core';
import { RawEvent } from 'autoskill-core';
import { randomUUID } from 'node:crypto';

export function recordToolCall(
  database: Database.Database,
  params: {
    toolName: string;
    toolInput: Record<string, unknown>;
    sessionId?: string;
    traceId?: string;
    durationMs?: number;
    error?: boolean;
  },
): number {
  const event: RawEvent = {
    trace_id: params.traceId ?? randomUUID(),
    session_id: params.sessionId ?? 'unknown',
    timestamp: new Date().toISOString(),
    platform: 'claude-code',
    event_type: 'tool_call',
    tool_name: params.toolName,
    tool_input_keys: JSON.stringify(Object.keys(params.toolInput).sort()),
    tool_input_hash: hashInput(params.toolInput),
    duration_ms: params.durationMs,
    error: params.error ? 1 : 0,
  };

  return insertEvent(database, event);
}

export function recordToolResult(
  database: Database.Database,
  params: {
    toolName: string;
    sessionId?: string;
    traceId?: string;
    durationMs?: number;
    error?: boolean;
  },
): number {
  const event: RawEvent = {
    trace_id: params.traceId ?? randomUUID(),
    session_id: params.sessionId ?? 'unknown',
    timestamp: new Date().toISOString(),
    platform: 'claude-code',
    event_type: 'tool_result',
    tool_name: params.toolName,
    duration_ms: params.durationMs,
    error: params.error ? 1 : 0,
  };

  return insertEvent(database, event);
}

export function recordSessionStart(
  database: Database.Database,
  sessionId: string,
): number {
  const event: RawEvent = {
    trace_id: sessionId,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    platform: 'claude-code',
    event_type: 'session_start',
  };
  return insertEvent(database, event);
}
