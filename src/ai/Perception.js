// src/ai/Perception.js
// v6.10.0 占位文件 - NPC 感知系统（视觉/听觉/记忆）

export class Perception {
    constructor(npc) {
        this.npc = npc;
        this.sightRange = 30;
        this.hearingRange = 20;
        this.memory = [];  // 最近 10 秒看到/听到的事件
        console.log(`[Perception ${npc.id}] 占位构造完成`);
    }

    update(dt) {
        // TODO v6.11: 视觉锥 + 听觉衰减
    }
}
