// src/core/Input.js
// v6.10.7 (WB): 抽离 Input 模块 - 键盘 / 鼠标 / 触摸 事件管理
// 触摸方案升级为「和平精英」风格：
//   - 左半屏任意位置浮出虚拟摇杆（出现位置 = 触点），控制移动
//   - 右半屏滑动控制视角
//   - 右下角按钮簇（开火 + 跳跃/换弹/交互/载具）
//
// 接口：
//   input.keys        - 键盘/摇杆状态 {w,a,s,d,...}
//   input.mouse       - 鼠标状态 {dx, dy, left, right}
//   input.touch       - 触摸状态 {active, joystick, view}
//   input.bindAction(key, callback)  - 注册快捷键回调
//   input.init()      - 绑定所有 DOM 事件

export class Input {
    constructor() {
        // 键盘/摇杆状态（与 index.html 共享 window.keys）
        this.keys = {};
        // 鼠标状态
        this.mouse = { dx: 0, dy: 0, left: false, right: false, locked: false };
        // 触摸状态
        this.touch = {
            active: false,
            joystickId: null,
            viewId: null,
            joystickDx: 0,
            joystickDy: 0
        };
        // 快捷键回调
        this.actions = new Map();
        // 内部状态
        this._isTouch = false;
        this._rendererEl = null;
    }

