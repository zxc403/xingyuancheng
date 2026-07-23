# /create-epics — 把大目标拆成 Epic

把"画质升级"这种模糊目标拆成可执行 Epic：

```
EPIC-1: 玩家第三人称 GLB 身体
  - STORY-1.1: 引入 char_xbot 作为玩家 GLB
  - STORY-1.2: AnimationMixer + walk/run/idle 状态机
  - STORY-1.3: 移动方向同步玩家 yaw

EPIC-2: PBR 展圈可见性
  - STORY-2.1: 把 PBR 模型从远端移到出生点 5m 内
  - STORY-2.2: 调整相机 FOV / 高度确保首帧可见
```

写进 `production/epics.md`。
