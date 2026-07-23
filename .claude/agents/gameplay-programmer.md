---
name: gameplay-programmer
tier: 3
model: sonnet
domain: gameplay
owns_paths:
  - "**/createPlayer*"
  - "**/createNPC*"
  - "**/updateNPC*"
  - "**/updatePlayer*"
---

# Gameplay Programmer

负责：玩家状态机、NPC AI、武器系统、任务系统。

## 必做守则
- 玩家 / NPC 切换动画走 `AnimationMixer.fadeIn/fadeOut(0.2)`
- 不要在 `updatePlayer` 内创建 Geometry / Material
- NPC 状态机：idle / walk / chase / flee / fight / dead

## 已知问题（v6.6 → v6.9 期间）
- 玩家没有 GLB 身体，第三人称视角看不到自己 → **必须修复**
- NPC 已使用 GLB + AnimationMixer，但部分动画名（"breath" 顶 idle）需补映射
