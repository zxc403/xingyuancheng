// src/entities/AvatarCustomization.js
// v6.11.0 (M2.5): 玩家 Avatar 自定义系统
//
// 5 维度自定义：
//   1. 体型（5 档）: slim / standard / muscular / heavy / child
//   2. 身高（连续 0.5-2.5m，默认 1.7）
//   3. 肤色（5 档）: light / tan / brown / dark / pale
//   4. 服装色（5 件 × 6 色）: shirt / pants / shoes / gloves / hat
//   5. 玩家名字（最长 16 字符）
//
// 用法：
//   const avatar = new AvatarCustomization(player, registry);
//   avatar.apply(config);  // 应用配置
//   const cur = avatar.getConfig();  // 读当前
//   avatar.saveToStorage();  // localStorage 持久化
//   avatar.loadFromStorage();  // 恢复
//
// 实现方式：
//   - 体型 / 身高 → mesh.scale
//   - 肤色 → 皮肤材质 color
//   - 服装色 → 各部分材质 color（按注册的 tints 列表）

const THREE = window.THREE;

// 体型预设：影响 mesh.scale.x / .z 和 .y
const BODY_PRESETS = {
    slim:      { x: 0.85, y: 1.0,  z: 0.85, name: '瘦长' },
    standard:  { x: 1.0,  y: 1.0,  z: 1.0,  name: '标准' },
    muscular:  { x: 1.20, y: 1.05, z: 1.20, name: '壮实' },
    heavy:     { x: 1.30, y: 0.95, z: 1.30, name: '魁梧' },
    child:     { x: 0.75, y: 0.65, z: 0.75, name: '少年' }
};

// 肤色预设
const SKIN_PRESETS = {
    light: { color: 0xffd9b3, name: '白皙' },
    tan:   { color: 0xd4a574, name: '古铜' },
    brown: { color: 0x8d5524, name: '棕褐' },
    dark:  { color: 0x5c3a1e, name: '深棕' },
    pale:  { color: 0xf5e6d3, name: '苍白' }
};

// 服装色（6 套预设）
const OUTFIT_PALETTE = {
    red:    0xcc2222,
    blue:   0x2244cc,
    green:  0x22aa44,
    black:  0x222222,
    white:  0xeeeeee,
    gold:   0xddaa22
};

// 默认配置
const DEFAULT_CONFIG = {
    body: 'standard',
    height: 1.7,
    skin: 'tan',
    name: 'Player',
    outfit: {
        shirt: 'blue',
        pants: 'black',
        shoes: 'black',
        gloves: 'black',
        hat: 'red'
    }
};

export class AvatarCustomization {
    /**
     * @param {Player} player
     * @param {object} charDef   CharacterRegistry 条目
     */
    constructor(player, charDef) {
        this.player = player;
        this.charDef = charDef;
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        // 缓存的材质引用（按 tint regex 命中）
        this._matCache = {};
        console.log('[AvatarCustomization] 构造完成，default=', JSON.stringify(this.config));
    }

    /**
     * 应用完整配置
     * @param {object} cfg
     */
    apply(cfg) {
        Object.assign(this.config, cfg);
        if (cfg.outfit) Object.assign(this.config.outfit, cfg.outfit);
        this._applyBody();
        this._applySkin();
        this._applyOutfit();
    }

    /**
     * 应用体型 + 身高
     */
    _applyBody() {
        if (!this.player || !this.player.mesh) return;
        const preset = BODY_PRESETS[this.config.body] || BODY_PRESETS.standard;
        const s = this.config.height / 1.7;  // 1.7m = base
        this.player.mesh.scale.set(preset.x * s, preset.y * s, preset.z * s);
        console.log('[Avatar] 体型 scale=', preset.x * s, preset.y * s, preset.z * s);
    }

    /**
     * 应用肤色（找 charDef.tints 命中的材质）
     */
    _applySkin() {
        if (!this.player || !this.player.mesh || !this.charDef) return;
        const tint = SKIN_PRESETS[this.config.skin];
        if (!tint) return;
        const target = new THREE.Color(tint.color);
        // 默认皮肤材质 regex（不依赖 charDef.tints，因为皮肤没有 tints 标记）
        const SKIN_REGEX = /(skin|body|bodyMat|face|body_skin)/i;
        this.player.mesh.traverse(c => {
            if (!c.isMesh || !c.material) return;
            const matName = (c.material.name) || '';
            if (SKIN_REGEX.test(matName) ||
                (c.material.color && c.material.color.r > 0.7 && c.material.color.g > 0.5 && c.material.color.b < 0.7)) {
                c.material = c.material.clone();
                const cc = c.material.color;
                if (cc && cc.r !== undefined) {
                    // 在原色基础上叠加肤色（60% skin + 40% 原色，避免纹理细节丢失）
                    cc.r = cc.r * 0.4 + target.r * 0.6;
                    cc.g = cc.g * 0.4 + target.g * 0.6;
                    cc.b = cc.b * 0.4 + target.b * 0.6;
                } else {
                    c.material.color = target.clone();
                }
            }
        });
    }

