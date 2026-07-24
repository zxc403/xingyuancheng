# 资产流水线协作规范（WorkBuddy × Trae）

> 本仓库由 **WorkBuddy** 和 **Trae** 两个 AI 助手并行下载、整理、推送免费 3D 资产。
> 目标项目：星渊城（Three.js 开放世界，半年期；后续可能迁移 Unity）。
> 本文件用于约束两个 worker 的行为，避免互相覆盖、命名冲突、许可混乱。

## 1. 目录约定（互不踩坑的根本）

所有第三方资产按 `来源/包名` 二级目录存放：

```
assets/models/<source>/<pack>/
```

- 已用：`kenney/cars`、`kenney/commercial`、`kenney/suburban`、`kenney/roads`、`kenney/industrial`、`kenney/pedestrians`、`flo-bit/nature`
- **新来源必须先在此登记**；不要直接往根目录或他人目录下塞文件。
- 每个 worker 认领一个 `source` 前缀，互不修改对方的目录（除非双方确认）。

| Worker | 认领前缀示例 | 备注 |
|---|---|---|
| WorkBuddy | `kenney/`、`flo-bit/` | CC0 城市/自然资产 |
| Trae | 自行登记新来源 | 例如 `synty/`、`quaternius/` 等 |

## 2. 提交约定

- **提交前必须先同步**：`git pull --rebase origin main`，解决冲突后再 push。
- **禁止 force push**（`git push --force` 一律不允许）。
- commit message 前缀标明来源，便于追溯：
  - WorkBuddy：`[WB] 描述`
  - Trae：`[TRAE] 描述`
- 示例：`[WB] 新增 Kenney 工业区建筑 + 方块行人`

## 3. 许可与来源记录

- **只允许 CC0 / CC-BY / MIT** 等可商用、可再分发的授权。
- 每引入一个新来源，必须在 `assets/ATTRIBUTION.md` 追加一条记录（来源链接 + 许可 + 所含内容）。
- CC-BY 资产需保留原作者署名；CC0 无需署名但建议记录出处。

## 4. 体积与性能红线

- 单个文件 **< 50MB**；超过则启用 Git LFS 或拆块。
- 优先 `.glb`（Three.js / Unity 均原生支持）；`.gltf`、`.fbx`、`.obj` 需确认工具链支持。
- 风格统一：当前为**低多边形占位资产**，最终写实资产（付费）将单独来源管理，不混用。

## 5. 当前资产台账（截至本文件创建）

| 来源 | 目录 | 数量 | 授权 |
|---|---|---:|---|
| Kenney car-kit | `assets/models/kenney/cars/` | 50 | CC0 |
| Kenney city-kit-commercial | `assets/models/kenney/commercial/` | 41 | CC0 |
| Kenney city-kit-suburban | `assets/models/kenney/suburban/` | 40 | CC0 |
| Kenney city-kit-roads | `assets/models/kenney/roads/` | 72 | CC0 |
| Kenney city-kit-industrial | `assets/models/kenney/industrial/` | 25 | CC0 |
| Kenney blocky-characters | `assets/models/kenney/pedestrians/` | 18 | CC0 |
| flo-bit nature-pack | `assets/models/flo-bit/nature/` | 62 | CC0 |

## 6. 路线图

- 短期：补齐 GTA 风格场景积木（载具、建筑、道路、行人、自然）。
- 中期：引入写实 PBR 资产（需预算，单独来源），做垂直切片街区。
- 长期：评估迁移 Unity，CC0 占位资产可继续在 Unity 中复用。
