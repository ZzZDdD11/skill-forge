import { Command } from 'commander';
import {
  getDb, closeDb,
  getAllSessions, getEventsBySession,
  upsertPattern, upsertSuggestion, getPendingSuggestions,
} from 'skillbot-core';
import { normalizeSequence, computePatternHash } from 'skillbot-core';
import { mineFrequentSequences } from 'skillbot-core';
import type { FrequentPattern } from 'skillbot-core';
import type { Pattern, Suggestion, NormalizedCall } from 'skillbot-core';

export const analyzeCommand = new Command('analyze')
  .description('Detect repeated tool call patterns across sessions')
  .option('--since <period>', 'Analyze sessions since (e.g., 7d, 30d)', '7d')
  .option('--min-frequency <n>', 'Minimum total occurrences', '5')
  .option('--min-sessions <n>', 'Minimum distinct sessions', '3')
  .action((opts) => {
    const db = getDb();
    const minFrequency = parseInt(opts.minFrequency, 10);
    const minSessions = parseInt(opts.minSessions, 10);

    const sessionRows = getAllSessions(db);
    console.log(`Found ${sessionRows.length} sessions`);

    if (sessionRows.length < minSessions) {
      console.log(`Need at least ${minSessions} sessions for analysis. Skipping.`);
      closeDb();
      return;
    }

    // Extract normalized sequences per session
    const allSequences: { sessionId: string; calls: NormalizedCall[] }[] = [];
    for (const s of sessionRows) {
      const events = getEventsBySession(db, s.session_id);
      const calls = normalizeSequence(events);
      if (calls.length >= 2) {
        allSequences.push({ sessionId: s.session_id, calls });
      }
    }

    console.log(`${allSequences.length} sessions with >=2 tool calls`);

    if (allSequences.length < minSessions) {
      console.log('Not enough sessions with sufficient tool calls. Skipping.');
      closeDb();
      return;
    }

    // Run PrefixSpan
    const minSupport = Math.max(0.1, minSessions / allSequences.length);
    const frequentPatterns = mineFrequentSequences(
      allSequences.map(s => s.calls),
      minSupport,
    );

    console.log(`Found ${frequentPatterns.length} frequent subsequences`);

    // Filter + write to DB
    let newSuggestions = 0;
    for (const fp of frequentPatterns) {
      if (fp.absoluteCount < minFrequency || fp.sessionCount < minSessions) {
        continue;
      }

      const pattern: Pattern = {
        pattern_hash: fp.patternHash,
        tool_sequence: JSON.stringify(fp.sequence),
        frequency: fp.absoluteCount,
        sessions: fp.sessionCount,
        first_seen: sessionRows[sessionRows.length - 1]?.first ?? new Date().toISOString(),
        last_seen: sessionRows[0]?.last ?? new Date().toISOString(),
      };
      upsertPattern(db, pattern);

      // Check if already suggested
      const existingSuggestions = getPendingSuggestions(db);
      const alreadySuggested = existingSuggestions.some(
        s => s.pattern_hash === fp.patternHash
      );

      if (!alreadySuggested) {
        const examples = generateExamples(allSequences, fp);
        const suggestedName = generateSkillName(fp.sequence);

        const suggestion: Suggestion = {
          pattern_hash: fp.patternHash,
          tool_sequence: fp.sequence,
          frequency: fp.absoluteCount,
          sessions: fp.sessionCount,
          examples,
          estimated_token_savings: estimateTokenSavings(fp),
          suggested_skill_name: suggestedName,
          status: 'pending',
          created_at: new Date().toISOString(),
        };
        upsertSuggestion(db, suggestion);
        newSuggestions++;
      }
    }

    console.log(`✅ ${newSuggestions} new suggestions created`);
    closeDb();
  });

function generateExamples(
  sessions: { sessionId: string; calls: NormalizedCall[] }[],
  fp: FrequentPattern,
): string[] {
  const examples: string[] = [];
  for (const session of sessions) {
    const seqStr = session.calls.map(c => c.tool_name).join(' → ');
    const patternStr = fp.sequence.map(c => c.tool_name).join(' → ');
    if (seqStr.includes(patternStr) && examples.length < 3) {
      examples.push(seqStr);
    }
  }
  return examples;
}

function generateSkillName(sequence: NormalizedCall[]): string {
  const verbs = sequence.map(c => toolToVerb(c.tool_name));
  return verbs.slice(0, 3).join('-').toLowerCase();
}

function toolToVerb(toolName: string): string {
  const map: Record<string, string> = {
    'Bash': 'run',
    'Read': 'check',
    'Edit': 'update',
    'Write': 'create',
    'WebSearch': 'research',
    'WebFetch': 'fetch',
    'Grep': 'search',
    'Glob': 'find',
  };
  return map[toolName] ?? toolName.toLowerCase();
}

function estimateTokenSavings(fp: FrequentPattern): string {
  const tokensPerCall = 400;
  const estimated = tokensPerCall * fp.sequence.length * fp.absoluteCount;
  if (estimated >= 1000) {
    return `~${Math.round(estimated / 1000)}K tokens`;
  }
  return `~${estimated} tokens`;
}
