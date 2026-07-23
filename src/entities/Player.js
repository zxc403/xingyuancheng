// src/entities/Player.js
// v6.10.3: 抽离 Player 实体 - 玩家模型/动画状态机/逻辑入口
//
// 设计思路：Player 类封装所有"玩家相关"逻辑。
// index.html 中的 updatePlayer 是个大函数（300+ 行），本类只接管
// 可独立工作的部分：createPlayerMesh / updatePlayerAnim / updateFootsteps
// 完整的 updatePlayer（含物理/碰撞/载具切换）仍在 index.html 老代码中。
//
// 接口：
//   player.spawn(scene)         - 创建玩家 GLB 身体
//   player.updateAnim(dt)       - 动画状态机（idle/walk/run）
//   player.getMesh()            - 拿到 mesh（给相机/AI 用）

const THREE = window.THREE;  // 复用 index.html 已 import 的 THREE

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

            // 动画 mixer
            const src = window._realModelsSrc && window._realModelsSrc[key];
            if (src && src.animations && src.animations.length) {
                this.mixer = new THREE.AnimationMixer(charG);
                const findAnim = (kw) =>
                    src.animations.find(a => a.name && a.name.toLowerCase().includes(kw));
                const idle = findAnim('idle') || findAnim('breath') || src.animations[0];
                const walk = findAnim('walk') || findAnim('walking') || idle;
                const run  = findAnim('run')  || findAnim('jog')   || walk;
                const aI = this.mixer.clipAction(idle); aI.setLoop(THREE.LoopRepeat, Infinity);
                const aW = this.mixer.clipAction(walk); aW.setLoop(THREE.LoopRepeat, Infinity);
                const aR = this.mixer.clipAction(run);  aR.setLoop(THREE.LoopRepeat, Infinity);
                aI.play();
                this.acts = { idle: aI, walk: aW, run: aR, currentAct: aI };
            }

            this.mesh = charG;
            if (scene) scene.add(charG);
            console.log('[Player.spawn] 玩家 GLB 注入完成', key,
                'animations:', src && src.animations && src.animations.length);
        } catch (e) {
            console.warn('[Player.spawn] 失败，使用胶囊', e);
            this._spawnFallback(scene);
        }
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
     * 动画状态机（idle / walk / run）
     * @param {number} dt
     */
    updateAnim(dt) {
        if (!this.mixer || !this.acts) return;
        this.mixer.update(dt);
        const spd = this.moveSpeed || 0;
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
