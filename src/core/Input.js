// src/core/Input.js
// v6.10.0 占位文件 - 将在 v6.10.2 抽离完整 Input 逻辑
// 职责：键盘 / 鼠标 / 触摸 / 虚拟摇杆的输入管理

export class Input {
    constructor() {
        this.keys = {};
        this.mouse = { dx: 0, dy: 0, left: false, right: false };
        this.touch = { active: false, joystick: null, view: null };
        console.log('[Input] 占位构造完成 - 待 v6.10.2 注入真实逻辑');
    }

    init() {
        // TODO v6.10.2: 从 index.html 迁移键盘 / 鼠标 / 触摸监听
    }

    update() {
        // TODO v6.10.2: 每帧重置增量（鼠标 dx/dy）
    }
}
