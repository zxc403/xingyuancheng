# 星渊城 / Star Abyss City — GDD (精简版)

## 1. Concept
单机开放世界 demo。玩家在赛博朋克霓虹城市中自由行走、驾驶、交互。
参考：GTA5 城市密度 + 赛博朋克 2077 视觉。

## 2. Pillars
- **画质优先**：PBR + HDRI 反射 + Bloom + SSAO
- **即时好玩**：不需要 30 分钟教程，第一秒能走能看
- **资源密度**：每个视野方向都至少一个有趣物件

## 3. First 30 Seconds
1. 加载 → 中央广场
2. 看到 PBR 展圈（Ferrari + 头盔 + 灯笼 + 牛油果 + 东京小景）
3. 看到至少 3 个 NPC 在走路
4. 看到玩家自己（Xbot 写实角色）
5. 听到城市白噪音 + 远处的引擎声

## 4. Core Loop
- 移动（WASD）→ 触发 NPC 警戒
- 交互（E 键）→ 对话 / 任务
- 驾驶（F 键）→ 交通载具
- 战斗（左键）→ 警察追逐

## 5. World
- 800m × 400m 主城 + 100m 中央广场
- 30+ PBR 资产，10+ 写实角色，5+ 车辆
- 6 张 HDRI 全时段覆盖

## 6. Art Direction
- 暗色霓虹 + 湿润反射路面
- 红色警灯 + 玻璃幕墙
- Kimi 风格 Phillips 海面

## 7. Tech
- Three.js r128 模块版
- 单体 index.html 200KB（v7.0 拆 src/）
- WebGL2 only
