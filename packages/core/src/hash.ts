import { createHash } from 'node:crypto';

/**
 * 对标准化后的 tool input 做 SHA256
 */
export function hashInput(input: Record<string, unknown>): string {
  const sorted = Object.keys(input)
    .sort()
    .reduce((acc, key) => {
      acc[key] = input[key];
      return acc;
    }, {} as Record<string, unknown>);

  const canonical = JSON.stringify(sorted);
  return createHash('sha256').update(canonical).digest('hex');
}
