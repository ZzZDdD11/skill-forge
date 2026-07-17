import { Command } from 'commander';
import { getDb, closeDb, insertEvent, hashInput } from 'autoskill-core';
import { randomUUID } from 'node:crypto';

/**
 * Record a tool call event from command line.
 * Used by PostToolUse hook.
 *
 * Usage:
 *   autoskill record --session-id <id> --tool-name Bash --tool-input '{"command":"npm test"}'
 */
export const recordCommand = new Command('record')
  .description('Record a tool call event (used by hooks)')
  .requiredOption('--session-id <id>', 'Session ID')
  .requiredOption('--tool-name <name>', 'Tool name')
  .option('--tool-input <json>', 'Tool input as JSON string', '{}')
  .option('--duration-ms <n>', 'Duration in milliseconds')
  .option('--error', 'Mark as error')
  .action((opts) => {
    const db = getDb();

    let toolInput: Record<string, unknown> = {};
    try {
      toolInput = JSON.parse(opts.toolInput);
    } catch {
      toolInput = { raw: opts.toolInput };
    }

    const id = insertEvent(db, {
      trace_id: randomUUID(),
      session_id: opts.sessionId,
      timestamp: new Date().toISOString(),
      platform: 'claude-code',
      event_type: 'tool_call',
      tool_name: opts.toolName,
      tool_input_keys: JSON.stringify(Object.keys(toolInput).sort()),
      tool_input_hash: hashInput(toolInput),
      duration_ms: opts.durationMs ? parseInt(opts.durationMs, 10) : undefined,
      error: opts.error ? 1 : 0,
    });

    console.log(`Recorded event #${id}: ${opts.toolName}`);
    closeDb();
  });
