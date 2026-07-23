// src/core/GameLoop.js
// v6.10.0 占位文件 - 主循环（fixed timestep + render）

export class GameLoop {
    constructor() {
        this.last = 0;
        this.acc = 0;
        this.fixedDt = 1/60;
        this.running = false;
        this.subscribers = [];  // 每帧 / 每 fixed step 回调
        console.log('[GameLoop] 占位构造完成');
    }

    start() {
        // TODO v6.10.x: requestAnimationFrame 主循环
    }

    pause() {
        this.running = false;
    }
}
