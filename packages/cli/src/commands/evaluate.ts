import { Command } from 'commander';
import {
  getDb, closeDb,
  getActiveSkills, insertRoiRecord, updateSkillStatus,
} from 'skillbot-core';
import { calculateRoi } from 'skillbot-core';
import type { SessionMetrics } from 'skillbot-core';
import type { Skill, RoiRecord } from 'skillbot-core';

export const evaluateCommand = new Command('evaluate')
  .description('Evaluate ROI of skills')
  .argument('[name]', 'Skill name to evaluate (omit for --all)')
  .option('--all', 'Evaluate all active skills')
  .option('--baseline <period>', 'Baseline window for before data (days)', '30')
  .action((name, opts) => {
    const db = getDb();

    let skills: Skill[] = [];
    if (opts.all || !name) {
      skills = getActiveSkills(db);
    } else {
      const all = getActiveSkills(db);
      skills = all.filter(s => s.name === name);
    }

    if (skills.length === 0) {
      console.log('No active skills to evaluate.');
      closeDb();
      return;
    }

    for (const skill of skills) {
      if (!skill.id) continue;

      console.log(`\nEvaluating: ${skill.name}...`);

      const afterSessions = getMetricsForPeriod(
        db, skill.created_at, null,
      );
      const baselineStart = subtractDays(skill.created_at, parseInt(opts.baseline));
      const beforeSessions = getMetricsForPeriod(
        db, baselineStart, skill.created_at,
      );

      if (afterSessions.length < 3) {
        console.log(`  ⏳ Only ${afterSessions.length} sessions after creation, need ≥ 3. Skipping.`);
        continue;
      }

      if (beforeSessions.length < 1) {
        console.log(`  ⚠️ No baseline data available. Skipping.`);
        continue;
      }

      const result = calculateRoi(beforeSessions, afterSessions);

      const record: RoiRecord = {
        skill_id: skill.id,
        before_avg_tokens: result.before_avg_tokens,
        after_avg_tokens: result.after_avg_tokens,
        before_avg_turns: result.before_avg_turns,
        after_avg_turns: result.after_avg_turns,
        before_avg_tool_calls: result.before_avg_tool_calls,
        after_avg_tool_calls: result.after_avg_tool_calls,
        before_error_rate: result.before_error_rate,
        after_error_rate: result.after_error_rate,
        score: result.composite_score,
        verdict: result.verdict,
        sample_size: result.sample_size,
        evaluated_at: new Date().toISOString(),
      };
      insertRoiRecord(db, record);

      const emoji = result.verdict === 'positive' ? '🟢' : result.verdict === 'neutral' ? '🟡' : '🔴';
      console.log(`  ${emoji} Score: ${result.composite_score.toFixed(1)}/100 — ${result.verdict}`);
      console.log(`     Tokens: ${result.before_avg_tokens.toFixed(0)} → ${result.after_avg_tokens.toFixed(0)} (${result.token_score.toFixed(1)}%)`);

      if (result.verdict === 'negative') {
        updateSkillStatus(db, skill.id, 'deprecated');
        console.log(`  ⚠️ Auto-deprecated: ROI negative. Consider removing this skill.`);
      }
    }

    closeDb();
  });

function getMetricsForPeriod(
  db: ReturnType<typeof getDb>,
  startDate: string,
  endDate: string | null,
): SessionMetrics[] {
  let query = `SELECT DISTINCT session_id FROM raw_events WHERE timestamp >= ?`;
  const params: string[] = [startDate];
  if (endDate) {
    query += ` AND timestamp < ?`;
    params.push(endDate);
  }
  const sessions = db.prepare(query).all(...params) as { session_id: string }[];

  const metrics: SessionMetrics[] = [];
  for (const s of sessions) {
    const toolCalls = db.prepare(
      "SELECT COUNT(*) as count FROM raw_events WHERE session_id = ? AND event_type = 'tool_call'"
    ).get(s.session_id) as { count: number };

    const errors = db.prepare(
      "SELECT COUNT(*) as count FROM raw_events WHERE session_id = ? AND error = 1"
    ).get(s.session_id) as { count: number };

    const EST_TOKENS_PER_TOOL_CALL = 250;

    metrics.push({
      totalTokens: toolCalls.count * EST_TOKENS_PER_TOOL_CALL,
      totalTurns: toolCalls.count,
      totalToolCalls: toolCalls.count,
      errorCount: errors.count,
    });
  }

  return metrics;
}

function subtractDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
