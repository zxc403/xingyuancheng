# Changelog

## v6.12 — 画质再升级：r166 兼容 + 4 档画质 + Film Pass + PBR 拉满（commit 6 of 6，M3 全套）
- ✅ **M3.1 升级 r160 → r166 兼容层**
  - `OutputPass` 已在 r160 就位（之前 v6.10.6 已引），无需改 main path
  - 补 `shadowMap.bias = -0.0005` + `normalBias = 0.02` + `radius = 4`（防 acne + 曲面平滑）
- ✅ **M3.1 4 档画质预设（流畅/均衡/高质/极致）**
  - `QUALITY_PRESETS` 枚举：pixelRatio 1.0-2.0、阴影 512-2048、bloom 0.4-1.2、SSAO 开/关
  - `applyQualityPreset(p)` 实时切换（重建 composer + 改 shadow mapSize + 改 pixelRatio）
  - **F4 快捷键** 循环切档（流畅→均衡→高质→极致），showNotif 显示当前档名
  - 移动端默认 均衡档（qualityPreset=1），桌面默认 高质档（qualityPreset=2）
  - help 面板新增 F4 提示
- ✅ **M3.2 Film Pass 多合一后处理**
  - `src/core/FilmShader.js` 自研 GLSL shader（vignette + grain + 轻量 FXAA）
  - 替换 SMAA：少 1 个 fullscreen pass，且叠加电影感
  - FXAA 简化版：luma edge detection + 邻域 blend（无 alpha 噪点）
  - Vignette：smoothstep(0.85, 0.2, len(uv-0.5))，高质档 0.45 / 流畅档 0.0
  - Grain：hash 噪声 + uTime，每帧动起来（胶片颗粒感）
  - 主循环推 `uTime.value = clock.elapsedTime`
- ✅ **M3.3 WebGPU 后端切换**
  - `RendererBackend.createRenderer` 改为 async：探测到 WebGPU 时 dynamic import `three/addons/renderers/webgpu/WebGPURenderer.js`
  - 兼容兜底：WebGPU 加载失败自动降级 WebGL2（不黑屏）
  - `createRendererSync(opts)` 保留旧接口（标注 deprecated，v6.13 删除）
  - **默认走 WebGL2**（r160 WebGPU 仍 alpha，需 URL 加 `?webgpu=1` 显式开启）
  - 探测到 GPU 能力但未显式开 → `_webgpuAvailable = true` 标记，方便后续诊断
- ✅ **M3.4 PBR 拉满**
  - `Renderer.enhancePBR(scene, opts)` 静态方法：遍历 scene 所有 MeshStandard/Physical
  - `envMapIntensity *= 1.2`（除非 ≥ 2.0）让反射更亮
  - metalness > 0.5 的物体自动加 `clearcoat = 0.3`（车漆质感）
  - `dryRun` 选项：只统计不修改（适合 debug）
  - index.html 在 `buildWorld()` 后调一次（生产环境 1 次）
- ✅ **M3.5 性能收口**
  - shadow dynamic degrade 阈值修正：4096→2048 触发条件 `fps<40`（之前 4096 死路）
  - pixelRatio dynamic degrade：`fps<25` 降至 1.0，`fps≥55` 升回 1.5（自适应）
  - shadowQuality 默认 2048（M3.1 调整，4K 太卡）
- ⏸ Three.js r160 → r166 实跳留到 v6.13（EffectComposer/OutputPass 在 r160 已就位，r166 主要加 WebGPU 完善）
- ⏸ meshopt decoder 留到 v6.13（GLB 二次压缩，30-50% 体积）
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.11.0 — 角色系统 5：Avatar 自定义 + 角色 IK（commit 5 of 6）
- ✅ **M2.5**: `src/ui/AvatarPanel.js` 玩家 Avatar 自定义 UI
  - 6 维度调节：角色模型 / 体型 / 身高 / 肤色 / 服装 5 槽 / 玩家名字
  - 5 个玩家可换皮角色：char_xbot / char_soldier / char_robot / char_rpm / char_knight_student
  - U 键打开 / 关闭（与 ? 帮派面板平行），ESC 关闭
  - 服装 5 槽（shirt/pants/shoes/gloves/hat）× 6 色板，色块 chip 实时反馈当前色
  - "保存" 按钮写 localStorage `avatar_v6_11` + 角色 GLB key `avatar_char_v6_11`
  - "重置" 一键还原 standard / 1.7m / tan / 默认服装 / xbot
  - 内嵌 CSS（深色玻璃拟态 + 蓝色高亮 + 圆角 chip）
- ✅ **Player.js** 升级
  - 新增 `setCharacterKey(charKey)` 玩家换皮 API
  - 切皮时保留 pos/yaw/visible，卸旧 mesh + spawn 新 GLB + 重挂 Avatar
  - 模型未加载完时挂 `_pendingCharKey` + 一次性 500ms poll 等待
  - `_initAvatar(charG, charKeyHint)` 接收 charKey hint，免反查
  - 新增 `getCharacterKey()` 读取当前 avatarHint
