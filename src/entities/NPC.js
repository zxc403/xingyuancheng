// src/entities/NPC.js
// v6.10.4: 抽离 NPC 实体 - 染色 + AnimationMixer + 行为
//
// 设计思路：NPC 类封装"角色身体创建"和"动画状态机"
// spawnNPCs() 仍在 index.html（依赖大量数据：types/areas/npcNames/npcCtx）
// 但 GLB clone + 染色 + mixer 初始化都通过 NPC.spawn() 工厂方法
//
// 接口：
//   NPC.spawn(type, x, z, custom)   - 创建 NPC 并返回 Group
//   NPC.updateAnimMixers(dt)        - 更新所有 NPC 动画

const THREE = window.THREE;

// GLB 模型与行为映射
const BEH_GLB = {
    police:  () => Math.random() < 0.7 ? 'char_soldier' : 'char_knight',
    gang:    () => 'char_barbarian',
    worker:  () => Math.random() < 0.5 ? 'char_xbot' : 'char_mage',
    student: () => 'char_rogue',
    vendor:  () => 'char_rogue_h',
    pedestrian: null
};

const FALLBACK_GLB = ['char_barbarian','char_knight','char_mage','char_rogue','char_rogue_h','char_xbot','char_soldier'];

// NPC 状态引用（由 spawnNPCs 维护，update 用）
let npcList = [];

export class NPC {
    constructor(id, type) {
        this.id = id;
        this.type = type || 'civilian';
        this.beh = 'pedestrian';
        this.name = '';
        this.pos = { x: 0, y: 0, z: 0 };
        this.vel = { x: 0, y: 0, z: 0 };
        this.yaw = 0;
        this.health = 100;
        this.mesh = null;       // THREE.Group
        this.charGroup = null;  // GLB 子 Group（动画 mixer 作用对象）
        this.mixer = null;
        this.acts = null;       // { idle, walk, run, currentAct }
    }

