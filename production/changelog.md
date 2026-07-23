# Changelog

## v6.10.4 — 抽离 NPC + Vehicle 实体（commit 5 of 7）
- ✅ `src/entities/NPC.js` 从占位升级为完整 NPC 类
- ✅ `NPC.spawn(type, x, z, custom)` 工厂方法 - clone GLB + 按 type.beh 选 Soldier/Xbot/Barbarian + 染色 + AnimationMixer
- ✅ `NPC._spawnFallback()` - GLB 不可用时用胶囊
- ✅ `NPC.updateAnim(dt)` - 单个 NPC 动画状态机
- ✅ `NPC.updateAll(dt)` - 批量更新所有 NPC 动画（替代 window._npcMixers 列表）
- ✅ `NPC.clear()` - 场景重置时清空列表
- ✅ `src/entities/Vehicle.js` 从占位升级为完整 Vehicle 类
- ✅ `Vehicle.spawn(scene, model, x, z, yaw)` - 程序几何车身 + 4 轮 + 警车红蓝灯
- ✅ `Vehicle.findNearest(pos, maxDist)` - 找最近可进入的载具
- ✅ `Vehicle.setDriver(player)` - 进入/离开载具
- ✅ index.html animate 循环 NPC 动画更新委托给 NPC.updateAll
- ⏸ spawnNPCs() 仍在 index.html（依赖 types/areas/npcNames/npcCtx 大量数据）
- ⏸ updateNPCs() 大函数（200+ 行 AI 决策）尚未迁移 - 留到 v6.11 AI 模块
- ⏸ 车辆物理（Rapier 动力学）尚未接入 - 留到 v6.11
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.10.3 — 抽离 Player 实体（commit 4 of 7）
- ✅ `src/entities/Player.js` 从占位升级为完整玩家实体类
- ✅ `spawn(scene)` - clone Xbot + 染色 + AnimationMixer 注入
- ✅ `_spawnFallback(scene)` - GLB 不可用时使用胶囊兜底
- ✅ `updateAnim(dt)` - 动画状态机（idle/walk/run + fadeIn/Out 0.2s）
- ✅ `syncMesh()` - 同步 mesh 到 pos/yaw
- ✅ `setVisible(v)` - 载具切换时显示/隐藏
- ✅ index.html 中 `createPlayerMesh()` 和 `updatePlayerAnim()` 改为 5 行委托代码
- ✅ 减少 index.html 75 行（创建玩家身体 + 动画状态机）
- ⏸ updatePlayer 大函数（300+ 行物理/碰撞/载具）尚未迁移 - 留到 v6.11 物理模块时一起做
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.10.2 — 抽离 Input 模块（commit 3 of 7）
- ✅ `src/core/Input.js` 从占位升级为完整输入事件管理
- ✅ 提供 `init({rendererEl, callbacks})` 接口（接收回调：onMouseMove / onMouseDown / onPointerLockChange / onEscape / onTouchViewStart / onTouchView / onTouchJoystick / onTouchAction）
- ✅ 提供 `bindAction(key, fn)` 快捷键注册
- ✅ 提供 `update()` 每帧重置鼠标增量
- ✅ index.html initInput 调用 Input.init，老的 keydown 业务逻辑（武器切换/任务/帮助）保留作为兼容层
- ✅ Input 模块的 _initTouch 自动激活 #touchCtrl（v6.9.2 兼容）
- ⏸ 老的 keydown/mousemove/mousedown 监听器尚未删除 - v6.10.7 才完全切到 Input.bindAction
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.10.1 — 抽离 Renderer 模块（commit 2 of 7）
- ✅ `src/core/Renderer.js` 从占位升级为完整状态容器
- ✅ `attach({scene,camera,renderer,composer,clock,isMobile})` 接收 index.html 已建好的 Three.js 对象
- ✅ 提供 `tick()` / `onResize()` / `updateFPS()` 三个核心接口
- ✅ `syncGlobals()` 保持 window.scene / window.camera / window.renderer 全局兼容
- ✅ index.html initEngine 末尾加挂 Renderer：scene/camera/renderer/composer/clock/isMobile 全部传入
- ⏸ index.html 主体代码未删 - commit 7 才把 initEngine 整段迁走
- ⏸ Renderer 主循环渲染部分暂未接管 - v6.10.7 升级 Three.js 时一起做
- 📦 部署：https://github.com/zxc403/xingyuancheng

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
