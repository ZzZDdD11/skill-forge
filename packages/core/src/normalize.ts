import { createHash } from 'node:crypto';
import { RawEvent, NormalizedCall } from './types.js';

/**
 * 将原始 tool_call 事件列表标准化为 NormalizedCall 序列
 */
export function normalizeSequence(events: RawEvent[]): NormalizedCall[] {
  return events
    .filter(e => e.event_type === 'tool_call' && e.tool_name)
    .map(e => ({
      tool_name: e.tool_name!,
      input_keys: e.tool_input_keys
        ? (JSON.parse(e.tool_input_keys) as string[]).sort()
        : [],
    }));
}

/**
 * 计算标准化序列的指纹
 */
export function computePatternHash(sequence: NormalizedCall[]): string {
  const data = JSON.stringify(sequence);
  return createHash('sha256').update(data).digest('hex');
}
