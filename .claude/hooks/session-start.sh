#!/usr/bin/env bash
# .claude/hooks/session-start.sh
# CCGS 风格：会话开始时给出项目状态
set -e
cd "$(dirname "$0")/../.." || exit 0
echo "=== 星渊城 / Star Abyss ==="
echo "分支: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'no-git')"
echo "最近 3 次提交:"
git log --oneline -3 2>/dev/null || echo "  (no commits yet)"
echo "未跟踪关键资源:"
ls assets/models/characters/*.glb 2>/dev/null | wc -l | xargs -I{} echo "  characters GLB: {}"
ls assets/models/pbr_assets/*.glb 2>/dev/null | wc -l | xargs -I{} echo "  pbr_assets GLB: {}"
ls assets/hdri/*.hdr 2>/dev/null | wc -l | xargs -I{} echo "  HDRI: {}"
exit 0
