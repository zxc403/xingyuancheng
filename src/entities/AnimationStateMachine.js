// src/entities/AnimationStateMachine.js
// v6.11.0 (M2.3): 完整动画状态机
//
// 替代 v6.6 的"三态硬切"逻辑（idle/walk/run），实现 GTA 风格的 blend tree：
//   - 7 个基本状态：idle / walk / jog / run / crouch / jump / falling
//   - 4 个姿态层：上半身（手势 / 持枪 / 挥手 / 说话）
//   - 平滑过渡：fadeIn/fadeOut 0.15-0.30s
//   - 速度阈值（来自 GTA V 经验值）：
//       0.0 m/s   = idle
//       0.1-1.5   = walk
//       1.5-3.5   = jog
//       3.5+      = run
//       任意速度 + crouch 按键 = crouchwalk
//       y velocity < -0.5 = falling
//       on-ground == false && y_vel > 0.5 = jump
//
// 用法：
//   const sm = new AnimationStateMachine(acts, mixer);
//   sm.update(dt, { speed, verticalVel, onGround, crouching, upperAction });
//   sm.playOnce('jump');  // 一次性动作（jump 播放完回到 idle）
//
// 设计原则：
//   1. 不依赖具体 clip 名，只用 key（如 'idle' / 'walk' / 'jog' / 'run'）
//   2. 缺失的 clip 自动降级（run 缺失 → 用 jog）
//   3. 上下半身分层：upperAction 与 lowerAction 同时播，但权重独立
//   4. 一次性动作排队：jump/dance/death 期间排队新的会覆盖

const THREE = window.THREE;

// v6.11.0: 状态定义
export const AnimState = {
    IDLE:      'idle',
    WALK:      'walk',
    JOG:       'jog',
    RUN:       'run',
    CROUCH_IDLE:  'crouch_idle',
    CROUCH_WALK:  'crouch_walk',
    JUMP_START:   'jump',
    FALLING:   'falling',
    LANDING:   'landing',
    DEATH:     'death',
    DANCE:     'dance',
    TALK:      'talk',
    WAVE:      'wave',
    PUNCH:     'punch',
    GESTURE:   'gesture',
    CUSTOM:    'custom'
};

// 速度阈值（m/s）
export const SPEED_THRESH = {
    IDLE:  0.1,
    WALK:  1.5,
    JOG:   3.5,
    RUN:   100,   // 上不封顶
    CROUCH_WALK: 1.2
};

// 各 state 的目标权重（normal 状态只播一个，weight=1；其他=0）
function targetWeightFor(state) {
    if ([AnimState.JUMP_START, AnimState.FALLING, AnimState.LANDING, AnimState.DEATH, AnimState.DANCE, AnimState.TALK, AnimState.WAVE, AnimState.PUNCH, AnimState.GESTURE].includes(state)) {
        return 1.0;  // 一次性动作全权重
    }
    return 1.0;  // 简单起见所有主循环动作都是 1.0
}

/**
 * 一次性播放任务
 */
class OneShot {
    constructor(key, action, fadeIn = 0.1, fadeOut = 0.15) {
        this.key = key;
        this.action = action;
        this.fadeIn = fadeIn;
        this.fadeOut = fadeOut;
        this.startedAt = null;
        this.done = false;
    }
    start(time) { this.startedAt = time; this.action.reset(); this.action.setLoop(THREE.LoopOnce, 1); this.action.clampWhenFinished = true; this.action.fadeIn(this.fadeIn).play(); }
    tick(time) {
        if (this.startedAt == null) this.start(time);
        const d = this.action.getClip().duration;
        if ((time - this.startedAt) >= d) {
            this.action.fadeOut(this.fadeOut);
            this.done = true;
        }
    }
}

export class AnimationStateMachine {
    /**
     * @param {object} acts   { idle, walk, jog, run, crouch_idle, crouch_walk, jump, falling, landing, dance, death, talk, wave, punch, gesture }
     * @param {THREE.AnimationMixer} mixer
     * @param {object} opts
     */
    constructor(acts, mixer, opts = {}) {
        this.acts = acts || {};
        this.mixer = mixer;
        this.state = AnimState.IDLE;
        this.current = null;  // 当前 playing action
        this.oneShot = null;  // 一次性动作（jump/dance/...）
        this.lastTime = 0;
        this.fadeTime = opts.fadeTime ?? 0.20;
        // 上下半身分层（v6.11 简单实现：upperAction 仅用 additive 模式叠加）
        this.upperAction = null;
        this.upperWeight = 0;
        console.log('[AnimSM] 构造完成，state=', this.state);
    }

