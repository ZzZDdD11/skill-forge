# SkillForge

Self-evolving skill creation system for AI coding agents.

SkillForge tracks your agent interactions, detects repeated behavior patterns, suggests creating skills, and evaluates their ROI with real data — not gut feeling.

## How It Works

```
Observe → Detect patterns → Suggest skills → Evaluate ROI → Evolve or retire
```

1. **Record**: PostToolUse hooks log every tool call to SQLite
2. **Analyze**: PrefixSpan algorithm mines frequent tool-call sequences across sessions
3. **Suggest**: When a pattern repeats enough, SkillForge suggests creating a skill
4. **Evaluate**: 4-dimensional ROI scoring (tokens, turns, tool calls, errors)
5. **Auto-deprecate**: Skills with negative ROI are automatically deprecated

## Installation

```bash
npm install -g skillforge   # or: git clone + npm install + npm link -w packages/cli -w packages/mcp
skillforge setup             # init DB, configure MCP, install hooks
```

Done. Restart Claude Code.

### Manual configuration (if setup doesn't work)

Add to `~/.claude/.mcp.json`:
```json
{
  "mcpServers": {
    "skillforge": {
      "command": "skillforge-mcp",
      "args": []
    }
  }
}
```

Add to `~/.claude/settings.json`:
```json
{
  "hooks": {
    "SessionEnd": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "skillforge analyze --since 1d --min-frequency 3 --min-sessions 2 && skillforge evaluate --all" }]
    }]
  }
}
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `skillforge setup` | One-command setup (DB + MCP + hooks) |
| `skillforge init` | Initialize database only |
| `skillforge analyze` | Detect repeated patterns |
| `skillforge evaluate` | Evaluate skill ROI |
| `skillforge list` | List patterns, suggestions, skills |
| `skillforge stats` | Show dashboard |
| `skillforge record` | Record a tool call (used by hooks) |

## Architecture

```
PostToolUse Hook → skillforge record → SQLite raw_events
SessionEnd Hook  → skillforge analyze → patterns + suggestions
SessionStart Hook → get_suggestions (via MCP) → Agent sees suggestions
Agent calls apply_skill → SKILL.md generated
SessionEnd Hook → skillforge evaluate → ROI records
Negative ROI → auto-deprecate
```

## MVP Scope

- [x] Tool call recording via PostToolUse hook
- [x] PrefixSpan pattern detection
- [x] 4-dimensional ROI scoring
- [x] Auto-deprecation of negative-ROI skills
- [x] MCP query tools (get_suggestions, get_skill_roi, apply_skill)
- [x] Claude Code integration

### Deferred to v2

- Semantic similarity (embedding clustering)
- Multi-platform support (Codex, Cursor, Gemini CLI)
- Skill evolution engine
- Web dashboard
