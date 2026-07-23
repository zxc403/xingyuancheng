// src/core/Input.js
// v6.10.2: 抽离 Input 模块 - 键盘 / 鼠标 / 触摸 事件管理
//
// 设计思路：Input 是"事件源"，它只负责监听 DOM 事件，
// 通过回调把按键状态、鼠标位移、触摸点暴露给其他模块。
// 玩家移动 / 相机转动 / 射击等业务逻辑仍在 index.html 老代码中
// (保持向后兼容)，v6.10.7 才完全接管。
//
// 接口：
//   input.keys        - 键盘状态 {w:true, a:false, ...}
//   input.mouse       - 鼠标状态 {dx, dy, left, right}
//   input.touch       - 触摸状态 {active, joystick, view}
//   input.bindAction(key, callback)  - 注册快捷键回调
//   input.init()      - 绑定所有 DOM 事件

export class Input {
    constructor() {
        // 键盘状态
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
     *   callbacks.onTouchView(dx, dy)  - 触摸转向
     *   callbacks.onTouchJoystick(keys, dx, dy)  - 摇杆
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

        // 暴露给全局
        window.keys = this.keys;  // 兼容老代码 window.keys['w']
        console.log('[Input] initialized', { isTouch: this._isTouch });
    }

    /**
     * 注册快捷键
     * @param {string} key - '1' / 'r' / 'f5' / 'escape' / 'p' / 'n' / 'h' / '?'
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

    // ===== 内部：触摸 =====
    _initTouch() {
        const jl = document.getElementById('joyL');
        const knob = document.getElementById('joyKnob');
        const ctrl = document.getElementById('touchCtrl');

        if (!ctrl) {
            console.warn('[Input] #touchCtrl 不存在, 跳过触摸初始化');
            return;
        }

        // 激活 touchCtrl
        if (!ctrl.classList.contains('active')) ctrl.classList.add('active');

        let jId = null, jStartX = 0, jStartY = 0, jActive = false;
        let vId = null, vStartX = 0, vStartY = 0, vActive = false;
        let vBaseYaw = 0, vBasePitch = 0;

        // 转向触摸
        ctrl.addEventListener('touchstart', (e) => {
            for (const t of e.changedTouches) {
                const tag = (t.target && t.target.closest)
                    ? t.target.closest('.joy-l, .t-btn, #chat-input-row, #settings-pop, #chat-panel')
                    : null;
                if (tag) continue;
                if (t.clientX < window.innerWidth * 0.4) continue;
                if (vId === null) {
                    vId = t.identifier;
                    vStartX = t.clientX;
                    vStartY = t.clientY;
                    // 每次新触摸都通过回调拿当前 yaw/pitch 作为基准
                    if (this._callbacks.onTouchViewStart) {
                        const base = this._callbacks.onTouchViewStart();
                        vBaseYaw = base ? base.yaw : 0;
                        vBasePitch = base ? base.pitch : 0;
                    } else {
                        vBaseYaw = 0;
                        vBasePitch = 0;
                    }
                    vActive = true;
                }
            }
        }, { passive: true });

        ctrl.addEventListener('touchmove', (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === vId && vActive) {
                    const dx = (t.clientX - vStartX) / window.innerWidth;
                    const dy = (t.clientY - vStartY) / window.innerHeight;
                    if (this._callbacks.onTouchView) {
                        this._callbacks.onTouchView(dx, dy, vBaseYaw, vBasePitch);
                    }
                }
            }
        }, { passive: true });

        const endTouch = (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === vId) { vId = null; vActive = false; }
                if (t.identifier === jId) {
                    jId = null; jActive = false;
                    this.keys['w'] = this.keys['s'] = this.keys['a'] = this.keys['d'] = false;
                    if (knob) knob.style.transform = 'translate(-50%,-50%)';
                }
            }
        };
        ctrl.addEventListener('touchend', endTouch, { passive: true });
        ctrl.addEventListener('touchcancel', endTouch, { passive: true });

        // 摇杆触摸
        if (jl) {
            jl.addEventListener('touchstart', (e) => {
                e.preventDefault(); e.stopPropagation();
                const t = e.changedTouches[0];
                jId = t.identifier;
                jStartX = t.clientX; jStartY = t.clientY; jActive = true;
            }, { passive: false });

            const joyMove = (e) => {
                e.preventDefault();
                for (const t of e.changedTouches) {
                    if (t.identifier === jId && jActive) {
                        const dx = (t.clientX - jStartX) / 50;
                        const dy = (t.clientY - jStartY) / 50;
                        this.keys['w'] = dy < -0.15;
                        this.keys['s'] = dy > 0.15;
                        this.keys['a'] = dx < -0.15;
                        this.keys['d'] = dx > 0.15;
                        if (knob) {
                            const px = Math.max(-40, Math.min(40, dx * 40));
                            const py = Math.max(-40, Math.min(40, dy * 40));
                            knob.style.transform = `translate(${px}px,${py}px) translate(-50%,-50%) scale(${1 + Math.min(0.2, Math.sqrt(dx*dx + dy*dy) * 0.1)})`;
                        }
                        if (this._callbacks.onTouchJoystick) {
                            this._callbacks.onTouchJoystick(this.keys, dx, dy);
                        }
                    }
                }
            };
            const joyEnd = (e) => {
                for (const t of e.changedTouches) {
                    if (t.identifier === jId) {
                        jId = null; jActive = false;
                        this.keys['w'] = this.keys['s'] = this.keys['a'] = this.keys['d'] = false;
                        if (knob) knob.style.transform = 'translate(-50%,-50%) scale(1)';
                    }
                }
            };
            jl.addEventListener('touchmove', joyMove, { passive: false });
            jl.addEventListener('touchend', joyEnd, { passive: false });
            jl.addEventListener('touchcancel', joyEnd, { passive: false });
        }

        // 按钮事件
        const bindBtn = (id, name) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (this._callbacks.onTouchAction) {
                    this._callbacks.onTouchAction(name);
                }
            }, { passive: false });
        };
        bindBtn('btnFire', 'fire');
        bindBtn('btnJump', 'jump');
        bindBtn('btnReload', 'reload');
        bindBtn('btnInteract', 'interact');
        bindBtn('btnVehicle', 'vehicle');

        this.touch.active = true;
        console.log('[Input] 触摸控制已激活');
    }
}
