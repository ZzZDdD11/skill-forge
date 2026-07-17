import { Command } from 'commander';
import { getDb, closeDb } from '@skillforge/core';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getClaudeDir(): string {
  return join(homedir(), '.claude');
}

function getHooksDir(): string {
  return join(getClaudeDir(), 'hooks');
}

export const setupCommand = new Command('setup')
  .description('One-command setup: init DB, configure MCP, install hooks')
  .option('--dry-run', 'Show what would be done without doing it')
  .action((opts) => {
    const dryRun = opts.dryRun || false;
    const steps: string[] = [];

    // Step 1: Init DB
    steps.push('1. Initialize database');
    if (!dryRun) {
      getDb();
      closeDb();
    }

    // Step 2: Create ~/.claude/hooks
    const hooksDir = getHooksDir();
    if (!existsSync(hooksDir)) {
      steps.push('2. Create ~/.claude/hooks/');
      if (!dryRun) mkdirSync(hooksDir, { recursive: true });
    } else {
      steps.push('2. ~/.claude/hooks/ already exists');
    }

    // Step 3: Copy hook scripts from the skillforge package
    const projectRoot = join(__dirname, '..', '..', '..', '..', '..');
    const hooksSourceDir = join(projectRoot, 'hooks');
    const hookFiles = [
      { src: join(hooksSourceDir, 'session-end.sh'), dest: join(hooksDir, 'skillforge-session-end.sh') },
      { src: join(hooksSourceDir, 'session-start.md'), dest: join(hooksDir, 'skillforge-session-start.md') },
    ];

    for (const { src, dest } of hookFiles) {
      if (existsSync(src)) {
        steps.push(`3. Copy ${src} → ${dest}`);
        if (!dryRun) {
          cpSync(src, dest);
          if (dest.endsWith('.sh')) chmodSync(dest, 0o755);
        }
      }
    }

    // Step 4: Generate ~/.claude/.mcp.json
    const mcpJsonPath = join(getClaudeDir(), '.mcp.json');
    const mcpConfig = {
      mcpServers: {
        skillforge: {
          command: 'skillforge-mcp',
          args: [],
        },
      },
    };

    if (!existsSync(mcpJsonPath)) {
      steps.push('4. Create ~/.claude/.mcp.json');
      if (!dryRun) {
        writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + '\n');
      }
    } else {
      // Merge if exists
      steps.push('4. Merge MCP config into existing ~/.claude/.mcp.json');
      if (!dryRun) {
        const existing = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
        if (!existing.mcpServers) existing.mcpServers = {};
        existing.mcpServers.skillforge = mcpConfig.mcpServers.skillforge;
        writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2) + '\n');
      }
    }

    // Step 5: Add hook to ~/.claude/settings.json
    const settingsPath = join(getClaudeDir(), 'settings.json');
    const hookEntry = {
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: `bash ${join(hooksDir, 'skillforge-session-end.sh')}`,
        },
      ],
    };

    if (!existsSync(settingsPath)) {
      steps.push('5. Create ~/.claude/settings.json with hook');
      if (!dryRun) {
        writeFileSync(settingsPath, JSON.stringify({
          hooks: { SessionEnd: [hookEntry] },
        }, null, 2) + '\n');
      }
    } else {
      steps.push('5. Add SessionEnd hook to ~/.claude/settings.json');
      if (!dryRun) {
        const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        if (!existing.hooks) existing.hooks = {};
        if (!existing.hooks.SessionEnd) {
          existing.hooks.SessionEnd = [];
        }
        // Check if skillforge hook already exists
        const alreadyExists = existing.hooks.SessionEnd.some(
          (entry: any) => {
            const h = entry.hooks?.[0];
            return h?.command?.includes('skillforge-session-end');
          }
        );
        if (!alreadyExists) {
          existing.hooks.SessionEnd.push(hookEntry);
          writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n');
        } else {
          steps.push('   (hook already configured, skipping)');
        }
      }
    }

    // Output
    console.log('🚀 SkillForge Setup\n');
    for (const step of steps) {
      console.log(`  ${step}`);
    }

    console.log('\n✅ Setup complete!');
    console.log('   Restart Claude Code for changes to take effect.');
    console.log('   Run "skillforge stats" to verify.\n');

    if (!dryRun) {
      // Verify
      const db = getDb();
      const { total_events } = db.prepare(
        "SELECT COUNT(*) as total_events FROM raw_events"
      ).get() as { total_events: number };
      closeDb();

      console.log(`   Database: ~/.skillforge/logs.db (${total_events} events recorded)`);
      console.log(`   Next session: hooks will auto-run analyze + evaluate`);
    }
  });
