#!/usr/bin/env bash
# .claude/hooks/validate-html.sh
# PostToolUse 钩子：写 / 改 index.html 时，提示同步 .claude/docs
FILE_PATH="${CLAUDE_FILE_PATH:-}"
if ! echo "$FILE_PATH" | grep -qE "index\.html$"; then
  exit 0
fi
cd "$(dirname "$0")/../.." || exit 0
SIZE=$(stat -c "%s" "$FILE_PATH" 2>/dev/null || stat -f "%z" "$FILE_PATH" 2>/dev/null || echo 0)
if [ "$SIZE" -gt 5242880 ]; then  # 5MB
  echo "⚠ index.html 已超 5MB，强烈建议拆 src/ 模块（v7.0 目标）"
fi
# 提醒添加版本号注释
if ! grep -qE "// v[0-9]+\." "$FILE_PATH" 2>/dev/null; then
  echo "ℹ 提示：本次改动请加 // v6.x: 注释"
fi
exit 0
