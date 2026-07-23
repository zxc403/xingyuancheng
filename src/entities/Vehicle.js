// src/entities/Vehicle.js
// v6.10.4: 抽离 Vehicle 实体 - 车辆工厂 + 物理占位
//
// 设计思路：v6.10.4 阶段只接管"车辆创建 + driver 切换"。
// 完整的车辆物理（Rapier 动力学）留给 v6.11 物理模块。
//
// 接口：
//   Vehicle.spawn(model, x, z, yaw) - 创建车辆并加入 scene
//   Vehicle.findNearest(pos, maxDist) - 找最近可进入的载具

const THREE = window.THREE;

let vehicleList = [];

// 车辆模型尺寸
const VEHICLE_DIMS = {
    sedan:   { w: 1.8, h: 1.4, l: 4.2, color: 0xcc2233 },
    sports:  { w: 1.9, h: 1.1, l: 4.4, color: 0xffcc00 },
    truck:   { w: 2.2, h: 2.4, l: 6.5, color: 0x444466 },
    police:  { w: 1.8, h: 1.5, l: 4.5, color: 0x2244aa }
};

export class Vehicle {
    constructor(id, model) {
        this.id = id;
        this.model = model || 'sedan';
        this.pos = { x: 0, y: 0, z: 0 };
        this.vel = { x: 0, y: 0, z: 0 };
        this.yaw = 0;
        this.throttle = 0;
        this.brake = 0;
        this.steer = 0;
        this.rpm = 0;
        this.gear = 1;
        this.driver = null;  // Player reference
        this.mesh = null;
        this.health = 100;
        this.maxSpeed = 60;  // m/s
    }

    /**
     * 工厂方法：创建一辆车并加入 scene
     * @param {THREE.Scene} scene
     * @param {string} model - sedan / sports / truck / police
     * @param {number} x
     * @param {number} z
     * @param {number} yaw
     */
    static spawn(scene, model, x, z, yaw) {
        const v = new Vehicle(Math.random().toString(36).slice(2, 8), model);
        v.pos = { x, y: 0, z };
        v.yaw = yaw || 0;

        const dims = VEHICLE_DIMS[model] || VEHICLE_DIMS.sedan;
        const g = new THREE.Group();
        g.position.set(x, dims.h / 2, z);
        g.rotation.y = yaw || 0;

        // 车身（程序几何占位，v6.11 替换为 GLB）
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(dims.w, dims.h * 0.7, dims.l),
            new THREE.MeshStandardMaterial({
                color: dims.color,
                roughness: 0.3,
                metalness: 0.7,
                envMapIntensity: 1.4
            })
        );
        body.position.y = -dims.h * 0.15;
        body.castShadow = true;
        body.receiveShadow = true;
        g.add(body);

        // 车顶
        const top = new THREE.Mesh(
            new THREE.BoxGeometry(dims.w * 0.85, dims.h * 0.45, dims.l * 0.55),
            new THREE.MeshStandardMaterial({
                color: dims.color * 0.7,
                roughness: 0.4,
                metalness: 0.6
            })
        );
        top.position.set(0, dims.h * 0.25, -dims.l * 0.05);
        top.castShadow = true;
        g.add(top);

        // 4 个轮子
        const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
        const wOff = dims.l * 0.35;
        const wSide = dims.w * 0.55;
        const wY = -dims.h * 0.4;
        for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(sx * wSide, wY, sz * wOff);
            wheel.castShadow = true;
            g.add(wheel);
        }

        // 警车加红蓝灯
        if (model === 'police') {
            const lightBar = new THREE.Group();
            const redLight = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 })
            );
            redLight.position.x = -0.25;
            const blueLight = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 2 })
            );
            blueLight.position.x = 0.25;
            lightBar.add(redLight, blueLight);
            lightBar.position.y = dims.h * 0.5;
            g.add(lightBar);
            v.lightBar = lightBar;
        }

        scene.add(g);
        v.mesh = g;
        vehicleList.push(v);
        return v;
    }

    /**
     * 找最近可进入的载具（玩家附近 5m 内）
     */
    static findNearest(pos, maxDist) {
        let nearest = null;
        let nd2 = maxDist * maxDist;
        for (const v of vehicleList) {
            if (v.driver) continue;
            const dx = v.pos.x - pos.x;
            const dz = v.pos.z - pos.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < nd2) {
                nd2 = d2;
                nearest = v;
            }
        }
        return nearest;
    }

    /**
     * 玩家进入 / 离开
     */
    setDriver(player) {
        this.driver = player;
    }

    /**
     * 清空（场景重置时）
     */
    static clear(scene) {
        for (const v of vehicleList) {
            if (v.mesh && scene) scene.remove(v.mesh);
        }
        vehicleList = [];
    }

    static getAll() {
        return vehicleList;
    }
}
