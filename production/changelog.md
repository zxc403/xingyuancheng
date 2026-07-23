# Changelog

## v6.10.0 — src/ 模块化骨架（commit 1 of 7）
- ✅ 建立 `src/` 目录结构（6 个模块：core/entities/ai/physics/ui/assets）
- ✅ 创建 15 个占位文件，每个都标注了 v6.10.x 哪一步会填充真实逻辑
- ✅ 编写 `src/README.md`（模块职责 + 调用规则 + 入口）
- ✅ 编写 `src/main.js`（boot 顺序：core → assets → physics → ai → entities → ui → gameLoop）
- ✅ 主入口暴露 `window.__game` 方便调试
- ⏸ index.html 暂未改 - 仍为单体（commit 2-7 逐步迁移）
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.9.2 — 移动端点击 blocker 没反应修复
- 🔥 移动端根本点不到 blocker：之前 `blocker` 全屏遮罩在移动端永远显示, 但 `touchCtrl` 要等 `initInput` 才激活
- ✅ 修复: 在 `init()` 最早期就检测 `isMobile`, 直接隐藏 blocker + 显示 touchCtrl + gameStarted=true
- ✅ 移动端不再尝试 `requestPointerLock()` (移动浏览器本来就不支持)
- ✅ 12 秒兜底只对 PC 生效 (移动端早期已启动)

## v6.9.1 — 修复"玩家根本动不了" + GitHub 灵感库资源库
- 🔥 **重大修复**: 玩家移动不了 = `blocker` 被 v6.1.1 兜底逻辑强制 `display:none` 但 `gameStarted` 仍为 false, 导致 `updatePlayer` 永远不被调用
- ✅ 新增 `.claude/skills/inspiration-library.md`：GitHub 资源库（角色控制器 / 城市生成 / CCGS 同类 / 引擎）
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.9 — 玩家 GLB 身体 + PBR 拉近 + CCGS 工作室化
- ✅ 玩家从无身体 → char_xbot GLB + AnimationMixer（idle/walk/run 状态机）
- ✅ 玩家跟随 `player.pos` + `player.yaw`，载具内自动隐藏
- ✅ PBR 展圈从远处搬到玩家出生点 4-7m
- ✅ 新增 `.claude/` CCGS 风格骨架（6 agents / 7 skills / 6 hooks / 3 rules / 4 templates / 4 docs）
- 📦 部署：https://github.com/zxc403/xingyuancheng