    /**
     * 应用服装色
     */
    _applyOutfit() {
        if (!this.player || !this.player.mesh || !this.charDef) return;
        const tints = this.charDef.tints || [];
        if (!tints.length) return;
        const out = this.config.outfit;
        // 把 charDef.tints 数组按位置映射到 outfit 槽位
        // 约定：第 1 个 tint regex = shirt, 第 2 = pants, 第 3 = shoes, 第 4 = gloves, 第 5 = hat
        const slots = ['shirt', 'pants', 'shoes', 'gloves', 'hat'];
        for (let i = 0; i < tints.length && i < slots.length; i++) {
            const slot = slots[i];
            const colorKey = out[slot];
            const colorVal = OUTFIT_PALETTE[colorKey] || OUTFIT_PALETTE.blue;
            const target = new THREE.Color(colorVal);
            const regex = tints[i];
            this.player.mesh.traverse(c => {
                if (!c.isMesh || !c.material) return;
                const matName = (c.material.name) || '';
                if (regex.test(matName)) {
                    c.material = c.material.clone();
                    const cc = c.material.color;
                    if (cc && cc.r !== undefined) {
                        cc.r = target.r; cc.g = target.g; cc.b = target.b;
                    } else {
                        c.material.color = target.clone();
                    }
                }
            });
        }
    }

    /**
     * 取得当前配置
     */
    getConfig() {
        return JSON.parse(JSON.stringify(this.config));
    }

    /**
     * 修改单个字段
     */
    setBody(preset) { this.config.body = preset; this._applyBody(); }
    setHeight(h) { this.config.height = Math.max(0.5, Math.min(2.5, h)); this._applyBody(); }
    setSkin(preset) { this.config.skin = preset; this._applySkin(); }
    setName(name) { this.config.name = (name || '').slice(0, 16); }
    setOutfit(slot, color) {
        if (this.config.outfit[slot] !== undefined) {
            this.config.outfit[slot] = color;
            this._applyOutfit();
        }
    }

    /**
     * 列出所有可选项（给 UI 用）
     */
    listBodies() { return Object.entries(BODY_PRESETS).map(([k, v]) => ({ key: k, name: v.name })); }
    listSkins()  { return Object.entries(SKIN_PRESETS).map(([k, v]) => ({ key: k, name: v.name, color: v.color })); }
    listOutfitColors() { return Object.entries(OUTFIT_PALETTE).map(([k, v]) => ({ key: k, color: v })); }
    listOutfitSlots() { return Object.keys(this.config.outfit); }

    /**
     * 持久化到 localStorage
     */
    saveToStorage(key = 'avatar_v6_11') {
        try {
            localStorage.setItem(key, JSON.stringify(this.config));
            console.log('[Avatar] saved to', key);
        } catch (e) { console.warn('[Avatar] save failed', e); }
    }

    /**
     * 从 localStorage 读取
     */
    loadFromStorage(key = 'avatar_v6_11') {
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const cfg = JSON.parse(raw);
                this.apply(cfg);
                console.log('[Avatar] loaded from', key);
                return true;
            }
        } catch (e) { console.warn('[Avatar] load failed', e); }
        return false;
    }
}

export { BODY_PRESETS, SKIN_PRESETS, OUTFIT_PALETTE, DEFAULT_CONFIG };

// v6.11.0 (M2.5): 类上挂默认配置 + 列表 API，方便 UI 模块直接取
// 同时保留 export 形态，import 旧代码照常工作
AvatarCustomization.prototype.DEFAULT_CONFIG = DEFAULT_CONFIG;
AvatarCustomization.BODY_PRESETS = BODY_PRESETS;
AvatarCustomization.SKIN_PRESETS = SKIN_PRESETS;
AvatarCustomization.OUTFIT_PALETTE = OUTFIT_PALETTE;
AvatarCustomization.DEFAULT_CONFIG = DEFAULT_CONFIG;
