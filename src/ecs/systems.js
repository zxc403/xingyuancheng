// src/ecs/systems.js
// 星渊城 ECS 系统定义 — 每个系统是一个 (world, dt) => void 函数
// 系统按固定顺序执行：transform → animation → ai → physics → instanced_render
//
// 设计原则：
//   1. 系统只读写组件，不持有状态（无副作用）
//   2. 系统通过 world.with() 获取感兴趣的实体
//   3. 惰性查询复用：同一查询只创建一次，缓存在 world 内部

/**
 * TransformSystem — 将 velocity 应用到 position
 * 查询：所有同时有 transform + velocity 的实体
 */
export function createTransformSystem(world) {
    const entities = world.with('transform', 'velocity');

    return function transformSystem(dt) {
        for (const e of entities) {
            const t = e.transform;
            const v = e.velocity;
            t.position.x += v.x * dt;
            t.position.y += v.y * dt;
            t.position.z += v.z * dt;
        }
    };
}

/**
 * AnimationSystem — 更新所有 AnimationMixer
 * 查询：所有有 animation 组件的实体
 */
export function createAnimationSystem(world) {
    const entities = world.with('animation');

    return function animationSystem(dt) {
        for (const e of entities) {
            e.animation.mixer.update(dt);
        }
    };
}

/**
 * AISystem — 驱动 NPC 行为状态机
 * 查询：有 transform + ai 的实体
 *
 * 简易行为：
 *   idle   → 随机转 wander（概率 0.01/s）
 *   wander → 随机移动 + 定时回 idle
 *   flee   → 远离威胁方向
 */
export function createAISystem(world) {
    const entities = world.with('transform', 'ai');

    return function aiSystem(dt) {
        for (const e of entities) {
            const ai = e.ai;
            ai.timer += dt;
            const t = e.transform;

            switch (ai.state) {
                case 'idle': {
                    // 随机切换为 wander
                    if (Math.random() < 0.005 * dt) {
                        ai.state = 'wander';
                        ai.params = {
                            targetX: t.position.x + (Math.random() - 0.5) * 20,
                            targetZ: t.position.z + (Math.random() - 0.5) * 20,
                            duration: 3 + Math.random() * 5
                        };
                        ai.timer = 0;
                    }
                    break;
                }

                case 'wander': {
                    const { targetX, targetZ, duration } = ai.params;
                    const dx = targetX - t.position.x;
                    const dz = targetZ - t.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    const speed = 1.5;

                    if (dist > 0.1 && ai.timer < duration) {
                        const vx = (dx / dist) * speed;
                        const vz = (dz / dist) * speed;
                        if (e.velocity) {
                            e.velocity.x = vx;
                            e.velocity.z = vz;
                        }
                        // 朝向目标
                        t.rotation.y = Math.atan2(vx, vz);
                    } else {
                        if (e.velocity) {
                            e.velocity.x = 0;
                            e.velocity.z = 0;
                        }
                        ai.state = 'idle';
                        ai.timer = 0;
                    }
                    break;
                }

                case 'flee': {
                    // 简易逃离：反方向加速
                    if (e.velocity) {
                        e.velocity.x *= 1.5;
                        e.velocity.z *= 1.5;
                    }
                    if (ai.timer > 3) {
                        ai.state = 'idle';
                        ai.timer = 0;
                    }
                    break;
                }

                default:
                    break;
            }
        }
    };
}

/**
 * InstancedRenderSystem — 批量更新 InstancedMesh 的矩阵
 * 查询：有 transform + instanced 的实体
 */
export function createInstancedRenderSystem(world) {
    const entities = world.with('transform', 'instanced');

    const counts = new Map(); // imesh → count

    return function instancedRenderSystem(_dt) {
        counts.clear();

        for (const e of entities) {
            const { imesh, index } = e.instanced;
            imesh.setMatrixAt(index, e.transform.matrix);

            const count = (counts.get(imesh) || 0);
            counts.set(imesh, Math.max(count, index + 1));
        }

        for (const [imesh, count] of counts) {
            imesh.count = count;
            imesh.instanceMatrix.needsUpdate = true;
        }
    };
}

/**
 * SceneAttachmentSystem — 将 transform 挂到 scene（add 时）和从 scene 摘除（remove 时）
 * 查询：world 的增删事件
 *
 * 参数 scene 是 THREE.Scene 引用
 */
export function createSceneAttachmentSystem(world, scene) {
    world.onEntityAdded.subscribe(entity => {
        if (entity.transform && entity.transform.isObject3D) {
            // 如果还没有 parent（没被其他实体持有），挂到 scene
            if (!entity.transform.parent) {
                scene.add(entity.transform);
            }
        }
    });

    world.onEntityRemoved.subscribe(entity => {
        if (entity.transform && entity.transform.isObject3D) {
            entity.transform.parent?.remove(entity.transform);
        }
    });

    return function sceneAttachmentSystem(_dt) {
        // 空运行，实际工作在事件回调中
    };
}

// ============ 系统管线工厂 ============

/**
 * 创建默认系统管线（按正确顺序执行）
 * @param {World} world
 * @param {THREE.Scene} scene
 * @returns {Array<Function>} systems — 每个是 (dt) => void
 */
export function createDefaultPipeline(world, scene) {
    return [
        createTransformSystem(world),
        createAISystem(world),
        createAnimationSystem(world),
        createInstancedRenderSystem(world),
        createSceneAttachmentSystem(world, scene),
    ];
}
