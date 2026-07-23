#!/usr/bin/env bash
# .claude/hooks/validate-assets.sh
# PostToolUse：写 / 改 assets/ 下文件时校验命名
FILE_PATH="${CLAUDE_FILE_PATH:-}"
if ! echo "$FILE_PATH" | grep -qE "^assets/"; then
  exit 0
fi
# 简单命名校验
if echo "$FILE_PATH" | grep -qE "\.(glb|hdr|png|jpg)$"; then
  BASENAME=$(basename "$FILE_PATH")
  if echo "$BASENAME" | grep -qE "[A-Z]"; then
    echo "ℹ 资产命名建议全小写（Khronos 约定）：$BASENAME"
  fi
fi
exit 0
