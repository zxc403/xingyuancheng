// src/entities/Player.js
// v6.10.3: 抽离 Player 实体 - 玩家模型/动画状态机/逻辑入口
// v6.11.0: 升级为完整 blend tree（AnimationStateMachine）
//
// 设计思路：Player 类封装所有"玩家相关"逻辑。
// index.html 中的 updatePlayer 是个大函数（300+ 行），本类只接管
// 可独立工作的部分：createPlayerMesh / updatePlayerAnim / updateFootsteps
// 完整的 updatePlayer（含物理/碰撞/载具切换）仍在 index.html 老代码中。
//
// 接口：
//   player.spawn(scene)         - 创建玩家 GLB 身体
//   player.updateAnim(dt, input) - blend tree 状态机（idle/walk/jog/run/crouch/jump）
//   player.getMesh()            - 拿到 mesh（给相机/AI 用）
//   player.playAction(state)    - 触发一次性动作（jump/wave/dance/death）

const THREE = window.THREE;  // 复用 index.html 已 import 的 THREE
import { AnimationStateMachine, AnimState } from './AnimationStateMachine.js';  // v6.11.0

// v6.11.0: clip 关键词映射（来自 CharacterRegistry）
const INTENT_KEYWORDS = {
    [AnimState.IDLE]:    ['idle', 'breath'],
    [AnimState.WALK]:    ['walk', 'walking'],
    [AnimState.JOG]:     ['jog', 'run', 'sprint'],
    [AnimState.RUN]:     ['run', 'sprint', 'jog'],
    [AnimState.CROUCH_IDLE]:  ['crouch', 'sitting'],
    [AnimState.CROUCH_WALK]:  ['crouchwalk', 'crouch_walk', 'sneak'],
    [AnimState.JUMP_START]:   ['jump', 'leap'],
    [AnimState.FALLING]:      ['fall', 'falling'],
    [AnimState.LANDING]:      ['land', 'landing'],
    [AnimState.DEATH]:        ['death', 'die'],
    [AnimState.DANCE]:        ['dance'],
    [AnimState.TALK]:         ['talk', 'wave', 'yes'],
    [AnimState.WAVE]:         ['wave', 'hello'],
    [AnimState.PUNCH]:        ['punch', 'hit'],
    [AnimState.GESTURE]:      ['gesture', 'thumbs', 'yes', 'no', 'wave']
};

export class Player {
    constructor() {
        // 位置 / 朝向 / 速度
        this.pos = { x: 0, y: 1.6, z: 0 };
        this.vel = { x: 0, y: 0, z: 0 };
        this.yaw = 0;
        this.pitch = -0.05;

        // 状态
        this.onGround = true;
        this.inVehicle = false;
        this.moveSpeed = 0;
        this.health = 100;
        this.money = 0;
        this.stress = 0;
        this.isDead = false;
        this.isBusted = false;

        // 模型 + 动画
        this.mesh = null;
        this.mixer = null;
        this.acts = null;  // { idle, walk, run, currentAct }
        this.sm = null;    // v6.11.0: AnimationStateMachine
        this.face = null;  // v6.11.0: FacialExpression（facecap 模型专用）
        this.avatar = null;  // v6.11.0: AvatarCustomization
        this.ik = null;    // v6.11.0 (M2.6): IKSystem

        // 染色
        this.tint = 0x4488ff;  // 玩家衣服颜色（默认蓝）
        this.targetHeight = 1.7;  // 归一身高

        console.log('[Player] 构造完成');
    }

