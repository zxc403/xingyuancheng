---
paths:
  - "assets/models/**"
  - "assets/hdri/**"
---

# 资产标准

## 命名
- 全小写（Khronos 约定）：`ferrari.glb` 而非 `Ferrari.glb`
- 类别前缀：`char_` `car_` `pbr_` `scene_` `prop_` `building_`

## 材质染色
Soldier 衣服：`VanguardBodyMat`
Xbot 衣服：`Beta_HighLimbsGeoSG2` / `Beta_HighLimbs`
染色必须 `.clone()` 再写 color

## 比例
- 角色：高 1.7m ± 0.1
- 车辆：长 4-5m
- 建筑：宽 8-30m
- 道具：高 0.5-2m

## HDRI
仅从 polyhaven.com 拉，许可证 CC0。
文件大小：mobile 选 1k 档（<3MB），PC 可选 4k 档（<20MB）。