- ✅ **AvatarCustomization.js** 静态属性
  - 暴露 `BODY_PRESETS / SKIN_PRESETS / OUTFIT_PALETTE / DEFAULT_CONFIG` 在类上，方便 UI 直接取
- ✅ **index.html** 集成
  - import AvatarPanel + IKSystem 到 window
  - `createPlayerMesh` 末尾绑定 panel + 恢复上次的角色 GLB
  - U 键快捷键 + help 面板新增"Avatar 自定义"提示
- ✅ **M2.6**: `src/entities/IKSystem.js` 角色 IK 系统
  - 3 大通道：脚部 / 视线 / 武器
  - 脚部 IK：射线探测左右脚地形高度差 → 平滑调整 pelvis Y（fallback 到 mesh.position.y）
  - 视线 IK：head bone 缓动转向目标（lerp 系数 dt*4，限 ±60°）
  - 武器 IK：r_hand bone 旋转指向目标（yaw + pitch）
  - 通用骨骼名扫描：Hips / mixamorigHips / LeftFoot / RightFoot / Head / ...
  - 缺骨骼时降级为整体 mesh 调整，不报错
- ✅ **Player.js** 挂 IK
  - spawn 末尾 `this.ik = new IKSystem(this); this.ik.bind(charG)`
  - `setCharacterKey` 切皮时卸旧 IK 让新 spawn 重建
  - 暴露 `updateIK(dt, ctx)` 接口
- ✅ **index.html** 主循环
  - `updatePlayerAnim` 末尾调 `player.updateIK(dt, {targetPos, terrain, onGround, ...})`
  - targetPos 默认取玩家正前方 8m（v6.12 接武器 raycast）
- ⏸ mesh-bvh 精确脚部碰撞留到 v6.12
- ⏸ 完整 CCDIKSolver（多骨链）留到 v6.12
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.11.0 — 角色系统 4：面部表情 morph（commit 4 of 6）
- ✅ **M2.4**: `src/entities/FacialExpression.js` 面部 morph 系统
  - 8 套主表情预设：neutral / happy / angry / sad / surprise / fear / disgust / talk
  - 10 套子表情：blink_L/R/双眼, smile, frown, mouthOpen, lookLeft/Right/Up/Down
  - 每个主表情 = 多个 morph 加权和（如 happy = mouthSmile + eyeSquint + cheekSquint + browInnerUp）
  - 模糊匹配：'mouthSmile_L' 自动匹配 'blendShape1.mouthSmile_L'
  - 3 个 API：`setExpression(name)` 立刻设 / `blendExpression(name, dur)` 渐变到 / `triggerSub(name, val, dur)` 一次性
  - 渐变队列：多个动画并行推进，每帧 lerp 写入 morphTargetInfluences
- ✅ **Player.js 集成**
  - `_initFace(charG)` 自动找 charG 里 morphTargetInfluences 最多的 mesh 作为头部
  - 玩家用 facecap 模型时自动挂载；用 Xbot/Soldier 时跳过
  - `updateAnim` 每帧推进 face.update
- ✅ **NPC.js 集成**
  - 同 Player 自动挂载逻辑
  - `updateAll` 每帧调 face.update + 8m 内 0.5% 概率随机眨眼（自然感）
- ✅ **index.html 集成**
  - 暴露 window.FacialExpression / EXPRESSION_PRESETS / SUB_EXPRESSIONS
  - 加快捷键 1-8 切主表情 / 0 眨眼 / 9 微笑
- ⏸ **M2.5 Avatar 自定义** - 待做
- ⏸ **M2.6 角色 IK** - 待做
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.11.0 — 角色系统 2：完整 blend tree（commit 2 of 6）
- ✅ **M2.3**: `src/entities/AnimationStateMachine.js` 完整动画状态机
  - 16 个 AnimState 枚举：idle/walk/jog/run/crouch_idle/crouch_walk/jump/falling/landing/death/dance/talk/wave/punch/gesture/custom
  - 4 段速度阈值：IDLE<0.1 / WALK<1.5 / JOG<3.5 / RUN+
  - 4 种状态：主循环（speed-based）/ 空中（verticalVel-based）/ 一次性（jump/dance/...）/ 死亡
  - 平滑过渡：fadeIn/fadeOut 0.20s 跨状态切换
  - 智能降级：run 缺时自动用 jog → walk → idle
  - `pickAct(state)` 状态→action 映射 + 降级
  - `_computeState(input)` 状态计算
  - `playOnce(state)` 一次性动作（jump/dance 播完自动回 idle）
- ✅ **Player.js 升级**
  - `INTENT_KEYWORDS` 15 intent → 关键词数组映射
  - spawn 时遍历 INTENT_KEYWORDS 注册所有可能的 clip
  - `updateAnim(dt, input)` 走 SM（新参数：speed/verticalVel/onGround/crouching/dying）
  - `playAction(stateName)` 暴露给 index.html 触发一次性动作
- ✅ **NPC.js 升级**
  - 同样走 INTENT_KEYWORDS 逻辑
  - `updateAnim` 走 SM
  - 缺 SM 时降级回 v6.6 三态硬切逻辑
