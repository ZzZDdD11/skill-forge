#!/usr/bin/env bash
# hooks/post-tool-use.sh
# Record every tool call made by the agent.
# Called by Claude Code PostToolUse hook with session ID and tool call info.

# Arguments passed by Claude Code hook:
#   $CLAUDE_SESSION_ID - current session UUID
#   tool name and input are passed via hook args

SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
TOOL_NAME="${1:-unknown}"
TOOL_INPUT="${2:-{}}"

if command -v skillforge &> /dev/null; then
  skillforge record --session-id "$SESSION_ID" --tool-name "$TOOL_NAME" --tool-input "$TOOL_INPUT" &
fi
