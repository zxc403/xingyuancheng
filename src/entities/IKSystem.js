// src/entities/IKSystem.js
// v6.11.0 (M2.6): 角色 IK 系统
//
// 3 大 IK 通道（v6.11.0 仅做简化版本，v6.12 接入 mesh-bvh + 完整 CCDIKSolver）：
//   1. foot（脚部）:    抬脚跟 / 抬脚尖，让角色上坡不穿模
//   2. weapon（武器）:  右手握枪指向目标
//   3. look（视线）:    头部缓慢转向目标（lerp）
//
// 实现策略（v6.11.0 简化版）：
//   - 用射线探测地形高度（window.getTerrainH）
//   - 对脚部：找 charG 里的 left/right foot bone，没有就降级为整体 mesh.position.y 调整
//   - 对武器：找 right hand bone，没有就只旋转 mesh 整体
//   - 对视线：找 head bone，没有就只旋转 mesh 整体
//
// 用法：
//   const ik = new IKSystem(player);
//   ik.update(dt, {
//       targetPos:    vec3,    // 武器指向 / 视线目标
//       terrain:      window.getTerrainH,
//       onGround:     true,
//       inCombat:     true
//   });
//   ik.dispose();

const THREE = window.THREE;

// 通用骨骼名猜测（按 Mixamo 约定）
const BONE_HINTS = {
    pelvis:   ['Hips', 'pelvis', 'Root', 'root', 'Bip01_Pelvis', 'mixamorigHips'],
    l_foot:   ['LeftFoot', 'l_foot', 'L_Foot', 'foot_l', 'mixamorigLeftFoot', 'Bip01_L_Foot'],
    r_foot:   ['RightFoot', 'r_foot', 'R_Foot', 'foot_r', 'mixamorigRightFoot', 'Bip01_R_Foot'],
    l_hand:   ['LeftHand', 'l_hand', 'L_Hand', 'hand_l', 'mixamorigLeftHand', 'Bip01_L_Hand'],
    r_hand:   ['RightHand', 'r_hand', 'R_Hand', 'hand_r', 'mixamorigRightHand', 'Bip01_R_Hand'],
    head:     ['Head', 'head', 'mixamorigHead', 'Bip01_Head']
};

function findBone(charG, key) {
    if (!charG) return null;
    const hints = BONE_HINTS[key] || [];
    let found = null;
    charG.traverse(c => {
        if (found) return;
        if (!c.isBone && !(c.type === 'Bone')) return;
        const n = (c.name || '');
        for (const h of hints) {
            if (n === h || n.toLowerCase() === h.toLowerCase()) {
                found = c;
                return;
            }
        }
    });
    if (found) return found;
    // 退化：按名字包含关键词找 SkinnedMesh 第一个
    charG.traverse(c => {
        if (found) return;
        if (!c.isBone) return;
        const n = (c.name || '').toLowerCase();
        for (const h of hints) {
            if (n.includes(h.toLowerCase())) { found = c; return; }
        }
    });
    return found;
}

export class IKSystem {
    /**
     * @param {Player} player
     */
    constructor(player) {
        this.player = player;
        this.enabled = true;
        this.bones = {};        // { l_foot, r_foot, l_hand, r_hand, head, pelvis }
        this.footOffset = 0;    // 当前左右脚高度差
        this.footTarget = 0;
        this.lookYaw = 0;       // 当前视线偏移
        this.lookTarget = 0;
        this.weaponIK = {       // 武器 IK 当前值
            r_hand: new THREE.Vector3(),
            r_elbow: new THREE.Vector3()
        };
        this._lastTarget = null;
        this._hitRay = new THREE.Raycaster();
        console.log('[IKSystem] 构造完成');
    }

    /**
     * 在 GLB spawn 完成后调用一次，扫描骨骼
     * @param {THREE.Object3D} charG
     */
    bind(charG) {
        this.bones = {
            l_foot: findBone(charG, 'l_foot'),
            r_foot: findBone(charG, 'r_foot'),
            l_hand: findBone(charG, 'l_hand'),
            r_hand: findBone(charG, 'r_hand'),
            head:   findBone(charG, 'head'),
            pelvis: findBone(charG, 'pelvis')
        };
        const found = Object.entries(this.bones).filter(([k, v]) => v).map(([k]) => k);
        console.log('[IKSystem] 骨骼绑定', found.length, '/ 6', found.join(','));
    }

