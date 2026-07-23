# src/ 模块化拆分

> v6.10.0 起，index.html 不再是单体。源码按职责拆到以下 6 个模块。
> 每个模块的 README 描述该模块的职责、对外接口、内部依赖。

## 模块结构

| 模块 | 职责 | 主要文件 |
|---|---|---|
| `core/` | 引擎核心：渲染器、输入、音频、主循环 | `Renderer.js` `Input.js` `Audio.js` `GameLoop.js` |
| `entities/` | 实体层：玩家、NPC、车辆、道具 | `Player.js` `NPC.js` `Vehicle.js` `Prop.js` |
| `ai/` | AI 系统：感知、决策、寻路、行为树 | `Pathfinder.js` `Perception.js` `UtilityAI.js` |
| `physics/` | 物理系统：碰撞、刚体、车辆动力学 | `Collision.js` `RapierBody.js` `VehicleDynamics.js` |
| `ui/` | UI 层：HUD、菜单、对话框、设置 | `HUD.js` `Menu.js` `Dialogue.js` `Settings.js` |
| `assets/` | 资产管理：模型、贴图、HDRI 加载器 | `Loader.js` `GLTFLoader.js` `HDRI.js` |

## 调用规则

- `core/` 不依赖任何其他模块（最底层）
- `entities/` 依赖 `core/` + `physics/`
- `ai/` 依赖 `core/`（独立可测试）
- `physics/` 依赖 `core/`
- `ui/` 依赖 `core/`（不直接读 entities 内部状态）
- `assets/` 依赖 `core/`（提供统一加载接口）

## 入口

`index.html` 顶部通过 `<script type="module">` 引入 `src/main.js`，
`main.js` 负责 boot 顺序：core → assets → entities → physics → ai → ui → gameLoop。

## 版本演进

- v6.10.0：建立 src/ 骨架
- v6.10.1-6：逐步迁移逻辑
- v6.10.7：完成拆分，index.html 只剩 HTML/CSS + 入口 script
