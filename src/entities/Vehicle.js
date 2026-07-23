// src/entities/Vehicle.js
// v6.10.0 占位文件 - 车辆实体

export class Vehicle {
    constructor(id, model = 'sedan') {
        this.id = id;
        this.model = model;  // sedan / sports / truck / police
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
        console.log(`[Vehicle ${id}] 占位构造完成 - model=${model}`);
    }

    update(dt) {
        // TODO v6.10.4: 车辆动力学 (Rapier)
    }
}