    /**
     * 绑定所有 DOM 事件
     * @param {Object} opts
     * @param {HTMLElement} opts.rendererEl - 用于 pointer lock 的 canvas
     * @param {Object} opts.callbacks - 业务回调
     *   callbacks.onMouseMove(dx, dy)
     *   callbacks.onMouseDown(button)
     *   callbacks.onPointerLockChange(locked)
     *   callbacks.onEscape()
     *   callbacks.onTouchView(dx, dy, baseYaw, basePitch)  - 触摸转向
     *   callbacks.onTouchViewStart() -> {yaw, pitch}        - 返回基准视角
     *   callbacks.onTouchJoystick(keys, dx, dy)  - 摇杆（可选）
     *   callbacks.onTouchAction(name)  - 触摸按钮
     */
    init({ rendererEl, callbacks = {} } = {}) {
        this._rendererEl = rendererEl;
        this._isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
        this._callbacks = callbacks;

        // 键盘
        document.addEventListener('keydown', (e) => this._onKeyDown(e));
        document.addEventListener('keyup', (e) => this._onKeyUp(e));

        // 鼠标
        document.addEventListener('mousemove', (e) => this._onMouseMove(e));
        document.addEventListener('mousedown', (e) => this._onMouseDown(e));
        document.addEventListener('pointerlockchange', () => this._onPointerLockChange());

        // Escape 暂停
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._callbacks.onEscape) {
                this._callbacks.onEscape();
            }
        });

        // 触摸
        if (this._isTouch) {
            this._initTouch();
        }

        // 暴露给全局（兼容老代码 window.keys['w']）
        window.keys = this.keys;
        console.log('[Input] initialized', { isTouch: this._isTouch });
    }

    /**
     * 注册快捷键
     * @param {string} key - '1' / 'r' / 'f' / 'f5' / 'escape' / 'p' / 'n' / 'h' / '?'
     * @param {Function} fn
     */
    bindAction(key, fn) {
        this.actions.set(key.toLowerCase(), fn);
    }

    /**
     * 每帧重置增量（鼠标 dx/dy）
     */
    update() {
        this.mouse.dx = 0;
        this.mouse.dy = 0;
    }

    // ===== 内部：键盘 =====
    _onKeyDown(e) {
        const k = e.key.toLowerCase();
        this.keys[k] = true;

        // 触发注册的 action
        if (this.actions.has(k)) {
            this.actions.get(k)(e);
        }
    }

    _onKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
    }

    // ===== 内部：鼠标 =====
    _onMouseMove(e) {
        if (!this.mouse.locked) return;
        this.mouse.dx = e.movementX;
        this.mouse.dy = e.movementY;
        if (this._callbacks.onMouseMove) {
            this._callbacks.onMouseMove(e.movementX, e.movementY);
        }
    }

    _onMouseDown(e) {
        if (this._callbacks.onMouseDown) {
            this._callbacks.onMouseDown(e.button);
        }
    }

    _onPointerLockChange() {
        const locked = document.pointerLockElement === this._rendererEl;
        this.mouse.locked = locked;
        if (this._callbacks.onPointerLockChange) {
            this._callbacks.onPointerLockChange(locked);
        }
    }

    // ===== 内部：触摸（和平精英风格） =====
    _initTouch() {
        const ctrl = document.getElementById('touchCtrl');
        const jl = document.getElementById('joyL');
        const knob = document.getElementById('joyKnob');

        if (!ctrl) {
            console.warn('[Input] #touchCtrl 不存在, 跳过触摸初始化');
            return;
        }

        // 激活 touchCtrl
        if (!ctrl.classList.contains('active')) ctrl.classList.add('active');
        // 确保全屏接收触控（CSS 已设置，但这里做兜底）
        ctrl.style.pointerEvents = 'auto';

        // 摇杆初始隐藏，触点出现时才显示
        if (jl) {
            jl.style.opacity = '0';
            jl.style.transition = 'opacity .12s';
            jl.classList.remove('active');
        }

        const JOY_RADIUS = 65; // 摇杆半径（px），与 CSS width/2 对应
        let jId = null, jActive = false, jBaseX = 0, jBaseY = 0;
        let vId = null, vActive = false, vStartX = 0, vStartY = 0, vBaseYaw = 0, vBasePitch = 0;

        const isControlTouch = (target) => {
            return !(target && target.closest && target.closest('.t-btn, #chat-input-row, #settings-pop, #chat-panel, #landscapeBtn'));
        };

        const startJoystick = (t) => {
            jId = t.identifier;
            jActive = true;
            jBaseX = t.clientX;
            jBaseY = t.clientY;
            if (jl) {
                jl.style.left = (jBaseX - JOY_RADIUS) + 'px';
                jl.style.top = (jBaseY - JOY_RADIUS) + 'px';
                jl.style.bottom = 'auto';
                jl.style.opacity = '1';
                jl.classList.add('active');
            }
            if (knob) knob.style.transform = 'translate(-50%,-50%) scale(1)';
        };

        const startView = (t) => {
            if (vId !== null) return;
            vId = t.identifier;
            vActive = true;
            vStartX = t.clientX;
            vStartY = t.clientY;
            if (this._callbacks.onTouchViewStart) {
                const base = this._callbacks.onTouchViewStart();
                vBaseYaw = base ? base.yaw : 0;
                vBasePitch = base ? base.pitch : 0;
            } else {
                vBaseYaw = 0;
                vBasePitch = 0;
            }
        };

        const updateJoystick = (t) => {
            const dx = (t.clientX - jBaseX) / 50;
            const dy = (t.clientY - jBaseY) / 50;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // 归一化到最大 1.5 倍死区，防止手指划出太远
            const scale = dist > 0 ? Math.min(dist, 1.5) / dist : 1;
            const cdx = dx * scale;
            const cdy = dy * scale;

            this.keys['w'] = cdy < -0.15;
            this.keys['s'] = cdy > 0.15;
            this.keys['a'] = cdx < -0.15;
            this.keys['d'] = cdx > 0.15;

            this.touch.joystickDx = cdx;
            this.touch.joystickDy = cdy;

            if (knob) {
                const px = Math.max(-40, Math.min(40, cdx * 40));
                const py = Math.max(-40, Math.min(40, cdy * 40));
                knob.style.transform = `translate(${px}px,${py}px) translate(-50%,-50%) scale(${1 + Math.min(0.2, dist * 0.1)})`;
            }
            if (this._callbacks.onTouchJoystick) {
                this._callbacks.onTouchJoystick(this.keys, cdx, cdy);
            }
        };

        const updateView = (t) => {
            const dx = (t.clientX - vStartX) / window.innerWidth;
            const dy = (t.clientY - vStartY) / window.innerHeight;
            if (this._callbacks.onTouchView) {
                this._callbacks.onTouchView(dx, dy, vBaseYaw, vBasePitch);
            }
        };

        ctrl.addEventListener('touchstart', (e) => {
            for (const t of e.changedTouches) {
                if (!isControlTouch(t.target)) continue;
                const x = t.clientX;
                const w = window.innerWidth;
                // 左 45% 为移动区，右 55% 为视角区
                if (x < w * 0.45) {
                    if (jId === null) startJoystick(t);
                } else {
                    if (vId === null) startView(t);
                }
            }
        }, { passive: false });

        ctrl.addEventListener('touchmove', (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === jId && jActive) {
                    updateJoystick(t);
                } else if (t.identifier === vId && vActive) {
                    updateView(t);
                }
            }
        }, { passive: false });

        const endTouch = (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === vId) { vId = null; vActive = false; }
                if (t.identifier === jId) {
                    jId = null; jActive = false;
                    this.keys['w'] = this.keys['s'] = this.keys['a'] = this.keys['d'] = false;
                    this.touch.joystickDx = 0;
                    this.touch.joystickDy = 0;
                    if (jl) {
                        jl.style.opacity = '0';
                        jl.classList.remove('active');
                    }
                    if (knob) knob.style.transform = 'translate(-50%,-50%) scale(1)';
                }
            }
        };
        ctrl.addEventListener('touchend', endTouch, { passive: true });
        ctrl.addEventListener('touchcancel', endTouch, { passive: true });

        // 按钮事件（绑定到独立按钮，阻止冒泡到 ctrl）
        const bindBtn = (id, name) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (this._callbacks.onTouchAction) {
                    this._callbacks.onTouchAction(name);
                }
            }, { passive: false });
            // 某些桌面环境用鼠标调试
            el.addEventListener('mousedown', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (this._callbacks.onTouchAction) {
                    this._callbacks.onTouchAction(name);
                }
            });
        };
        bindBtn('btnFire', 'fire');
        bindBtn('btnJump', 'jump');
        bindBtn('btnReload', 'reload');
        bindBtn('btnInteract', 'interact');
        bindBtn('btnVehicle', 'vehicle');

        this.touch.active = true;
        console.log('[Input] 触摸控制已激活（PUBG 风格：左摇杆+右视角）');
    }
}
