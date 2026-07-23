---
paths:
  - ".claude/**"
---

# .claude 目录标准

## 跨会话记忆
- `production/active.md`：当前在做什么
- `production/changelog.md`：所有版本变更
- `production/sessions/`：每次压缩前的快照

## 改 .claude 之后
运行 `/skill-test` 验证 hooks 没坏。