    /**
     * 创建玩家 GLB 身体（clone Xbot + 染色 + 动画 mixer）
     * @param {THREE.Scene} scene
     */
    spawn(scene) {
        if (this.mesh) return;  // 幂等
        const key = 'char_xbot';
        if (!window._realModels || !window._realModels[key]) {
            console.warn('[Player.spawn] char_xbot 未加载，使用兜底胶囊');
            this._spawnFallback(scene);
            return;
        }

        try {
            const charG = window._realModels[key].clone(true);

            // 归一尺寸到 1.7m 身高
            const box = new THREE.Box3().setFromObject(charG);
            const size = new THREE.Vector3(); box.getSize(size);
            const s = this.targetHeight / size.y;
            charG.scale.set(s, s, s);
            const center = new THREE.Vector3(); box.getCenter(center);
            charG.position.set(-center.x * s, -box.min.y * s, -center.z * s);

            charG.traverse(c => {
                if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
            });

            // 染色：只染衣服，保留皮肤
            const tint = new THREE.Color(this.tint);
            charG.traverse(c => {
                if (!c.isMesh || !c.material) return;
                const matName = (c.material.name) || '';
                if (/Beta_HighLimbsGeoSG2|Beta_HighLimbs/i.test(matName)) {
                    c.material = c.material.clone();
                    const cc = c.material.color;
                    if (cc && cc.r !== undefined) {
                        cc.r = tint.r; cc.g = tint.g; cc.b = tint.b;
                    } else {
                        c.material.color = tint.clone();
                    }
                }
            });

            // 动画 mixer（v6.11.0: 完整 blend tree 注册）
            const src = window._realModelsSrc && window._realModelsSrc[key];
            if (src && src.animations && src.animations.length) {
                this.mixer = new THREE.AnimationMixer(charG);
                const findAnim = (kw) =>
                    src.animations.find(a => a.name && a.name.toLowerCase().includes(kw));
                // 找所有 intent 对应的 clip
                const find = (kws) => {
                    for (const kw of kws) {
                        const a = findAnim(kw);
                        if (a) return a;
                    }
                    return null;
                };
                const acts = {};
                for (const [intent, kws] of Object.entries(INTENT_KEYWORDS)) {
                    const clip = find(kws);
                    if (clip) {
                        const a = this.mixer.clipAction(clip);
                        a.setLoop(THREE.LoopRepeat, Infinity);
                        acts[intent] = a;
                    }
                }
                // 兜底：idle 必填
                if (!acts.idle) {
                    const fallback = src.animations[0];
                    const a = this.mixer.clipAction(fallback);
                    a.setLoop(THREE.LoopRepeat, Infinity);
                    a.play();
                    acts.idle = a;
                } else {
                    acts.idle.play();
                }
                this.acts = acts;
                // v6.11.0: 实例化状态机
                this.sm = new AnimationStateMachine(this.acts, this.mixer);
                console.log('[Player.spawn] 动画注册完成，clips=',
                    Object.keys(this.acts).length, Object.keys(this.acts).join(','));
            }

            this.mesh = charG;
            if (scene) scene.add(charG);
            // v6.11.0: 初始化 FacialExpression（facecap 模型 / 其他带 morph 的模型可用）
            this._initFace(charG);
            // v6.11.0: 初始化 AvatarCustomization（传入已知的 charKey）
            this._initAvatar(charG, key);
            console.log('[Player.spawn] 玩家 GLB 注入完成', key,
                'animations:', src && src.animations && src.animations.length);
            // v6.11.0 (M2.6): 绑定 IK（找骨骼）
            this.ik = new IKSystem(this);
            this.ik.bind(charG);
        } catch (e) {
            console.warn('[Player.spawn] 失败，使用胶囊', e);
            this._spawnFallback(scene);
        }
    }

    /**
     * v6.11.0: 初始化 AvatarCustomization（从注册表读 tint 配置 + localStorage 恢复）
     * @param {THREE.Group} charG
     * @param {string} [charKeyHint]   已知的 charKey（M2.5 换皮时传入）
     */
    _initAvatar(charG, charKeyHint) {
        if (!window.AvatarCustomization) return;
        // 优先用 hint，其次从 _realModels 反查
        let charKey = charKeyHint || 'char_xbot';
        if (!charKeyHint && window._realModels) {
            for (const k of Object.keys(window._realModels)) {
                if (window._realModels[k] === charG) {
                    charKey = k;
                    break;
                }
            }
        }
        this.avatarHint = { charKey };
        const charDef = window.getCharReg ? window.getCharReg(charKey) : null;
        this.avatar = new window.AvatarCustomization(this, charDef);
        // 从 localStorage 恢复
        this.avatar.loadFromStorage();
        console.log('[Player._initAvatar] 完成，charKey=', charKey);
    }

    /**
     * v6.11.0: 初始化 FacialExpression
     * 找带 morphTargetInfluences 的 mesh（通常是头部）
     */
    _initFace(charG) {
        if (!window.FacialExpression) return;
        let headMesh = null;
        charG.traverse(c => {
            if (c.isMesh && c.morphTargetInfluences && c.morphTargetInfluences.length > 0) {
                if (!headMesh || c.morphTargetInfluences.length > headMesh.morphTargetInfluences.length) {
                    headMesh = c;
                }
            }
        });
        if (headMesh) {
            this.face = new window.FacialExpression(headMesh);
            console.log('[Player._initFace] 找到面部 mesh，morph 数量=',
                headMesh.morphTargetInfluences.length);
        }
    }

