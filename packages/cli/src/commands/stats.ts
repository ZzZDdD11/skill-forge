import { Command } from 'commander';
import { getDb, closeDb, getActiveSkills } from '@skillforge/core';
import type { RoiRecord } from '@skillforge/core';

export const statsCommand = new Command('stats')
  .description('Show dashboard of overall statistics')
  .action(() => {
    const db = getDb();

    const { total_events } = db.prepare(
      'SELECT COUNT(*) as total_events FROM raw_events'
    ).get() as { total_events: number };

    const { total_sessions } = db.prepare(
      'SELECT COUNT(DISTINCT session_id) as total_sessions FROM raw_events'
    ).get() as { total_sessions: number };

    const { total_patterns } = db.prepare(
      'SELECT COUNT(*) as total_patterns FROM patterns'
    ).get() as { total_patterns: number };

    const skills = getActiveSkills(db);

    let totalSaved = 0;
    let positiveSkills = 0;
    let negativeSkills = 0;

    for (const skill of skills) {
      if (!skill.id) continue;
      const roi = db.prepare(
        'SELECT * FROM roi_records WHERE skill_id = ? ORDER BY evaluated_at DESC LIMIT 1'
      ).get(skill.id) as RoiRecord | undefined;
      if (roi) {
        totalSaved += (roi.before_avg_tokens - roi.after_avg_tokens) * roi.sample_size;
        if (roi.verdict === 'positive') positiveSkills++;
        else if (roi.verdict === 'negative') negativeSkills++;
      }
    }

    console.log(`
╔═══════════════════════════════════╗
║       SkillForge Dashboard        ║
╠═══════════════════════════════════╣
║ Total events recorded:  ${String(total_events).padStart(8)}  ║
║ Total sessions:         ${String(total_sessions).padStart(8)}  ║
║ Detected patterns:      ${String(total_patterns).padStart(8)}  ║
║ Active skills:          ${String(skills.length).padStart(8)}  ║
║ 🟢 Positive ROI skills: ${String(positiveSkills).padStart(8)}  ║
║ 🔴 Negative ROI skills: ${String(negativeSkills).padStart(8)}  ║
║ Est. tokens saved:      ${String(Math.round(totalSaved).toLocaleString()).padStart(8)}  ║
╚═══════════════════════════════════╝
`);

    closeDb();
  });
