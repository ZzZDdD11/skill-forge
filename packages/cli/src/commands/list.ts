import { Command } from 'commander';
import { getDb, closeDb, getPendingSuggestions, getActiveSkills, getAllPatterns } from '@skillforge/core';

export const listCommand = new Command('list')
  .description('List patterns, suggestions, and skills')
  .option('--suggestions', 'Show pending suggestions only')
  .option('--skills', 'Show active skills only')
  .option('--patterns', 'Show detected patterns only')
  .action((opts) => {
    const db = getDb();
    const showAll = !opts.suggestions && !opts.skills && !opts.patterns;

    if (showAll || opts.suggestions) {
      const suggestions = getPendingSuggestions(db);
      console.log(`\n📋 Pending Suggestions (${suggestions.length}):`);
      for (const s of suggestions) {
        console.log(`  #${s.id} ${s.suggested_skill_name} — ${s.frequency}x in ${s.sessions} sessions`);
      }
    }

    if (showAll || opts.skills) {
      const skills = getActiveSkills(db);
      console.log(`\n🛠 Active Skills (${skills.length}):`);
      for (const s of skills) {
        console.log(`  ${s.name} (v${s.version}) — ${s.file_path}`);
      }
    }

    if (showAll || opts.patterns) {
      const patterns = getAllPatterns(db);
      console.log(`\n🔍 Detected Patterns (${patterns.length}):`);
      for (const p of patterns.slice(0, 10)) {
        const seq = JSON.parse(p.tool_sequence) as { tool_name: string }[];
        console.log(`  ${seq.map(c => c.tool_name).join(' → ')} — ${p.frequency}x (${p.sessions} sessions)`);
      }
    }

    closeDb();
  });
