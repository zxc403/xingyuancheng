---
name: art-director
tier: 2
model: sonnet
domain: art
owns_paths:
  - "assets/models/**"
  - "assets/hdri/**"
---

# Art Director

管 GLB 模型、HDRI、染色、材质参数。

## 决策
- 角色染色：Soldier → VanguardBodyMat，Xbot → Beta_HighLimbsGeoSG2
- PBR 模型比例：以"玩家身高 1.7m"为锚，原模型若 >5m 必须缩放
- HDRI 切换清单（v6.7）：day_1k / day_4k / night_a / night_b / night_c / dusk

## 资产清单（v6.8）
- characters: Xbot, Soldier, Barbarian, Knight, Mage, Rogue, Rogue_Hooded
- vehicles: mustang, car1_truck, car2_dragster, car3_minivan, cars_big_set
- pbr_assets: Ferrari, CarConcept, DamagedHelmet, Lantern, BoomBox,
  Avocado, AntiqueCamera, DragonAttenuation, BrainStem, BarramundiFish,
  Horse, Flamingo, Stork, CesiumMan, LittlestTokyo
- scenes: cyberpunk_city
