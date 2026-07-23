#!/usr/bin/env bash
# .claude/hooks/session-stop.sh
# CCGS 风格：会话结束归档
cd "$(dirname "$0")/../.." || exit 0
echo "[session-stop] 星渊城 / Star Abyss session ended at $(date -Iseconds)"
exit 0
