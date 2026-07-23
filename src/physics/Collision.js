// src/physics/Collision.js
// v6.10.0 占位文件 - 碰撞检测（v6.10.5 实现 mesh-bvh 升级）

export class Collision {
    constructor() {
        this.world = null;  // Rapier world（v6.11 接入）
        console.log('[Collision] 占位构造完成');
    }

    init() {
        // TODO v6.10.5: 暂时沿用 AABB 圆球碰撞
        // TODO v6.11: 升级为 BVHEcctrl mesh-bvh
    }

    checkSphere(pos, radius) {
        // TODO v6.10.5: 简单的圆球 vs 地面 + 建筑
        return true;
    }
}