    /**
     * v6.11.0 (M2.5): 切换玩家 GLB 身体
     * 先从 scene 移除旧 mesh，再 spawn 新的 charKey
     * @param {string} charKey   CharacterRegistry 里的 key
     * @returns {boolean} 成功
     */
    setCharacterKey(charKey) {
        if (!charKey) return false;
        const def = window.getCharReg ? window.getCharReg(charKey) : null;
        if (!def) {
            console.warn('[Player.setCharacterKey] 未注册:', charKey);
            return false;
        }
        // v6.11.0: 等模型加载完成才能切
        if (!window._realModels || !window._realModels[charKey]) {
            console.warn('[Player.setCharacterKey] 模型未加载:', charKey, '，稍后重试');
            this._pendingCharKey = charKey;
            // 注册一次性 hook：等模型可用时再切换
            if (!window.__avatarPendingPoll) {
                window.__avatarPendingPoll = setInterval(() => {
                    const pending = window.__game && window.__game.player && window.__game.player._pendingCharKey;
                    if (pending && window._realModels && window._realModels[pending]) {
                        const p = window.__game.player;
                        p._pendingCharKey = null;
                        clearInterval(window.__avatarPendingPoll);
                        window.__avatarPendingPoll = null;
                        p.setCharacterKey(pending);
                    }
                }, 500);
            }
            return false;
        }
        // 记下当前 pos/yaw/可见性，新 mesh 沿用
        const keepPos = { ...this.pos };
        const keepYaw = this.yaw;
        const keepVisible = this.mesh ? this.mesh.visible : true;
        const scene = this.mesh && this.mesh.parent;
        // 卸旧 mesh
        if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
        // 卸旧 mixer
        this.mixer = null;
        this.acts = null;
        this.sm = null;
        this.face = null;
        this.avatar = null;
        this.ik = null;  // v6.11.0 (M2.6): 卸旧 IK，新 spawn 重新绑
        this.mesh = null;
        // 用新 charKey 重新 spawn
        this.targetHeight = def.size || 1.7;
        if (this.avatarHint) this.avatarHint.charKey = charKey;
        this.spawn(scene);
        // 还原
        this.pos = keepPos;
        this.yaw = keepYaw;
        if (this.mesh) this.mesh.visible = keepVisible;
        // 重新挂 Avatar（走 charDef）
        if (window.AvatarCustomization) {
            this.avatar = new window.AvatarCustomization(this, def);
            this.avatar.loadFromStorage();
        }
        console.log('[Player.setCharacterKey] 切换完成 ->', charKey);
        return true;
    }

    getCharacterKey() {
        return this.avatarHint ? this.avatarHint.charKey : 'char_xbot';
    }

    /**
     * 兜底胶囊（GLB 不可用时）
     */
    _spawnFallback(scene) {
        const fallback = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.28, 0.7, 4, 12),
            new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.5, metalness: 0.1 })
        );
        body.position.y = 0.9;
        body.castShadow = true;
        fallback.add(body);
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 12, 8),
            new THREE.MeshStandardMaterial({ color: 0xe8c8a0, roughness: 0.6 })
        );
        head.position.y = 1.65;
        head.castShadow = true;
        fallback.add(head);
        this.mesh = fallback;
        this.mixer = null;
        this.acts = null;
        if (scene) scene.add(fallback);
    }

    /**
     * 动画状态机（v6.11.0: 完整 blend tree）
     * @param {number} dt
     * @param {object} input   { speed, verticalVel, onGround, crouching }
     */
    updateAnim(dt, input = {}) {
        if (!this.mixer) return;
        if (this.sm) {
            // v6.11.0: 走完整状态机
            this.sm.update(dt, {
                speed: input.speed != null ? input.speed : (this.moveSpeed || 0),
                verticalVel: input.verticalVel || 0,
                onGround: input.onGround !== false,
                crouching: !!input.crouching,
                dying: !!input.dying
            });
        } else if (this.acts) {
            // v6.6 兜底：直接 mixer.update
            this.mixer.update(dt);
        }
        // v6.11.0: 面部 morph 渐变推进
        if (this.face) this.face.update(dt);
    }

    /**
     * 触发一次性动作（jump / dance / wave / death）
     * @param {string} stateName   AnimState 枚举值
     * @returns {boolean} 成功
     */
    playAction(stateName) {
        if (!this.sm) return false;
        return this.sm.playOnce(stateName);
    }

    /**
     * v6.11.0 (M2.6): 推进 IK（脚 / 视线 / 武器）
     * 由 index.html 每帧调用
     * @param {number} dt
     * @param {object} ctx   { targetPos, terrain, onGround, inCombat, moving }
     */
    updateIK(dt, ctx) {
        if (this.ik) this.ik.update(dt, ctx);
    }

    /**
     * 每帧同步 mesh 到 pos/yaw（被 index.html updatePlayer 调用）
     */
    syncMesh() {
        if (!this.mesh) return;
        this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
        this.mesh.rotation.y = this.yaw;
    }

    /**
     * 进入 / 离开载具时显示 / 隐藏
     */
    setVisible(v) {
        if (this.mesh) this.mesh.visible = v;
    }

    getMesh() {
        return this.mesh;
    }
}
