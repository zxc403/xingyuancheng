// src/entities/Player.js
// v6.10.0 占位文件 - 玩家实体（位置/朝向/速度/动画状态机）

export class Player {
    constructor() {
        this.pos = { x: 0, y: 1.6, z: 0 };
        this.vel = { x: 0, y: 0, z: 0 };
        this.yaw = 0;
        this.pitch = -0.05;
        this.onGround = true;
        this.inVehicle = false;
        this.moveSpeed = 0;
        this.mesh = null;
        this.mixer = null;
        this.acts = null;
        console.log('[Player] 占位构造完成');
    }

    update(dt) {
        // TODO v6.10.3: 从 index.html 迁移 updatePlayer
    }

    spawn(scene) {
        // TODO v6.10.3: createPlayerMesh 逻辑
    }
}