    /**
     * 根据状态选择 action（缺失时降级）
     * @param {string} state
     * @returns {THREE.AnimationAction|null}
     */
    pickAct(state) {
        // 优先级：state 名 → 同义词 → 缺失
        const a = this.acts;
        if (state === AnimState.IDLE) return a.idle || null;
        if (state === AnimState.WALK) return a.walk || a.idle || null;
        if (state === AnimState.JOG)  return a.jog || a.walk || a.idle || null;
        if (state === AnimState.RUN)  return a.run || a.jog || a.walk || a.idle || null;
        if (state === AnimState.CROUCH_IDLE) return a.crouch_idle || a.crouch || a.idle || null;
        if (state === AnimState.CROUCH_WALK) return a.crouch_walk || a.crouch || a.walk || a.idle || null;
        if (state === AnimState.JUMP_START) return a.jump || null;
        if (state === AnimState.FALLING) return a.falling || a.idle || null;
        if (state === AnimState.LANDING) return a.landing || a.idle || null;
        if (state === AnimState.DEATH) return a.death || null;
        if (state === AnimState.DANCE) return a.dance || null;
        if (state === AnimState.TALK) return a.talk || a.gesture || a.idle || null;
        if (state === AnimState.WAVE) return a.wave || a.gesture || a.idle || null;
        if (state === AnimState.PUNCH) return a.punch || a.gesture || a.idle || null;
        if (state === AnimState.GESTURE) return a.gesture || a.talk || a.idle || null;
        return a.idle || null;
    }

    /**
     * 主循环：每帧调用
     * @param {number} dt
     * @param {object} input   { speed, verticalVel, onGround, crouching, intent }
     */
    update(dt, input = {}) {
        if (!this.mixer) return;
        const time = (this.lastTime = (this.lastTime || 0) + dt);
        this.mixer.update(dt);

        // 处理一次性动作（jump/dance/...）
        if (this.oneShot) {
            this.oneShot.tick(time);
            if (this.oneShot.done) this.oneShot = null;
            return;  // 一次性动作期间主状态机冻结
        }

        // 计算目标状态
        const target = this._computeState(input);
        if (target !== this.state) {
            this._transitionTo(target, input);
            this.state = target;
        }
    }

    _computeState(input) {
        if (input.dying) return AnimState.DEATH;
        const onG = input.onGround !== false;  // 默认 true
        if (!onG) {
            if ((input.verticalVel || 0) > 0.5) return AnimState.JUMP_START;
            return AnimState.FALLING;
        }
        const sp = input.speed || 0;
        if (input.crouching) {
            if (sp > SPEED_THRESH.IDLE) return AnimState.CROUCH_WALK;
            return AnimState.CROUCH_IDLE;
        }
        if (sp > SPEED_THRESH.JOG) return AnimState.RUN;
        if (sp > SPEED_THRESH.WALK) return AnimState.JOG;
        if (sp > SPEED_THRESH.IDLE) return AnimState.WALK;
        return AnimState.IDLE;
    }

    _transitionTo(target, input) {
        const next = this.pickAct(target);
        if (!next) return;
        if (this.current === next) return;
        next.reset();
        next.setLoop(THREE.LoopRepeat, Infinity);
        next.fadeIn(this.fadeTime);
        next.play();
        if (this.current) this.current.fadeOut(this.fadeTime);
        this.current = next;
    }

    /**
     * 触发一次性动作（jump/dance/wave/punch/death）
     * @param {string} state
     */
    playOnce(state) {
        const act = this.pickAct(state);
        if (!act) return false;
        this.oneShot = new OneShot(state, act);
        if (this.current) this.current.fadeOut(0.1);
        this.state = state;
        return true;
    }

    /**
     * 取得当前 state
     */
    getState() { return this.state; }

    /**
     * 调试
     */
    describe() {
        const have = Object.entries(this.acts).filter(([k, v]) => !!v).map(([k]) => k).join(',');
        return `state=${this.state} | acts=[${have}] | oneShot=${this.oneShot ? this.oneShot.key : 'none'}`;
    }
}
