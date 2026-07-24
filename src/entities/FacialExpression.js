// src/entities/FacialExpression.js
// v6.11.0 (M2.4): 面部表情 morph target 系统
//
// facecap.glb 内嵌 50+ morph targets（blendShape1.<name>），本模块：
//   1. 枚举一套语义化"表情"映射（4 套主表情 + N 个子表情）
//   2. 提供 setExpression / blendExpression / listExpressions API
//   3. 暴露给 Player + NPC 使用（让玩家/NPC 可以在动画上层叠表情）
//
// 用法：
//   const face = new FacialExpression(headMesh);
//   face.setExpression('smile', 0.8);  // 立刻设值
//   face.blendExpression('smile', 1.0, 0.3);  // 0.3s 渐变到 1.0
//   face.update(dt);  // 每帧调用（处理渐变）
//
// 4 套主表情（语义化）：
//   - 'neutral'  - 中性
//   - 'happy'    - 高兴（嘴笑 + 眼弯）
//   - 'angry'    - 生气（皱眉 + 咬牙）
//   - 'sad'      - 悲伤（嘴角下 + 眉上抬）
//
// 子表情可单独调节（叠加）：
//   - 'smile' / 'frown' / 'surprise' / 'blink_L' / 'blink_R' / 'mouth_open'
//
// 注：facecap 实际 morph 名称可能与 ARKit 标准略有差异。本模块用启发式
//     关键词匹配：例如 'smile' 会同时驱动 mouthSmile_L / mouthSmile_R / ...

const THREE = window.THREE;

// v6.11.0: 主表情 → morph 关键词组（每个表情 = 多个 morph 的加权和）
const EXPRESSION_PRESETS = {
    neutral: {
        // 中性：所有 morph = 0
        targets: {},
        weight: 1.0
    },
    happy: {
        // 高兴：嘴笑 + 眼弯
        targets: {
            mouthSmile: 0.9,
            mouthSmile_L: 0.7,
            mouthSmile_R: 0.7,
            eyeSquint_L: 0.4,
            eyeSquint_R: 0.4,
            cheekSquint_L: 0.5,
            cheekSquint_R: 0.5,
            browInnerUp: 0.2
        },
        weight: 1.0
    },
    angry: {
        // 生气：皱眉 + 咬牙 + 眼瞪
        targets: {
            browDown_L: 0.8,
            browDown_R: 0.8,
            eyeWide_L: 0.5,
            eyeWide_R: 0.5,
            mouthFrown: 0.5,
            mouthPress_L: 0.4,
            mouthPress_R: 0.4,
            noseSneer_L: 0.3,
            noseSneer_R: 0.3
        },
        weight: 1.0
    },
    sad: {
        // 悲伤：嘴角下 + 眉上抬
        targets: {
            mouthFrown: 0.7,
            mouthFrown_L: 0.5,
            mouthFrown_R: 0.5,
            browInnerUp: 0.7,
            eyeSquint_L: 0.3,
            eyeSquint_R: 0.3
        },
        weight: 1.0
    },
    surprise: {
        // 惊讶：眼睁大 + 嘴张开 + 眉抬高
        targets: {
            eyeWide_L: 0.9,
            eyeWide_R: 0.9,
            browOuterUp_L: 0.7,
            browOuterUp_R: 0.7,
            mouthOpen: 0.6,
            jawOpen: 0.5
        },
        weight: 1.0
    },
    fear: {
        // 恐惧：眉上 + 眼睁 + 嘴紧张
        targets: {
            browInnerUp: 0.8,
            browOuterUp_L: 0.5,
            browOuterUp_R: 0.5,
            eyeWide_L: 0.7,
            eyeWide_R: 0.7,
            mouthStretch_L: 0.4,
            mouthStretch_R: 0.4
        },
        weight: 1.0
    },
    disgust: {
        // 厌恶：鼻皱 + 上唇提
        targets: {
            noseSneer_L: 0.6,
            noseSneer_R: 0.6,
            mouthFrown: 0.4,
            upperLipRaise_L: 0.5,
            upperLipRaise_R: 0.5
        },
        weight: 1.0
    },
    talk: {
        // 说话：mouthOpen 中等 + 轻微运动
        targets: {
            mouthOpen: 0.3,
            mouthSmile_L: 0.2,
            mouthSmile_R: 0.2
        },
        weight: 1.0
    }
};

/**
 * 子表情（单 morph）关键词（用于叠加）
 */
const SUB_EXPRESSIONS = {
    blink_L:  ['eyeBlink_L', 'blink_L'],
    blink_R:  ['eyeBlink_R', 'blink_R'],
    blink:    ['eyeBlink_L', 'eyeBlink_R', 'blink_L', 'blink_R'],
    smile:    ['mouthSmile', 'mouthSmile_L', 'mouthSmile_R'],
    frown:    ['mouthFrown', 'mouthFrown_L', 'mouthFrown_R'],
    mouthOpen:['mouthOpen', 'jawOpen'],
    lookLeft: ['eyeLookOut_L', 'eyeLookIn_R'],
    lookRight:['eyeLookIn_L', 'eyeLookOut_R'],
    lookUp:   ['eyeLookUp_L', 'eyeLookUp_R'],
    lookDown: ['eyeLookDown_L', 'eyeLookDown_R']
};

