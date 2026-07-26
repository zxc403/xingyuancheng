---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 6dde0dd6de3c4d5151e4449ee1918f2a_712bb37a88f611f18108525400287e28
    ReservedCode1: GCWZ1Q9Pq+FfXhl1UUZTOdeeZXEGZPYJaVQGIXuPGeBamuOqGxI8sS4mj14FtYZd8QHFaewz28Q4dzQf5GUTlVCjBU0K48ml1LLctgNy+Mp5bMB4m9Tzlo28P7InX3WtVvBln+BY8pCwS1aPffeKlJm7gnkpFlplZa0iCD5ZJLKNaufsdUsYnWlbqp0=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 6dde0dd6de3c4d5151e4449ee1918f2a_712bb37a88f611f18108525400287e28
    ReservedCode2: GCWZ1Q9Pq+FfXhl1UUZTOdeeZXEGZPYJaVQGIXuPGeBamuOqGxI8sS4mj14FtYZd8QHFaewz28Q4dzQf5GUTlVCjBU0K48ml1LLctgNy+Mp5bMB4m9Tzlo28P7InX3WtVvBln+BY8pCwS1aPffeKlJm7gnkpFlplZa0iCD5ZJLKNaufsdUsYnWlbqp0=
---



# 星渊城 ECS 渐进迁移指南

## 已产出文件

```
src/ecs/
  miniplex.js    — ECS 核心（Bucket / World / Query），零依赖，6KB
  components.js  — 组件工厂函数（Transform / Health / AI 等）
  systems.js     — 系统管线（transform / animation / ai / instanced / scene）
  index.js       — 统一入口
```

## 三阶段迁移路线

### 阶段 1：接入 ECS 外壳（0 破坏性变更）

将现有实体**注册**到 World，但不修改它们内部的 OOP 逻辑：

```js
import { World } from './ecs/index.js';
const world = new World();

// 现有 Player 实例通过 Transform 组件挂入 ECS
world.add({ transform: player.mesh, player: true });

// 现有 NPC 数组同样挂入
npcs.forEach(npc => {
  world.add({ transform: npc.mesh, npc: { type: npc.type, name: npc.name } });
});

// 查询 NPC（替代 npcs.forEach）
for (const e of world.with('transform', 'npc')) {
  // 操作 e.transform（即 npc.mesh）
}
```

**收益**：立即获得统一查询能力，无需再维护多个 `npcs` / `vehicles` / `items` 数组。

### 阶段 2：逐步引入系统（1-2 个会话）

选择低风险系统先启用：

1. **SceneAttachmentSystem** — 自动管理场景图挂载（零改动）
2. **AnimationSystem** — 统一 mixer.update()（替换分散的 update 调用）
3. **AISystem** — 先用于平民 NPC（让现有 NPC 类继续处理警察/帮派）

```js
import { createAnimationSystem, createAISystem } from './ecs/systems.js';

const animSystem = createAnimationSystem(world);
const aiSystem = createAISystem(world);

function gameLoop(dt) {
  animSystem(dt);
  aiSystem(dt);
  // ... 其余逻辑不变
}
```

### 阶段 3：完全 ECS 化（未来）

- AI 全部由 AISystem 驱动，NPC 类退化为纯数据工厂
- 物理碰撞检测改用 CollisionSystem（查询 `with('transform', 'physics')`）
- 角色注册表与 ECS 打通：`CharacterRegistry` → `world.add(createNPCEntity(...))`

## 关键 API 速查

```js
// 查询
world.with('transform', 'health')          // 有 transform 且有 health
world.without('destroyed')                 // 没有 destroyed 标签
world.with('transform', 'npc').where(e => e.health.current < 50)  // 残血 NPC

// 增删
world.add(entity);                         // 注册实体
world.remove(entity);                      // 注销（自动清理查询索引）
world.changed(entity);                     // 通知组件变更（手动 reindex）

// 事件
world.onEntityAdded.subscribe(e => {});    // 实体加入时
world.onEntityRemoved.subscribe(e => {});  // 实体移除时

// 批量操作
for (const e of world.with('pickup')) {
  world.remove(e);  // 拾取后清理
}
```

## 与现有代码共存

ECS 不替代现有类，只是新增一层：

```
现有：Player { mesh, health, ... }     →  world.add({ transform: player.mesh, player: true })
     NPC { mesh, type, name, ... }     →  world.add({ transform: npc.mesh, npc: { type, name } })
     Vehicle { mesh, ... }             →  world.add({ transform: vehicle.mesh, vehicle: true })
```

优点：现有 `Player.update()` / `NPC.spawn()` 继续工作，ECS 只在需要时介入查询和批量调度。
*（内容由AI生成，仅供参考）*
*（内容由AI生成，仅供参考）*
