// src/ai/Pathfinder.js
// v6.10.5: 抽离 Pathfinder 模块 - A* 寻路占位
//
// v6.10.5 阶段只暴露接口，不实现真实寻路。
// NPC 当前的"寻路"是简单的随机游走（直接写在 index.html updateNPCs 里）。
// 完整的 A* 寻路 + NavMesh 留给 v6.11。
//
// 接口：
//   pathfinder.findPath(start, end)  - 返回路径点数组 [Vec3, Vec3, ...]
//   pathfinder.buildNavMesh(scene)   - 从场景构建 NavMesh

const THREE = window.THREE;

export class Pathfinder {
    constructor() {
        this.navMesh = null;       // v6.11 接入 recast-navigation-js
        this.grid = null;          // 简化网格（v6.10.5 阶段不做）
        this.waypoints = [];       // 占位：固定 4 个巡逻点
        console.log('[Pathfinder] 构造完成（v6.10.5 仅占位）');
    }

    /**
     * 构建 NavMesh（v6.11 接入 recast-navigation-js）
     * v6.10.5 阶段返回 false
     */
    buildNavMesh(scene) {
        console.warn('[Pathfinder] buildNavMesh 在 v6.10.5 阶段未实现，v6.11 接入 recast-navigation-js');
        return false;
    }

    /**
     * A* 寻路
     * v6.10.5 阶段返回直线（10 段插值）
     * @param {Object} start - {x, y, z}
     * @param {Object} end   - {x, y, z}
     * @returns {Array<{x,y,z}>} 路径点数组
     */
    findPath(start, end) {
        // 简化直线
        const N = 10;
        const out = [];
        for (let i = 0; i <= N; i++) {
            const t = i / N;
            out.push({
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
                z: start.z + (end.z - start.z) * t
            });
        }
        return out;
    }

    /**
     * 注册巡逻点（v6.10.5 占位）
     */
    addWaypoint(x, y, z) {
        this.waypoints.push({ x, y, z });
    }

    /**
     * 找最近巡逻点
     */
    findNearestWaypoint(pos) {
        if (!this.waypoints.length) return null;
        let nearest = this.waypoints[0];
        let nd2 = Infinity;
        for (const w of this.waypoints) {
            const dx = w.x - pos.x;
            const dz = w.z - pos.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < nd2) { nd2 = d2; nearest = w; }
        }
        return nearest;
    }
}