export class FacialExpression {
    /**
     * @param {THREE.Mesh} headMesh   头 mesh（含 morphTargetInfluences / morphTargetDictionary）
     */
    constructor(headMesh) {
        this.head = headMesh;
        this.dict = headMesh && headMesh.morphTargetDictionary ? headMesh.morphTargetDictionary : null;
        this.influences = headMesh && headMesh.morphTargetInfluences ? headMesh.morphTargetInfluences : null;
        // 当前每个 morph 的"目标值"（用于渐变）
        this.targetValues = {};
        // 当前每个 morph 的"当前值"（实际写入 influences）
        this.currentValues = {};
        // 渐变任务列表
        this.animations = [];
        // 找到的 morph 缓存：关键词 → index
        this.morphIndex = {};
        this._buildMorphIndex();
        console.log('[FacialExpression] 构造完成，morph 数量=', this.dict ? Object.keys(this.dict).length : 0);
    }

    /**
     * 构建 morph 关键词 → index 映射（模糊匹配）
     * 形如 blendShape1.mouthSmile_L → index
     */
    _buildMorphIndex() {
        if (!this.dict) return;
        for (const [name, idx] of Object.entries(this.dict)) {
            // 标准化名字：去掉 'blendShape1.' 前缀，转小写
            const norm = name.replace(/^blendShape\d+\./i, '').toLowerCase();
            this.morphIndex[norm] = idx;
            this.currentValues[idx] = 0;
            this.targetValues[idx] = 0;
        }
    }

    /**
     * 找到第一个匹配的 morph index
     * @param {string[]} keywords
     * @returns {number} -1 = 未找到
     */
    findMorph(keywords) {
        for (const kw of keywords) {
            const lk = kw.toLowerCase();
            if (lk in this.morphIndex) return this.morphIndex[lk];
            // 子串匹配（fallback）
            for (const [name, idx] of Object.entries(this.morphIndex)) {
                if (name.includes(lk)) return idx;
            }
        }
        return -1;
    }

    /**
     * 设置表情（立刻设置）
     * @param {string} name  'happy' / 'angry' / 'sad' / 'surprise' / ...
     */
    setExpression(name) {
        const preset = EXPRESSION_PRESETS[name];
        if (!preset) {
            console.warn('[FacialExpression] 未知表情:', name);
            return;
        }
        // 重置所有 morph 为 0
        for (const idx of Object.keys(this.currentValues)) {
            this.currentValues[idx] = 0;
            this.targetValues[idx] = 0;
        }
        // 应用 preset
        for (const [morphKey, value] of Object.entries(preset.targets)) {
            const idx = this.findMorph([morphKey]);
            if (idx >= 0) {
                this.currentValues[idx] = value * preset.weight;
                this.targetValues[idx] = this.currentValues[idx];
            }
        }
        this._writeInfluences();
    }

    /**
     * 渐变到目标表情
     * @param {string} name
     * @param {number} duration  秒
     */
    blendExpression(name, duration = 0.3) {
        const preset = EXPRESSION_PRESETS[name];
        if (!preset) return;
        // 计算目标值
        const goal = {};
        for (const [morphKey, value] of Object.entries(preset.targets)) {
            const idx = this.findMorph([morphKey]);
            if (idx >= 0) goal[idx] = value * preset.weight;
        }
        // 添加渐变任务
        this.animations.push({
            goal,
            duration,
            elapsed: 0
        });
    }

    /**
     * 触发一次性表情（子表情，叠加）
     * @param {string} subName   'blink' / 'smile' / 'mouthOpen' ...
     * @param {number} value     0-1
     * @param {number} duration  秒
     */
    triggerSub(subName, value = 1.0, duration = 0.15) {
        const kws = SUB_EXPRESSIONS[subName];
        if (!kws) return;
        const goal = {};
        for (const kw of kws) {
            const idx = this.findMorph([kw]);
            if (idx >= 0) goal[idx] = value;
        }
        // 单次：达到峰值后回 0
        this.animations.push({
            goal,
            duration: duration * 2,
            elapsed: 0,
            peak: value,
            peakAt: duration  // peak 在 duration 秒达到
        });
    }

    /**
     * 每帧更新
     * @param {number} dt
     */
    update(dt) {
        if (!this.animations.length) return;
        const remaining = [];
        for (const anim of this.animations) {
            anim.elapsed += dt;
            const t = Math.min(anim.elapsed / anim.duration, 1.0);
            if (anim.peakAt) {
                // 一次性：先升后降
                const tPeak = anim.peakAt / anim.duration;
                let v;
                if (t < tPeak) {
                    v = anim.peak * (t / tPeak);
                } else {
                    v = anim.peak * (1 - (t - tPeak) / (1 - tPeak));
                }
                for (const idxStr of Object.keys(anim.goal)) {
                    const idx = parseInt(idxStr);
                    this.currentValues[idx] = v;
                }
            } else {
                // 持续渐变到 goal
                for (const idxStr of Object.keys(anim.goal)) {
                    const idx = parseInt(idxStr);
                    const from = this.currentValues[idx] || 0;
                    const to = anim.goal[idx];
                    this.currentValues[idx] = from + (to - from) * t;
                }
            }
            if (t < 1.0) remaining.push(anim);
        }
        this.animations = remaining;
        this._writeInfluences();
    }

    /**
     * 把 currentValues 写入 mesh.morphTargetInfluences
     */
    _writeInfluences() {
        if (!this.influences) return;
        for (const [idxStr, value] of Object.entries(this.currentValues)) {
            const idx = parseInt(idxStr);
            if (idx >= 0 && idx < this.influences.length) {
                this.influences[idx] = value;
            }
        }
    }

    /**
     * 列举所有可用的 morph 名
     */
    listMorphs() {
        return Object.keys(this.morphIndex);
    }

    /**
     * 列举所有预设表情
     */
    listExpressions() {
        return Object.keys(EXPRESSION_PRESETS);
    }
}

export { EXPRESSION_PRESETS, SUB_EXPRESSIONS };
