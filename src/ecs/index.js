// src/ecs/index.js
// 星渊城 ECS 统一入口 — 导出 World + 组件工厂 + 系统管线
// 
// 集成方式（3 行接入）：
//   import { createWorld, createDefaultPipeline } from './ecs/index.js';
//   const world = createWorld();
//   const systems = createDefaultPipeline(world, scene);
//   // 在 gameLoop 中：systems.forEach(s => s(dt));

export { World, Bucket } from './miniplex.js';
export {
    // 数据组件
    Transform, Health, Velocity, Animation, AI, Inventory, Physics, InstancedRender,
    // 标签组件
    PlayerTag, NPCTag, VehicleTag, StaticTag, PickupTag, InteractableTag,
    // 工厂
    createPlayerEntity, createNPCEntity,
} from './components.js';
export {
    createTransformSystem,
    createAnimationSystem,
    createAISystem,
    createInstancedRenderSystem,
    createSceneAttachmentSystem,
    createDefaultPipeline,
} from './systems.js';

/**
 * 快捷创建 World 并注入默认基础设施
 */
export function createWorld() {
    return new World();
}