    /**
     * 每帧调用
     * @param {number} dt
     * @param {object} ctx
     *   targetPos   THREE.Vector3   视线 / 武器指向
     *   terrain     function(x,z) -> y   地形高度查询
     *   onGround    bool
     *   inCombat    bool
     *   moving      bool
     */
    update(dt, ctx) {
        if (!this.enabled || !this.player || !this.player.mesh) return;
        const c = ctx || {};
        const t = c.terrain || window.getTerrainH;
        const charG = this.player.mesh;

        // 1. 脚部 IK：探测左右脚下地形高度差
        if (c.onGround !== false && typeof t === 'function') {
            const footSpacing = 0.18;  // 脚尖相对中心 x 偏移
            const px = this.player.pos.x, pz = this.player.pos.z;
            const dir = this.player.yaw;
            const cos = Math.cos(-dir), sin = Math.sin(-dir);
            // 在角色本地坐标系下：l_foot = (-footSpacing, 0, 0.1), r_foot = (+footSpacing, 0, 0.1)
            const lx = px + (-footSpacing * cos - 0.1 * sin);
            const lz = pz + (-footSpacing * sin + 0.1 * cos);
            const rx = px + (footSpacing * cos - 0.1 * sin);
            const rz = pz + (footSpacing * sin + 0.1 * cos);
            const hyL = t(lx, lz) || 0;
            const hyR = t(rx, rz) || 0;
            // 目标：max(hL, hR) - 默认 0
            this.footTarget = Math.max(0, Math.max(hyL, hyR) - 0);
            // 平滑
            this.footOffset += (this.footTarget - this.footOffset) * Math.min(1, dt * 8);
        } else {
            this.footTarget = 0;
            this.footOffset += (0 - this.footOffset) * Math.min(1, dt * 4);
        }

        // 应用到 pelvis / 整体 mesh
        if (this.footOffset > 0.01) {
            if (this.bones.pelvis) {
                this.bones.pelvis.position.y = this.bones.pelvis.userData.ikBaseY != null
                    ? this.bones.pelvis.userData.ikBaseY + this.footOffset
                    : this.footOffset;
                if (this.bones.pelvis.userData.ikBaseY == null) {
                    this.bones.pelvis.userData.ikBaseY = this.bones.pelvis.position.y;
                }
            } else {
                // 退化：调整整个 mesh
                if (charG.userData.ikBaseY == null) charG.userData.ikBaseY = charG.position.y;
                charG.position.y = charG.userData.ikBaseY + this.footOffset;
            }
        }

        // 2. 视线 IK：头部转向目标
        if (c.targetPos && this.bones.head) {
            // 头骨当前世界位置
            const headWorld = new THREE.Vector3();
            this.bones.head.getWorldPosition(headWorld);
            const dx = c.targetPos.x - headWorld.x;
            const dz = c.targetPos.z - headWorld.z;
            // 目标 yaw（相对角色身体）
            const worldYaw = Math.atan2(dx, dz);
            const rel = worldYaw - this.player.yaw;
            this.lookTarget = THREE.MathUtils.clamp(rel, -Math.PI / 3, Math.PI / 3);
        } else {
            this.lookTarget = 0;
        }
        this.lookYaw += (this.lookTarget - this.lookYaw) * Math.min(1, dt * 4);
        if (this.bones.head) {
            this.bones.head.rotation.y = this.lookYaw;
        }

        // 3. 武器 IK：右手指向目标
        if (c.inCombat && c.targetPos && this.bones.r_hand) {
            const handWorld = new THREE.Vector3();
            this.bones.r_hand.getWorldPosition(handWorld);
            const dx = c.targetPos.x - handWorld.x;
            const dy = c.targetPos.y - handWorld.y;
            const dz = c.targetPos.z - handWorld.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;
            // 简化为 r_hand 朝向：仅水平 yaw + 垂直 pitch
            const yaw = Math.atan2(dx, dz);
            const pitch = Math.atan2(dy, dist);
            this.bones.r_hand.rotation.set(0, 0, 0);
            this.bones.r_hand.rotation.y = yaw - this.player.yaw;
            this.bones.r_hand.rotation.x = -pitch;
        }
    }

    dispose() {
        this.player = null;
        this.bones = {};
    }
}
