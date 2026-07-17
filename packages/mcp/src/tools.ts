import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import Database from 'better-sqlite3';
import { z } from 'zod/v4';
import {
  getPendingSuggestions,
  updateSuggestionStatus,
  insertSkill,
  getLatestRoiForSkill,
  getActiveSkills,
} from 'autoskill-core';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import type { Suggestion } from 'autoskill-core';

const SKILLS_DIR = join(homedir(), '.claude', 'skills');

export function registerTools(server: McpServer, db: Database.Database): void {
  // Tool 1: get_suggestions
  server.registerTool(
    'get_suggestions',
    {
      description: 'Get pending skill suggestions detected from repeated behavior patterns',
    },
    async () => {
      const suggestions = getPendingSuggestions(db);

      if (suggestions.length === 0) {
        return {
          content: [{ type: 'text', text: 'No pending suggestions. Keep working naturally!' }],
        };
      }

      const lines = suggestions.map((s, i) =>
        `${i + 1}. **${s.suggested_skill_name}** ` +
        `(pattern: ${s.tool_sequence.map((c: { tool_name: string }) => c.tool_name).join(' → ')}) ` +
        `— ${s.frequency} occurrences across ${s.sessions} sessions. ` +
        `Est. savings: ${s.estimated_token_savings}.`
      );

      return {
        content: [{
          type: 'text',
          text: `## Pending Skill Suggestions\n\n${lines.join('\n\n')}\n\n` +
            `To create a skill, call \`apply_skill\` with the suggestion ID.`,
        }],
      };
    },
  );

  // Tool 2: get_skill_roi
  server.registerTool(
    'get_skill_roi',
    {
      description: 'Get ROI evaluation for a specific skill by name',
      inputSchema: {
        skill_name: z.string().describe('The name of the skill to evaluate'),
      },
    },
    async ({ skill_name }: { skill_name: string }) => {
      const skills = getActiveSkills(db);
      const skill = skills.find(s => s.name === skill_name);

      if (!skill || !skill.id) {
        return {
          content: [{ type: 'text', text: `Skill "${skill_name}" not found or not active.` }],
        };
      }

      const roi = getLatestRoiForSkill(db, skill.id);

      if (!roi) {
        return {
          content: [{
            type: 'text',
            text: `Skill "${skill_name}" has no ROI data yet (need at least 3 uses after creation).`,
          }],
        };
      }

      // Compute derived scores
      const tokenScore = roi.before_avg_tokens > 0
        ? ((roi.before_avg_tokens - roi.after_avg_tokens) / roi.before_avg_tokens) * 100
        : 0;
      const turnScore = roi.before_avg_turns > 0
        ? ((roi.before_avg_turns - roi.after_avg_turns) / roi.before_avg_turns) * 100
        : 0;
      const toolScore = roi.before_avg_tool_calls > 0
        ? ((roi.before_avg_tool_calls - roi.after_avg_tool_calls) / roi.before_avg_tool_calls) * 100
        : 0;

      const emoji = roi.verdict === 'positive' ? '🟢' : roi.verdict === 'neutral' ? '🟡' : '🔴';

      return {
        content: [{
          type: 'text',
          text: `## ROI for "${skill_name}" ${emoji} ${roi.verdict}\n\n` +
            `| Dimension | Before | After | Change |\n` +
            `|-----------|--------|-------|--------|\n` +
            `| Avg Tokens | ${roi.before_avg_tokens.toFixed(0)} | ${roi.after_avg_tokens.toFixed(0)} | ${tokenScore.toFixed(1)}% |\n` +
            `| Avg Turns | ${roi.before_avg_turns?.toFixed(1) ?? '?'} | ${roi.after_avg_turns?.toFixed(1) ?? '?'} | ${turnScore.toFixed(1)}% |\n` +
            `| Avg Tool Calls | ${roi.before_avg_tool_calls?.toFixed(1) ?? '?'} | ${roi.after_avg_tool_calls?.toFixed(1) ?? '?'} | ${toolScore.toFixed(1)}% |\n` +
            `| Error Rate | ${((roi.before_error_rate ?? 0) * 100).toFixed(1)}% | ${((roi.after_error_rate ?? 0) * 100).toFixed(1)}% | |\n\n` +
            `**Composite Score:** ${roi.score?.toFixed(1) ?? '?'}/100\n` +
            `**Sample Size:** ${roi.sample_size} sessions`,
        }],
      };
    },
  );

  // Tool 3: apply_skill
  server.registerTool(
    'apply_skill',
    {
      description: 'Create a SKILL.md file from a suggestion',
      inputSchema: {
        suggestion_id: z.number().describe('The ID of the suggestion to apply'),
      },
    },
    async ({ suggestion_id }: { suggestion_id: number }) => {
      const suggestions = getPendingSuggestions(db);
      const suggestion = suggestions.find(s => s.id === suggestion_id);

      if (!suggestion) {
        return {
          content: [{ type: 'text', text: `Suggestion #${suggestion_id} not found.` }],
        };
      }

      mkdirSync(SKILLS_DIR, { recursive: true });

      const skillContent = generateSkillMd(suggestion);
      const skillDir = join(SKILLS_DIR, suggestion.suggested_skill_name);
      mkdirSync(skillDir, { recursive: true });
      const skillPath = join(skillDir, 'SKILL.md');
      writeFileSync(skillPath, skillContent);

      insertSkill(db, {
        name: suggestion.suggested_skill_name,
        pattern_hash: suggestion.pattern_hash,
        file_path: skillPath,
        version: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      updateSuggestionStatus(db, suggestion_id, 'applied');

      return {
        content: [{
          type: 'text',
          text: `✅ Skill "${suggestion.suggested_skill_name}" created!\n\n` +
            `- File: \`${skillPath}\`\n` +
            `- The skill will now be available in future sessions.\n` +
            `- SkillForge will automatically evaluate its ROI after 3+ uses.`,
        }],
      };
    },
  );
}

function generateSkillMd(suggestion: Suggestion): string {
  const steps = suggestion.tool_sequence
    .map((s, i) => `${i + 1}. **${s.tool_name}**(${s.input_keys.join(', ')})`)
    .join('\n');

  const examplesMd = suggestion.examples
    .map((e, i) => `- ${e}`)
    .join('\n');

  return `---
name: ${suggestion.suggested_skill_name}
description: Auto-generated by SkillForge. Repeated pattern detected across ${suggestion.frequency} sessions.
---

# ${suggestion.suggested_skill_name}

Automatically generated by SkillForge based on repeated behavior pattern.

## Workflow

${steps}

## Real-World Examples

${examplesMd}

## When to Use

This skill triggers when the user's workflow matches the above pattern.

---
*Generated by [SkillForge](https://github.com/your/autoskill) on ${new Date().toISOString()}*
`;
}
