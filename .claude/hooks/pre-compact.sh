#!/usr/bin/env bash
# .claude/hooks/pre-compact.sh
# CCGS 风格：压缩前把 active.md 备份
cd "$(dirname "$0")/../.." || exit 0
mkdir -p production/sessions
if [ -f production/active.md ]; then
  STAMP=$(date +%Y%m%d_%H%M%S)
  cp production/active.md "production/sessions/active_${STAMP}.md"
  echo "[pre-compact] active.md archived → production/sessions/active_${STAMP}.md"
fi
exit 0
