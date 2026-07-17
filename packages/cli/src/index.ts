import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { statsCommand } from './commands/stats.js';
import { setupCommand } from './commands/setup.js';
import { analyzeCommand } from './commands/analyze.js';
import { evaluateCommand } from './commands/evaluate.js';
import { recordCommand } from './commands/record.js';

const program = new Command();

program
  .name('autoskill')
  .description('Self-evolving skill creation system')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(setupCommand);
program.addCommand(analyzeCommand);
program.addCommand(evaluateCommand);
program.addCommand(recordCommand);
program.addCommand(listCommand);
program.addCommand(statsCommand);

program.parse();
