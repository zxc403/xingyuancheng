# Changelog

## v6.9 — 玩家 GLB 身体 + PBR 拉近 + CCGS 工作室化
- ✅ 玩家从无身体 → char_xbot GLB + AnimationMixer（idle/walk/run 状态机）
- ✅ 玩家跟随 `player.pos` + `player.yaw`，载具内自动隐藏
- ✅ PBR 展圈从远处搬到玩家出生点 4-7m（Ferrari + 头盔 + 灯笼 + 音响 + 牛油果 紧贴）
- ✅ 玩家初始 pitch 从 -0.15 抬到 -0.05（确保 PBR 进视野）
- ✅ PBR 模型 envMapIntensity 1.2 → 1.6（反射更亮）
- ✅ 新增 `.claude/` CCGS 风格骨架（6 agents / 7 skills / 6 hooks / 3 rules / 4 templates / 4 docs）
- ✅ 新增 `production/active.md` + `production/changelog.md` + `design/GDD.md`
- 📦 部署：https://github.com/zxc403/xingyuancheng

## v6.8 — PBR Showcase + Phillips 海面
- 14 个 PBR 模型导入（Ferrari / Helmet / Dragon / Tokyo 等）
- Kimi 风格 Phillips 频谱水面（8 段波形 + Fresnel + 泡沫）

## v6.7 — 昼夜 HDRI
- 6 张 HDRI（day_1k / day_4k / 3 夜 / 黄昏）

## v6.6 — 写实角色染色
- char_xbot / char_soldier 接入
- 材质名精确染色

## v6.5 — 移动端降级
- 纹理集 4 套，ShadowMap 2048，PixelRatio 1.5

## v6.1 — 真实 GLB 加载
- 14 + 30 个 PBR / 道具 GLB 加载
