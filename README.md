# SkillBot

**Self-evolving skill creation system for AI coding agents.**

Tracks your agent interactions, detects repeated behavior patterns, suggests creating skills, and evaluates their ROI with real data — not gut feeling.

```
Observe → Detect patterns → Suggest skills → Evaluate ROI → Evolve or retire
```

## Quick Start

```bash
npm install -g skillbot
skillbot setup
```

Restart Claude Code. Done.

## How It Works

1. Every Claude Code session end → `skillbot analyze` detects repeated tool-call patterns
2. If a pattern repeats enough → a **suggestion** is created
3. Agent can call `get_suggestions` (MCP tool) → "Want to create a skill from this?"
4. Agent calls `apply_skill` → generates a `SKILL.md` file
5. After ≥3 sessions → `skillbot evaluate` scores the skill's ROI
6. ROI negative → auto-deprecated, warned on next session

## CLI Commands

| Command | Description |
|---------|-------------|
| `skillbot setup` | One-command setup: init DB + configure MCP + install hooks |
| `skillbot init` | Initialize `~/.skillbot/logs.db` |
| `skillbot analyze --since 7d` | Detect repeated tool call patterns |
| `skillbot evaluate <name>` | Calculate ROI for a specific skill |
| `skillbot evaluate --all` | Evaluate all active skills |
| `skillbot list` | Show patterns, suggestions, and skills |
| `skillbot stats` | Dashboard |
| `skillbot record` | Record a tool call (used by hooks) |

## MCP Tools (Agent-callable)

| Tool | Description |
|------|-------------|
| `get_suggestions` | View pending skill suggestions |
| `get_skill_roi <name>` | Check a skill's ROI with real numbers |
| `apply_skill <id>` | Create a SKILL.md from a suggestion |

## ROI Scoring

4 dimensions, weighted composite score (0–100):

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

## Development

```bash
git clone https://github.com/ZzZDdD11/skill-forge.git
cd skill-forge
npm install          # postinstall auto-builds
npm run test         # 21 tests
```

## Project Structure

```
packages/
├── core/    ← skillbot-core: SQLite, PrefixSpan, ROI engine
├── mcp/     ← skillbot-mcp: MCP tools for agent interaction
└── cli/     ← skillbot: CLI commands
hooks/       ← Claude Code hook scripts
```

## v2 Roadmap

- Semantic similarity (embedding clustering)
- Multi-platform (Codex, Cursor, Gemini CLI)
- Skill self-evolution engine
- Web dashboard
