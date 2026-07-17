#!/usr/bin/env bash
# hooks/session-end.sh
# Trigger skillbot analyze after each Claude Code session ends.
# Write tool call events first via the recorder, then run analyze.

SKILLFORGE_BIN="${SKILLFORGE_BIN:-skillbot}"

if ! command -v "$SKILLFORGE_BIN" &> /dev/null; then
  exit 0
fi

# Run analyze on recent data (low thresholds for frequent detection)
"$SKILLFORGE_BIN" analyze --since 1d --min-frequency 3 --min-sessions 2 &

# Also run evaluate on all active skills periodically
"$SKILLFORGE_BIN" evaluate --all --baseline 30 &

exit 0
