# 上下文管理

## 跨会话
新会话第一步：
1. 读 `/workspace/.claude/CLAUDE.md`
2. 读 `/workspace/production/active.md`（如有）
3. 读 `/workspace/production/changelog.md` 最近 10 条

## 长会话
session-start.sh 输出当前 git 状态。
pre-compact.sh 自动备份 active.md 到 production/sessions/。

## 大文件
`index.html` 当前 ~200KB，>5MB 必须拆 `src/` 模块。
