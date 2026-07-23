# 星渊城 / Star Abyss — Claude Studio Architecture

> 本仓库遵循 **Claude Code Game Studios (CCGS)** 的工作室骨架：
> Directors → Department Leads → Specialists，路径化规则 + 钩子守门。
> 原文：[Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)

## 技术栈

- **运行时**：纯静态 `index.html`（Three.js r128+ 模块版）
- **引擎**：Three.js + EffectComposer（Bloom / SMAA / SSAO）
- **资产**：Khronos glTF-Sample-Models（GLB）+ Poly Haven HDRI
- **部署**：GitHub Pages（main 分支根目录）
- **AI 协作**：Claude Code（TRAE 远程沙箱）

> **CCGS 类比**：把整个星渊城视作一部单机开放世界 GTA 风格 demo，
> 我们对应 Unreal/Unity/Godot 的 **Unreal 5 + Blueprint + UMG** 档位。
> 但我们不引入引擎二进制，只用 Three.js 直接编译到 WebGL2。

## 项目结构

```
.claude/
  settings.json          # 钩子 + 权限
  agents/                # 工作室角色（CCGS 风格：3 级分层）
  skills/                # 斜杠命令（CCGS 风格 73 个精简到本项目必要的子集）
  hooks/                 # 自动守门脚本
  rules/                 # 路径化编码标准
  docs/                  # 工作流文档
  templates/             # 设计/技术文档模板
assets/
  models/{characters,vehicles,buildings,props,pbr_assets,scenes}/
  hdri/                  # 6 张 Poly Haven 环境贴图
vendor/three/            # Three.js + addons
design/                  # GDD / 玩法设计（CCGS 风格）
production/              # Sprint / Milestone / Hotfix 跟踪
src/                     # （预留）模块化拆分后的源码
index.html               # 单体入口（4046 行）
README.md
```

## 协作协议（CCGS 风格）

1. **Question → Options → Decision → Draft → Approval**
2. 多文件改动必须先列变更计划
3. 不擅自 `git commit` / `git push`，由用户决定
4. 移动端走降级路径：纹理集 4 套、ShadowMap 2048、PixelRatio 上限 1.5

## 编码标准

- `index.html` 仍为单体时，所有 `// v6.x:` 注释必须标版本号
- 资源路径用 `assets/...` 相对路径，不写绝对 URL
- 任何 `glbKey` 染色逻辑必须 `c.material = c.material.clone()` 再写
- AnimationMixer 跨状态切换走 `fadeIn/fadeOut(0.2)`，不要 `stop()` 后再 `play()`

## 上下文恢复

跨会话靠 `.claude/active.md`（见 hooks/post-compact.sh）。
每个新会话第一步：读 `CLAUDE.md` + `production/active.md`。
