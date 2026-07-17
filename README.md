# SkillForge

**Self-evolving skill creation system for AI coding agents.**

SkillForge tracks your agent interactions, detects repeated behavior patterns, suggests creating skills, and evaluates their ROI with real data — not gut feeling.

```
Observe → Detect patterns → Suggest skills → Evaluate ROI → Evolve or retire
```

## Quick Start

```bash
git clone https://github.com/ZzZDdD11/skill-forge.git
cd skill-forge
npm install          # postinstall auto-builds
npm link -w packages/cli -w packages/mcp
autoskill setup      # init DB, configure MCP, install hooks
```

Restart Claude Code. That's it.

## How It Works

1. **Record**: SkillForge CLI logs tool calls to SQLite (`autoskill record`)
2. **Analyze**: PrefixSpan algorithm mines frequent tool-call sequences across sessions (`autoskill analyze`)
3. **Evaluate**: 4-dimensional ROI scoring — tokens saved, turns reduced, tool calls eliminated, errors dropped (`autoskill evaluate`)
4. **Auto-deprecate**: Skills with negative ROI are automatically marked for removal

### The Closed Loop

```
SessionEnd Hook  →  autoskill analyze   →  detects repeat patterns
                  →  autoskill evaluate  →  scores active skills
                       ↓
SessionStart      →  Agent sees pending suggestions (via MCP tools)
                       ↓
Agent calls       →  get_suggestions  →  "3 patterns detected, want to create a skill?"
Agent calls       →  apply_skill      →  generates SKILL.md
                       ↓
Next sessions     →  skill uses the new SKILL.md
SessionEnd Hook   →  autoskill evaluate  →  ROI scoring kicks in
                       ↓
ROI < 10          →  auto-deprecate   →  Agent warned on next session
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `autoskill setup` | One-command setup: DB + MCP config + hooks |
| `autoskill init` | Initialize `~/.autoskill/logs.db` only |
| `autoskill analyze --since 7d` | Detect repeated tool call patterns |
| `autoskill evaluate <name>` | Run ROI scoring for a specific skill |
| `autoskill evaluate --all` | Evaluate all active skills |
| `autoskill list` | Show patterns, suggestions, and skills |
| `autoskill stats` | Dashboard: events, patterns, skills, ROI summary |
| `autoskill record` | Record a tool call event (used by hooks) |

## MCP Tools (Agent-callable)

| Tool | Description |
|------|-------------|
| `get_suggestions` | View pending skill suggestions |
| `get_skill_roi <name>` | Check a skill's ROI with real numbers |
| `apply_skill <id>` | Create a SKILL.md from a suggestion |

## Configuration (what `autoskill setup` does)

Creates and configures these files:

**`~/.claude/.mcp.json`** — Registers the MCP server:
```json
{
  "mcpServers": {
    "autoskill": {
      "command": "autoskill-mcp",
      "args": []
    }
  }
}
```

**`~/.claude/settings.json`** — Adds SessionEnd hook:
```json
{
  "hooks": {
    "SessionEnd": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "autoskill analyze --since 1d --min-frequency 3 --min-sessions 2 && autoskill evaluate --all"
      }]
    }]
  }
}
```

## ROI Scoring Model

SkillForge evaluates skills across 4 dimensions with a weighted composite score (0–100):

| Dimension | Weight | What it measures |
|-----------|--------|------------------|
| Token efficiency | 35% | Reduction in token consumption |
| Interaction turns | 25% | Fewer back-and-forth rounds |
| Tool call count | 20% | Fewer tool invocations |
| Error rate | 20% | Reduction in failed tool calls |

| Score | Verdict |
|-------|---------|
| ≥ 30 | 🟢 Positive — saving money and time |
| 10–29 | 🟡 Neutral — minor improvement |
| < 10 | 🔴 Negative — auto-deprecated |

Evaluation requires ≥ 3 sessions after skill creation to be statistically meaningful.

## Project Structure

```
packages/
├── core/         ← Types, SQLite schema, PrefixSpan algorithm, ROI engine
├── mcp/          ← MCP Server (get_suggestions, get_skill_roi, apply_skill)
└── cli/          ← CLI commands (setup, analyze, evaluate, list, stats)
hooks/            ← Shell scripts for Claude Code hooks
test/e2e/         ← End-to-end pipeline test
```

## MVP Scope

- [x] Tool call recording
- [x] PrefixSpan frequent subsequence mining
- [x] 4-dimensional ROI scoring with auto-deprecation
- [x] MCP query tools
- [x] Claude Code integration (MCP + SessionEnd hook)
- [x] One-command setup

### v2 Roadmap

- Semantic similarity (embedding clustering for pattern detection)
- Multi-platform support (Codex, Cursor, Gemini CLI)
- Skill self-evolution engine
- Web dashboard
