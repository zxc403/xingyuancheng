// src/entities/NPC.js
// v6.10.0 占位文件 - NPC 实体（行人类）

export class NPC {
    constructor(id, type = 'civilian') {
        this.id = id;
        this.type = type;  // civilian / police / vendor / gang
        this.pos = { x: 0, y: 0, z: 0 };
        this.vel = { x: 0, y: 0, z: 0 };
        this.yaw = 0;
        this.state = 'idle';  // idle / walk / run / talk / flee
        this.mesh = null;
        this.mixer = null;
        this.acts = null;
        console.log(`[NPC ${id}] 占位构造完成 - type=${type}`);
    }

    update(dt) {
        // TODO v6.10.4: 状态机 + 行为决策
    }
}
