import { NormalizedCall } from './types.js';
import { computePatternHash } from './normalize.js';

export interface FrequentPattern {
  sequence: NormalizedCall[];
  patternHash: string;
  absoluteCount: number;
  sessionCount: number;
  support: number;
}

interface ProjectedSequence {
  suffix: NormalizedCall[];
  sessionIndex: number;
}

/**
 * PrefixSpan: 频繁子序列挖掘
 */
export function mineFrequentSequences(
  sessions: NormalizedCall[][],
  minSupport: number = 0.3,
): FrequentPattern[] {
  const minSessions = Math.ceil(sessions.length * minSupport);
  const results: FrequentPattern[] = [];

  const frequentItems = findFrequentItems(sessions, minSessions);

  for (const item of frequentItems) {
    const prefix = [item];
    const projected = buildProjectedDatabase(sessions, prefix);
    project(prefix, projected, minSessions, results);
  }

  return results.sort((a, b) => b.absoluteCount - a.absoluteCount);
}

function findFrequentItems(
  sessions: NormalizedCall[][],
  minSessions: number,
): NormalizedCall[] {
  const itemSessions = new Map<string, Set<number>>();

  for (let i = 0; i < sessions.length; i++) {
    for (const call of sessions[i]) {
      const key = `${call.tool_name}:${call.input_keys.join(',')}`;
      if (!itemSessions.has(key)) {
        itemSessions.set(key, new Set());
      }
      itemSessions.get(key)!.add(i);
    }
  }

  const result: NormalizedCall[] = [];
  for (const [key, sessionSet] of itemSessions) {
    if (sessionSet.size >= minSessions) {
      const [tool_name, ...keyParts] = key.split(':');
      const input_keys = keyParts.join(':').split(',').filter(Boolean);
      result.push({ tool_name, input_keys });
    }
  }
  return result;
}

function buildProjectedDatabase(
  sessions: NormalizedCall[][],
  prefix: NormalizedCall[],
): ProjectedSequence[] {
  const projected: ProjectedSequence[] = [];

  for (let si = 0; si < sessions.length; si++) {
    const session = sessions[si];
    let searchFrom = 0;
    while (searchFrom < session.length) {
      const remaining = session.slice(searchFrom);
      const found = findSubsequence(remaining, prefix);
      if (found >= 0) {
        const suffix = remaining.slice(found + prefix.length);
        // Always include — even empty suffix — for session counting
        projected.push({ suffix, sessionIndex: si });
        searchFrom += found + 1;
      } else {
        break;
      }
    }
  }

  return projected;
}

function findSubsequence(seq: NormalizedCall[], sub: NormalizedCall[]): number {
  for (let i = 0; i <= seq.length - sub.length; i++) {
    let matched = true;
    for (let j = 0; j < sub.length; j++) {
      if (!callsMatch(seq[i + j], sub[j])) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

function project(
  prefix: NormalizedCall[],
  projectedDb: ProjectedSequence[],
  minSessions: number,
  results: FrequentPattern[],
): void {
  // Count unique sessions that contain this prefix
  const uniqueSessions = new Set(projectedDb.map(p => p.sessionIndex));

  if (uniqueSessions.size >= minSessions && prefix.length >= 2) {
    const patternHash = computePatternHash(prefix);
    results.push({
      sequence: [...prefix],
      patternHash,
      absoluteCount: projectedDb.length,
      sessionCount: uniqueSessions.size,
      support: 0,
    });
  }

  // Only non-empty suffixes can be extended
  const extendable = projectedDb.filter(p => p.suffix.length > 0);
  if (extendable.length === 0) return;

  // Find frequent items in extendable suffixes
  const itemSessions = new Map<string, Set<number>>();
  for (const ps of extendable) {
    for (const call of ps.suffix) {
      const key = `${call.tool_name}:${call.input_keys.join(',')}`;
      if (!itemSessions.has(key)) {
        itemSessions.set(key, new Set());
      }
      itemSessions.get(key)!.add(ps.sessionIndex);
    }
  }

  for (const [key, sessionSet] of itemSessions) {
    if (sessionSet.size >= minSessions) {
      const [tool_name, ...keyParts] = key.split(':');
      const input_keys = keyParts.join(':').split(',').filter(Boolean);
      const newItem: NormalizedCall = { tool_name, input_keys };
      const newPrefix = [...prefix, newItem];

      // Build new projected DB from the extendable entries
      const newProjected: ProjectedSequence[] = [];
      for (const ps of extendable) {
        let searchFrom = 0;
        while (searchFrom < ps.suffix.length) {
          const remaining = ps.suffix.slice(searchFrom);
          const found = findSubsequence(remaining, [newItem]);
          if (found >= 0) {
            const newSuffix = remaining.slice(found + 1);
            newProjected.push({ suffix: newSuffix, sessionIndex: ps.sessionIndex });
            searchFrom += found + 1;
          } else {
            break;
          }
        }
      }

      project(newPrefix, newProjected, minSessions, results);
    }
  }
}

function callsMatch(a: NormalizedCall, b: NormalizedCall): boolean {
  if (a.tool_name !== b.tool_name) return false;
  if (a.input_keys.length !== b.input_keys.length) return false;
  return a.input_keys.every((k, i) => k === b.input_keys[i]);
}