    /**
     * 工厂方法：从 type 配置创建 NPC，返回 NPC 实例
     * @param {Object} type - {name, color, beh}
     * @param {number} x
     * @param {number} z
     * @param {Object} custom - {name, greetings, context}
     */
    static spawn(type, x, z, custom) {
        const npc = new NPC(Math.random().toString(36).slice(2, 8), type.name);
        npc.beh = type.beh;
        npc.name = custom && custom.name ? custom.name : '';
        npc.pos = { x, y: 0, z };

        const g = new THREE.Group();
        g.position.set(x, 0, z);

        // 选 GLB key
        const glbKey = (BEH_GLB[type.beh] && BEH_GLB[type.beh]())
            || FALLBACK_GLB[Math.floor(Math.random() * FALLBACK_GLB.length)];

        if (window._realModels && window._realModels[glbKey]) {
            try {
                const charG = window._realModels[glbKey].clone(true);
                // 归一尺寸
                const box = new THREE.Box3().setFromObject(charG);
                const size = new THREE.Vector3(); box.getSize(size);
                const s = 1.7 / size.y;
                charG.scale.set(s, s, s);
                const center = new THREE.Vector3(); box.getCenter(center);
                charG.position.set(-center.x * s, -box.min.y * s, -center.z * s);
                charG.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

                // 染色
                const target = new THREE.Color(type.color);
                charG.traverse(c => {
                    if (!c.isMesh || !c.material) return;
                    const matName = (c.material.name) || '';
                    let isCloth = false;
                    if (glbKey === 'char_soldier') {
                        isCloth = /VanguardBodyMat/i.test(matName);
                    } else if (glbKey === 'char_xbot') {
                        isCloth = /Beta_HighLimbsGeoSG2|Beta_HighLimbs/i.test(matName);
                    } else {
                        isCloth = true;
                    }
                    if (isCloth) {
                        c.material = c.material.clone();
                        const cc = c.material.color;
                        if (cc && cc.r !== undefined) {
                            cc.r = target.r; cc.g = target.g; cc.b = target.b;
                        } else {
                            c.material.color = target.clone();
                        }
                    }
                });

                g.add(charG);
                npc.charGroup = charG;

                // 动画 mixer（v6.11.0: 完整 blend tree 注册）
                const src = window._realModelsSrc && window._realModelsSrc[glbKey];
                if (src && src.animations && src.animations.length) {
                    try {
                        const mixer = new THREE.AnimationMixer(charG);
                        const findAnim = (kw) =>
                            src.animations.find(a => a.name && a.name.toLowerCase().includes(kw));
                        // v6.11.0: 复用 Player 的 INTENT_KEYWORDS 逻辑
                        const KWS = {
                            idle:['idle','breath'], walk:['walk','walking'], jog:['jog','run','sprint'],
                            run:['run','sprint','jog'], crouch_idle:['crouch','sitting'],
                            crouch_walk:['crouchwalk','crouch_walk','sneak'],
                            jump:['jump','leap'], falling:['fall','falling'], landing:['land','landing'],
                            death:['death','die'], dance:['dance'],
                            talk:['talk','wave','yes'], wave:['wave','hello'],
                            punch:['punch','hit'], gesture:['gesture','thumbs','yes','no','wave']
                        };
                        const find = (kws) => { for (const kw of kws) { const a = findAnim(kw); if (a) return a; } return null; };
                        const acts = {};
                        for (const [intent, kws] of Object.entries(KWS)) {
                            const clip = find(kws);
                            if (clip) {
                                const a = mixer.clipAction(clip);
                                a.setLoop(THREE.LoopRepeat, Infinity);
                                acts[intent] = a;
                            }
                        }
                        if (!acts.idle) {
                            const fb = src.animations[0];
                            const a = mixer.clipAction(fb);
                            a.setLoop(THREE.LoopRepeat, Infinity);
                            a.play();
                            acts.idle = a;
                        } else {
                            acts.idle.play();
                        }
                        npc.mixer = mixer;
                        npc.acts = acts;
                        // v6.11.0: 实例化 SM
                        if (window.AnimationStateMachine) {
                            npc.sm = new window.AnimationStateMachine(acts, mixer);
                        }
                    } catch (e) { /* ignore anim error */ }
                }
            } catch (e) {
                console.warn('[NPC.spawn] GLB clone 失败，使用兜底胶囊', e);
                NPC._spawnFallback(g, type, npc);
            }
        } else {
            NPC._spawnFallback(g, type, npc);
        }

        npc.mesh = g;
        if (window._npcMixers && npc.mixer) window._npcMixers.push(npc.mixer);
        npcList.push(npc);
        return npc;
    }

    /**
     * 兜底胶囊（GLB 不可用时）
     */
    static _spawnFallback(g, type, npc) {
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.28, 0.7, 4, 12),
            new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.5, metalness: 0.1 })
        );
        body.position.y = 0.9;
        body.castShadow = true;
        g.add(body);
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 12, 8),
            new THREE.MeshStandardMaterial({ color: 0xe8c8a0, roughness: 0.6 })
        );
        head.position.y = 1.65;
        head.castShadow = true;
        g.add(head);
    }

    /**
     * 动画状态机（按 moveSpeed 切 idle/walk/run）
     */
    updateAnim(dt) {
        if (!this.mixer) return;
        if (this.sm) {
            // v6.11.0: 走完整状态机
            const spd = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
            this.sm.update(dt, {
                speed: spd,
                onGround: this.onGround !== false,
                dying: this.health <= 0
            });
        } else if (this.acts) {
            // v6.6 兜底
            this.mixer.update(dt);
            const spd = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
            let target = this.acts.idle;
            if (spd > 6.0) target = this.acts.run;
            else if (spd > 0.4) target = this.acts.walk;
            if (target && this.acts.currentAct !== target) {
                target.reset();
                target.setLoop(THREE.LoopRepeat, Infinity);
                target.fadeIn(0.2);
                target.play();
                if (this.acts.currentAct) this.acts.currentAct.fadeOut(0.2);
                this.acts.currentAct = target;
            }
        }
    }

    /**
     * 全局更新所有 NPC 动画（替代 window._npcMixers 列表遍历）
     */
    static updateAll(dt) {
        for (let i = 0; i < npcList.length; i++) {
            try { npcList[i].updateAnim(dt); } catch (e) {}
        }
    }

    /**
     * 清空 NPC 列表（场景重置时用）
     */
    static clear() {
        npcList = [];
        if (window._npcMixers) window._npcMixers = [];
    }
}
