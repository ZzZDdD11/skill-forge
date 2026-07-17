import { Command } from 'commander';
import { getDb, closeDb } from 'autoskill-core';

export const initCommand = new Command('init')
  .description('Initialize ~/.autoskill/logs.db')
  .action(() => {
    const db = getDb();
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    closeDb();

    console.log('✅ SkillForge initialized!');
    console.log(`   Database: ~/.autoskill/logs.db`);
    console.log(`   Tables: ${tables.map(t => t.name).join(', ')}`);
  });