- ✅ **index.html 集成**
  - 暴露 `window.AnimationStateMachine` / `window.AnimState`
  - 加快捷键 `J` (jump) / `B` (wave) / `G` (gesture) 演示一次性动作
- ⏸ **M2.4 morph target** - 待做
- ⏸ **M2.5 Avatar 自定义** - 待做
- ⏸ **M2.6 角色 IK** - 待做
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.11.0 — 角色系统 1：注册表 + 18 角色（commit 1 of 6）
- ✅ **M2.1**: 下载 11 套 CC0/MIT 角色模型
  - RobotExpressive.glb (464KB, 13 clips, MIT)
  - Fox.glb (163KB, 3 clips, CC0/Khronos)
  - LeePerrySmith.glb (405KB, CC-BY)
  - Facecap.glb (333KB, 带 morph target, CC-BY)
  - ReadyPlayer.glb (1.8MB, CC0/ReadyPlayer.me)
  - Nefertiti.glb (1.2MB, 静态雕像, CC0)
  - Duck/Parrot/Stork/Flamingo/Horse.glb (CC-BY/MIT)
- ✅ 总角色：7 → **18**（+11）
- ✅ 总模型大小：20MB → 24MB（+4MB，已 Draco/meshopt 压缩）
- ✅ **M2.2**: 角色中央注册表 `src/entities/CharacterRegistry.js`
  - `CHARACTERS` 字典：18 角色完整元数据（key/url/size/tints/clipMap/tags/use/license/source/notes）
  - `getChar(key)` / `listByUse(tag)` / `listByTag(tag)` / `suggestKey(kws)` 4 个查询 API
  - `exportLoadList()` 扁平化为 `[{key,url}]` 数组给 index.html
  - `pickClip(animations, intent, keywords)` 替换硬编码 `findAnim` 函数
  - `dumpRegistry()` 调试输出
- ✅ index.html 改造
  - 删 `charList` 7 行硬编码 → `...exportCharLoadList()` 自动注入 18 行
  - NPC `createNPC` 替换 `BEH_GLB` 硬编码为 7 行为 v6.11 概率分布
  - `createNPC` 退路用 `listByTag('humanoid')` 随机池（10 角色可选）
  - NPC `findAnim('idle'/'walk'/'run')` 替换为 `pickClip(animations, intent, cm[id])` 走注册表 clipMap
  - `placeG` ambient 区域加 9 个新模型（Flamingo/Stork/Fox/Parrot/Duck/Nefertiti/Horse/RPM/Robot）
- ⏸ **M2.3 完整 blend tree** - 待做（idle/walk/run/jog/crouch/talk，priority high）
- ⏸ **M2.4 morph target** - 待做（facecap 已有 morph，待接）
- ⏸ **M2.5 Avatar 自定义** - 待做
- ⏸ **M2.6 角色 IK** - 待做
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.10.6 — 渲染后端抽象层 + vendor 清理（commit 7 of 7）
- ✅ 新增 `src/core/RendererBackend.js` - 渲染后端抽象层
- ✅ `detectCapabilities()` - 探测 WebGL2 / WebGPU 能力 + 扩展
- ✅ `Backend.WEBGL2 / WEBGPU / UNKNOWN` 三态枚举
- ✅ `createRenderer(opts)` - 统一接口（v6.10.6 返回 WebGLRenderer，v6.11 切换 WebGPU）
- ✅ `recommendPixelRatio()` - 移动端 1.5，PC 端 2
- ✅ index.html 启动时自动探测后端能力
- ✅ 清理 vendor/three/three.min.js（节省 656KB，从 2.1MB → 1.4MB）
- ⏸ **实际切换到 r166 留到 v6.11 专用 sprint**（EffectComposer/OutputPass 在 r160→r166 有 break change）
- ⏸ 实际切换到 WebGPU 留到 v6.11（v6.10.6 仅准备接口）
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.10.5 — 抽离 Collision + Pathfinder（commit 6 of 7）
- ✅ `src/physics/Collision.js` 从占位升级为完整碰撞系统
- ✅ `init(scene)` - 遍历 scene 收集所有碰撞盒（按 userData 过滤地面/玩家/载具）
- ✅ `checkSphere(x, y, z, radius)` - AABB 圆球碰撞检测
- ✅ `getGroundHeight(x, z)` - 查询地形高度（委托给 window.getTerrainH）
- ✅ `resolveSlide(pos, vel, radius)` - 滑动碰撞解算（先 X 后 Z）
- ✅ `src/ai/Pathfinder.js` 从占位升级为寻路接口
- ✅ `findPath(start, end)` - v6.10.5 返回直线插值（10 段），v6.11 接入 recast-navigation-js
- ✅ `addWaypoint()` + `findNearestWaypoint()` - 巡逻点系统
- ✅ loadRealModels 末尾调用 collision.init(scene) 收集碰撞体
- ⏸ mesh-bvh 精确碰撞留到 v6.11（BVHEcctrl）
- ⏸ A* 寻路留到 v6.11（recast-navigation-js）
- 📦 部署：https://github.com/zxc403/xingyuancheng

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
