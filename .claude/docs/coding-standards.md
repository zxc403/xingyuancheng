# 编码标准

## 通用
- ESM 优先，全局 `import * as THREE from 'three'`
- 不在 hot path new Object
- 命名：camelCase 变量，PascalCase 类，UPPER_SNAKE 常量

## Three.js 专属
- 共享材质必须 `material.clone()` 再改
- 共享几何一般 OK，但加 morph / skinning 时要 clone
- `AnimationMixer.update(dt)` 每帧调用，dt 来自 `clock.getDelta()`
- 状态切换走 `fadeIn/fadeOut(0.2)`，避免 `stop()` 后 `play()` 闪一下

## 性能
- PixelRatio 上限：PC 2 / 移动 1.5
- ShadowMap：PC 4096 / 移动 2048
- DrawCall 控制在 200 以内
- 用 `InstancedMesh` 处理 >20 个相同模型
