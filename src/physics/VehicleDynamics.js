// src/physics/VehicleDynamics.js
// v6.10.0 占位文件 - 车辆动力学（v6.11 接入 Rapier）

export class VehicleDynamics {
    constructor(vehicle) {
        this.vehicle = vehicle;
        this.mass = 1500;  // kg
        this.engineForce = 8000;  // N
        this.brakeForce = 12000;  // N
        this.maxSteer = 0.6;  // rad
        console.log(`[VehicleDynamics ${vehicle.id}] 占位构造完成`);
    }

    update(dt) {
        // TODO v6.11: 物理积分（throttle → 牵引力 → 速度 → 位置）
    }
}
