// src/ecs/components.js
// 星渊城 ECS 组件定义 — 所有实体通过组合这些组件来描述
// 组件即标签：`entity.transform` / `entity.npc` 等，查询用 `world.with('transform', 'npc')`
//
// 组件分为两类：
//   A. 数据组件 — 存 Three.js 对象或纯数据
//   B. 标签组件 — 纯布尔/字符串，用于查询过滤

// ===== A. 数据组件 =====

/**
 * 创建 Transform 组件（Three.js Object3D）
 * @param {THREE.Object3D} obj - Mesh / Group / InstancedMesh
 * @returns {Object} { transform }
 */
export function Transform(obj) {
    return { transform: obj };
}

/**
 * 创建 Health 组件
 * @param {number} hp - 当前血量
 * @param {number} max - 最大血量
 */
export function Health(hp = 100, max = 100) {
    return { health: { current: hp, max } };
}

/**
 * 创建 Velocity 组件（物理速度）
 */
export function Velocity(vx = 0, vy = 0, vz = 0) {
    return { velocity: { x: vx, y: vy, z: vz } };
}

/**
 * 创建 Animation 组件（AnimationMixer + actions map）
 * @param {THREE.AnimationMixer} mixer
 * @param {Object} actions - { idle, walk, run, ... }
 */
export function Animation(mixer, actions = {}) {
    return { animation: { mixer, actions, current: null } };
}

/**
 * 创建 AI 组件（行为状态）
 * @param {string} state - 'idle' | 'wander' | 'flee' | 'attack' | 'follow'
 * @param {Object} params - 行为参数
 */
export function AI(state = 'idle', params = {}) {
    return { ai: { state, params, timer: 0 } };
}

/**
 * 创建 Inventory 组件
 */
export function Inventory(items = [], money = 0) {
    return { inventory: { items, money } };
}

/**
 * 创建 Physics 组件（碰撞体引用）
 * @param {Object} body - Rapier rigidBody 引用
 */
export function Physics(body = null) {
    return { physics: { body, onGround: true } };
}

/**
 * 创建 InstancedRender 组件（InstancedMesh 批量渲染）
 * @param {THREE.InstancedMesh} imesh
 * @param {number} index
 */
export function InstancedRender(imesh, index) {
    return { instanced: { imesh, index } };
}

// ===== B. 标签组件 =====

/** 玩家标签 */
export const PlayerTag = { player: true };

/** NPC 标签 + 类型 */
export function NPCTag(type = 'civilian', name = '') {
    return { npc: { type, name } };
}

/** 载具标签 */
export function VehicleTag(type = 'car') {
    return { vehicle: { type } };
}

/** 建筑/静态物体标签 */
export function StaticTag(category = 'building') {
    return { static: { category } };
}

/** 可拾取物品标签 */
export function PickupTag(itemType = 'coin') {
    return { pickup: { itemType } };
}

/** 可交互标签 */
export function InteractableTag(label = '') {
    return { interactable: { label } };
}

// ===== 工厂函数：快速创建常用实体 =====

/**
 * 创建玩家实体（初始骨架）
 */
export function createPlayerEntity(scene, mesh) {
    scene.add(mesh);
    return {
        ...Transform(mesh),
        ...PlayerTag,
        ...Health(100, 100),
        ...Velocity(),
        ...Inventory([], 0),
        ...Physics(),
        isPlayer: true,  // 额外快捷标签
    };
}

/**
 * 创建 NPC 实体
 */
export function createNPCEntity(scene, mesh, type, name) {
    scene.add(mesh);
    const entity = {
        ...Transform(mesh),
        ...NPCTag(type, name),
        ...Health(100, 100),
        ...Velocity(),
        ...AI('idle'),
    };
    // 如果有 mixer，附加 Animation 组件
    return entity;
}
