// src/physics/Collision.js
// v6.10.5: 抽离 Collision 模块 - AABB 圆球碰撞 + 地面高度查询
//
// 设计思路：v6.10.5 阶段保持 AABB 圆球碰撞（与老代码完全一致）。
// 完整的 mesh-bvh 升级留给 v6.11（BVHEcctrl）。
//
// 接口：
//   collision.init(scene)                    - 收集所有需要参与碰撞的对象
//   collision.checkSphere(x, y, z, radius)  - 检测圆球是否与建筑/地面碰撞
//   collision.getGroundHeight(x, z)         - 查询地面高度（含地形起伏）
//   collision.resolveSlide(pos, vel, radius) - 滑动碰撞解算（沿墙滑）

const THREE = window.THREE;

export class Collision {
    constructor() {
        // 场景中的所有"不可穿越"对象（建筑、车辆、栏杆）
        this.staticBoxes = [];   // {minX, maxX, minZ, maxZ, minY, maxY, obj}
        // 玩家当前位置（每帧更新）
        this._playerPos = { x: 0, y: 0, z: 0 };
    }

    /**
     * 收集场景中的所有碰撞体
     * 简化版：只取 Box3 包围盒，不做 mesh-bvh 精确碰撞
     */
    init(scene) {
        if (!scene) return;
        this.staticBoxes = [];
        scene.traverse((obj) => {
            // 跳过地面、天空、玩家自己
            if (obj === scene) return;
            if (obj.userData && obj.userData.isPlayer) return;
            if (obj.userData && obj.userData.isGround) return;
            if (obj.userData && obj.userData.isNoCollision) return;
            if (obj.userData && obj.userData.isVehicle) return;  // 车辆单独处理
            // 跳过透明 / 触发器
            if (obj.userData && obj.userData.isTrigger) return;

            // 只对有 Box3 的物体记录
            if (obj.isMesh || obj.isGroup) {
                const box = new THREE.Box3().setFromObject(obj);
                if (box.isEmpty()) return;
                const size = new THREE.Vector3();
                box.getSize(size);
                // 过滤太大或太小的对象
                if (size.x < 0.3 || size.z < 0.3) return;
                if (size.x > 200 || size.z > 200) return;
                // 过滤地面（y 范围小 + 朝上）
                if (size.y < 0.5) return;
                this.staticBoxes.push({
                    minX: box.min.x, maxX: box.max.x,
                    minY: box.min.y, maxY: box.max.y,
                    minZ: box.min.z, maxZ: box.max.z,
                    obj
                });
            }
        });
        console.log(`[Collision] init 收集到 ${this.staticBoxes.length} 个碰撞盒`);
    }

    /**
     * 圆球碰撞检测
     * @returns {boolean} true=可以站在这里，false=有阻挡
     */
    checkSphere(x, y, z, radius) {
        for (const b of this.staticBoxes) {
            if (x + radius < b.minX || x - radius > b.maxX) continue;
            if (z + radius < b.minZ || z - radius > b.maxZ) continue;
            if (y + radius < b.minY || y - radius > b.maxY) continue;
            return false;  // 撞到
        }
        return true;
    }

    /**
     * 查询地面高度（含 getTerrainH 程序化地形）
     * 如果 scene 里有 getTerrainH 函数就用，否则返回 0
     */
    getGroundHeight(x, z) {
        if (typeof window.getTerrainH === 'function') {
            return window.getTerrainH(x, z);
        }
        return 0;
    }

    /**
     * 滑动碰撞解算（沿墙滑）
     * 调用方式：每帧 updatePlayer 时调用一次
     * @param {Object} pos - {x, y, z}
     * @param {Object} vel - {x, y, z}
     * @param {number} radius
     * @returns {boolean} true=有碰撞
     */
    resolveSlide(pos, vel, radius) {
        let hit = false;
        // 简化：先 X 轴方向，再 Z 轴方向
        // X
        const nx = pos.x + vel.x;
        if (!this.checkSphere(nx, pos.y, pos.z, radius)) {
            vel.x = 0;
            hit = true;
        } else {
            pos.x = nx;
        }
        // Z
        const nz = pos.z + vel.z;
        if (!this.checkSphere(pos.x, pos.y, nz, radius)) {
            vel.z = 0;
            hit = true;
        } else {
            pos.z = nz;
        }
        return hit;
    }

    /**
     * 更新玩家位置引用（debug 用）
     */
    setPlayerPos(x, y, z) {
        this._playerPos = { x, y, z };
    }
}
