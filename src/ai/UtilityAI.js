// src/ai/UtilityAI.js
// v6.10.0 占位文件 - Utility AI（NPC 决策评分系统）

export class UtilityAI {
    constructor(npc) {
        this.npc = npc;
        this.actions = [];  // 候选动作列表
        console.log(`[UtilityAI ${npc.id}] 占位构造完成`);
    }

    score() {
        // TODO v6.11: 给每个动作打分（0-1），选最高分执行
        return null;
    }
}
