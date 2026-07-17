import { Command } from 'commander';
import { getDb, closeDb } from 'skillbot-core';

export const initCommand = new Command('init')
  .description('Initialize ~/.skillbot/logs.db')
  .action(() => {
    const db = getDb();
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    closeDb();

    console.log('✅ SkillForge initialized!');
    console.log(`   Database: ~/.skillbot/logs.db`);
    console.log(`   Tables: ${tables.map(t => t.name).join(', ')}`);
  });
