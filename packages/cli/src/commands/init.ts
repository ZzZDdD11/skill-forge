import { Command } from 'commander';
import { getDb, closeDb } from '@skillforge/core';

export const initCommand = new Command('init')
  .description('Initialize ~/.skillforge/logs.db')
  .action(() => {
    const db = getDb();
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    closeDb();

    console.log('✅ SkillForge initialized!');
    console.log(`   Database: ~/.skillforge/logs.db`);
    console.log(`   Tables: ${tables.map(t => t.name).join(', ')}`);
  });
