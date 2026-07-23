# Inspiration Library · 灵感库（GitHub 资源清单）

> 整理从 GitHub 找的对 星渊城 有参考价值的开源项目。
> 来源：v6.9.1 调研（CCGS 同类项目 + Three.js / R3F 游戏项目）。
> 每次新增项目请注明 stars / license / 我们能学的点。

---

## 🎮 角色控制器（Character Controller）

| 项目 | URL | Stars | 亮点 | 可学点 |
|---|---|---|---|---|
| **BVHEcctrl** (pmndrs) | github.com/pmndrs/BVHEcctrl | 1.5k+ | 轻量即插即用 R3F 角色控制器，无需物理引擎 | 用 `three-mesh-bvh` 做三角形精确碰撞，**比圆球碰撞准 100x** |
| **ecctrl** (pmndrs) | github.com/pmndrs/ecctrl | 800+ | 弹簧-阻尼浮力，跨小障碍物，物理移动平台 | 弹簧+阻尼公式（spring-damper）让移动有手感 |
| **r3f-character-controls** | github.com/thomas-rooty/r3f-character-controls | 200+ | R3F 角色移动 boilerplate + cannon 物理 | 加速度/减速度缓动，避免瞬移 |
| **vibe-starter-3d-ctrl** | npmjs.com/package/vibe-starter-3d-ctrl | 100+ | 物理版控制器 ready to use | rapier 物理体作为 character collider |

**对 星渊城 的建议：**
- 短期：保持当前圆球碰撞（已够用），加一个"碰撞可视化"调试模式
- 中期：参考 ecctrl 引入弹簧-阻尼，让玩家起步/停止更顺滑（避免当前"瞬移"感）
- 长期：考虑换 BVHEcctrl 的 mesh-bvh 碰撞，让玩家能贴着墙角走

---

## 🏙️ 程序生成城市 / 开放世界

| 项目 | URL | 亮点 | 可学点 |
|---|---|---|---|
| **Three.js-City** (mauriciopoppe) | github.com/mauriciopoppe/Three.js-City | 驾驶汽车穿梭程序生成城市 | 动态天气 + 驾驶模式 + 运动检测 |
| **SynthCity** | discourse.threejs.org/t/synthcity | 无限程序生成赛博朋克城 | "Zen Out" 自动驾驶模式 + 合成波音乐 |
| **HekTek City v4** (Hector) | hectortechno.com | React Three Fiber 自适应 Portfolio 城市 | Cloudflare R2 资产托管，全栈示例 |
| **3DCity Traffic Sim** (lo-th) | github.com/lo-th/root | 交通仿真（信号灯、车流、雷达） | 城市路网 + AI 交通 |
| **CubeCity** | windflash.mymagic.page | 2.5D LEGO 风格城市 | 卡通渲染 + 拼装式玩法 |
| **Notblox** | notblox.online / appodeal | Three.js + TypeScript + Rapier.js 多人游戏 | **Entity Component System (ECS)** + 客户端预测 |

**对 星渊城 的建议：**
- ✅ 已经在用 6 个 `regions` 集群 + 程序化建筑生成
- 🆕 可加：路网（road graph），NPC 沿路点巡逻（参考 3DCity Traffic Sim）
- 🆕 可加：昼夜循环的"霓虹市"模式（参考 SynthCity）
- 🆕 长期：参考 Notblox 引入 ECS，让 100+ NPC/车流畅运行

---

## 🎨 角色 & 动画

| 项目 | URL | 亮点 | 可学点 |
|---|---|---|---|
| **Mixamo** | mixamo.com | Adobe 免费 GLB 角色 + 200+ 动画 | **已用** Xbot/Soldier |
| **Ready Player Me** | readyplayer.me | 一张照片生成 3D 角色 Avatar | 可作玩家自定义系统 |
| **Khronos glTF-Sample-Models** | github.com/KhronosGroup/glTF-Sample-Models | 官方 PBR 模型仓库 | **已用** 14 个 PBR 模型 |
| **Conv-AI/ThreeJs-World-Tutorial** | github.com/Conv-AI/ThreeJs-World-Tutorial | R3F + Convai NPC 对话 | 真实 AI NPC（DeepSeek 替代品）|

---

## 🛠️ 引擎 / 框架

