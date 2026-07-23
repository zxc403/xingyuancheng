#!/usr/bin/env bash
# .claude/hooks/validate-commit.sh
# CCGS 风格：git commit 前扫硬编码 / TODO / 大文件
CMD="${CLAUDE_TOOL_INPUT:-}"
if ! echo "$CMD" | grep -qE "git commit"; then
  exit 0  # 不是 commit 指令，直接放行
fi
cd "$(dirname "$0")/../.." || exit 0
# 1. 检查大文件（>10MB）
LARGE=$(git status --porcelain 2>/dev/null | awk '{print $2}' | xargs -I{} stat -c "%n %s" "{}" 2>/dev/null | awk '$2 > 10485760 {print $1, "($2 bytes)"}')
if [ -n "$LARGE" ]; then
  echo "⚠ 检测到 >10MB 文件，确认是否真的想提交:"
  echo "$LARGE"
fi
# 2. 扫硬编码密钥 / .env
if git diff --cached 2>/dev/null | grep -E "AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}" >/dev/null; then
  echo "❌ 提交包含疑似密钥，已阻止"
  exit 2
fi
exit 0