| 项目 | URL | 亮点 | 可学点 |
|---|---|---|---|
| **Three.js** | threejs.org | 核心渲染库 | **已用 r128 module** |
| **Babylon.js 9.0** | github.com/BabylonJS/Babylon.js | 一体化 3D 引擎 + 物理 + 音频 + XR | 长期可考虑迁移 |
| **react-three-fiber** | github.com/pmndrs/react-three-fiber | Three.js 的 React 包装 | 长期重构时考虑 |
| **Rapier.js** | rapier.rs | WASM 物理引擎 | 适合加车辆物理 |
| **three-mesh-bvh** | github.com/gkjohnson/three-mesh-bvh | 三角形精确碰撞 / raycast | 比我们当前的圆球碰撞精确 100x |
| **three-game-engine** | discourse.threejs.org/t/three-game-engine | 完整 Three.js 游戏引擎 + 场景编辑器 | 灵感：场景编辑器 |
| **tweakpane** | github.com/cocopon/tweakpane | GUI 调试面板 | 加 debug mode 必备 |

---

## 🤖 AI 协作 / 工作室化（CCGS 同类）

| 项目 | URL | 亮点 | 可学点 |
|---|---|---|---|
| **Claude Code Game Studios** (Donchitos) | github.com/Donchitos/Claude-Code-Game-Studios | 49 agents / 73 skills / 12 hooks / 11 rules | **已学，已落地 6 agents / 7 skills / 6 hooks** |
| **game-mcp** | npmjs.com/package/game-mcp | 编排 lead → engineer → qa 三段式 | 5-check QA gate 思路 |
| **Godogen** | github.com/htdt/godogen | AI 生成 Godot 4 项目，1M-token 单会话 | 闭环：生成→截图→修复 |
| **Adastrea Director** | wiki/Mittenzx/Adastrea-Director | 自主 agent 监控性能/质量 | 监控 + 仪表盘 |
| **SparkLabs** | skillget.dev | 多 agent 编排 + 层级记忆 | "observe-think-act" 循环 |

**对 星渊城 的建议：**
- ✅ 已创建 `.claude/` 6 agents + 7 skills + 6 hooks + 3 rules
- 🆕 可加 `.claude/agents/qa-tester.md` 的 5-check 自动验证（build/load/console/perf/asset）
- 🆕 长期：加 `.claude/agents/auto-fixer.md`，能根据 console error 自动改代码

---

## 📚 Awesome 列表

| 项目 | URL | 用途 |
|---|---|---|
| **awesome-threejs** (AxiomeCG) | github.com/AxiomeCG/awesome-threejs | 3D 资源精选 |
| **awesome-react-three-fiber** (gsimone) | github.com/gsimone/awesome-react-three-fiber | R3F 资源精选 |
| **awesome-babylonjs** (Symbitic) | github.com/Symbitic/awesome-babylonjs | Babylon 资源精选 |
| **gamearians/games** | gamearians.github.io/games | 纯 JS 游戏合集 |
| **awesome-webxr-development** | github.com/Pico-Developer/awesome-webxr-development | WebXR 资源 |

---

## 🎯 优先级排序（v7.0 路线图）

| 优先级 | 任务 | 灵感来源 | 预计工作量 |
|---|---|---|---|
| P0 | 玩家移动 bug 修复 | 当前 bug | 0.5h |
| P0 | 玩家 GLB 身体跟随 | 已实现 v6.9 | 完成 |
| P1 | 物理-阻尼平滑移动 | ecctrl | 2h |
| P1 | mesh-bvh 精确碰撞 | BVHEcctrl | 3h |
| P1 | NPC 沿路点巡逻 | 3DCity Traffic | 4h |
| P2 | Rapier.js 车辆物理 | Notblox | 8h |
| P2 | 昼夜霓虹市模式 | SynthCity | 6h |
| P3 | 玩家 Avatar 自定义 | Ready Player Me | 16h |
| P3 | 多人联机 | Notblox | 40h+ |

---

## 🔍 搜索关键词（下次找资源用）

- `three.js game template open world sandbox` — 开放世界
- `BVH character controller react-three-fiber` — 角色碰撞
- `procedural city generation threejs` — 程序生成城市
- `web game studio template Claude` — AI 协作
- `PBR HDRI envmap realtime` — 画质
- `WebGL mobile performance optimization` — 移动端性能
- `NPC AI behavior tree pathfinding` — NPC 智能
