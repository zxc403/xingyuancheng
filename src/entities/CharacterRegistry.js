// src/entities/CharacterRegistry.js
// v6.11.0: 角色中央注册表
//
// 目的：消除 index.html 里的硬编码角色数组（charList / NPC_GLB），
//       把 18 个 GLB 角色集中到一个可扩展的注册表里。
//       每个角色带：
//         - key     字符串主键（char_xbot / char_robot ...）
//         - url     glb 相对路径
//         - size    归一化身高（米）
//         - tints   可染色的材质名正则列表
//         - clipMap 动画片段关键词映射（idle/walk/run/...）
//         - tags    标签（humanoid / robot / animal / statue）
//         - use     用途（player / npc / ambient / vehicle-drivable）
//         - license 授权（MIT / CC0 / Sketchfab-CC-BY）
//         - source  来源（three.js / Khronos / Quaternius / Mixamo / ...）
//
// 用法：
//   import { CHARACTERS, getChar, listByUse, listByTag } from './CharacterRegistry.js';
//   const charXbot = getChar('char_xbot');
//
// 命名约定：
//   char_*     人形角色（可走路 / 跑 / 站立）
//   prop_*     静态道具（雕像、动物-静止）
//   animal_*   骨骼动画动物
//   robot_*    机器人（有自己的动画名空间）
//
// v6.11.0 注册：18 个角色
//   char_xbot            - Xbot（女性主玩家）
//   char_soldier         - Soldier（男性 / 警察）
//   char_barbarian       - Barbarian（帮派）
//   char_knight          - Knight（骑士）
//   char_mage            - Mage（法师）
//   char_rogue           - Rogue（浪人）
//   char_rogue_h         - Rogue Hooded（兜帽）
//   char_robot           - RobotExpressive（机器人，13 套动画）
//   char_rpm             - ReadyPlayer.me（卡通全身）
//   char_knight_student  - LeePerrySmith（角色测试身体）
//   prop_nefertiti       - 静态雕像（博物馆展品）
//   animal_fox           - Fox（狐狸）
//   animal_horse         - Horse（马）
//   animal_duck          - Duck（鸭子）
//   animal_parrot        - Parrot（鹦鹉）
//   animal_stork         - Stork（鹳）
//   animal_flamingo      - Flamingo（火烈鸟）
//   prop_facecap         - facecap（带 morph target 的头部）
//
// v6.11 计划：再补 11 套 Quaternius CC0 角色（需要 Itch.io 下载，已知 URL 但无法
//            纯 curl 抓，依赖用户/后续 session 触发）。

export const CHARACTERS = {
    // ===== 人形角色（humanoid, 7 套） =====
    char_xbot: {
        key: 'char_xbot',
        url: 'assets/models/characters/Xbot.glb?v=4',
        size: 1.7,
        tints: [/Beta_HighLimbsGeoSG2|Beta_HighLimbs/i],
        clipMap: { idle: ['idle', 'breath'], walk: ['walk', 'walking'], run: ['run', 'jog'] },
        tags: ['humanoid', 'female'],
        use: ['player', 'npc'],
        license: 'MIT',
        source: 'three.js / mrdoob',
        notes: '默认玩家身体。Idle / Walking / Running 都有 additive 姿态。'
    },
    char_soldier: {
        key: 'char_soldier',
        url: 'assets/models/characters/Soldier.glb?v=4',
        size: 1.8,
        tints: [/VanguardBodyMat/i],
        clipMap: { idle: ['Idle'], walk: ['Walk'], run: ['Run'], tpose: ['TPose'] },
        tags: ['humanoid', 'male'],
        use: ['npc'],
        license: 'MIT',
        source: 'three.js / mrdoob',
        notes: 'Idle / Walk / Run / TPose，clip 名首字母大写。'
    },
    char_barbarian: {
        key: 'char_barbarian',
        url: 'assets/models/characters/Barbarian.glb?v=4',
        size: 1.85,
        tints: [/.*/],  // 全部可染
        clipMap: { idle: ['idle', 'breath'], walk: ['walk', 'walking'], run: ['run', 'jog'] },
        tags: ['humanoid', 'male', 'fantasy'],
        use: ['npc'],
        license: 'CC-BY',
        source: 'mixamo/Quaternius',
        notes: 'Quaternius 风格蛮族战士。'
    },
    char_knight: {
        key: 'char_knight',
        url: 'assets/models/characters/Knight.glb?v=4',
        size: 1.85,
        tints: [/.*/],
        clipMap: { idle: ['idle', 'breath'], walk: ['walk', 'walking'], run: ['run', 'jog'] },
        tags: ['humanoid', 'male', 'fantasy'],
        use: ['npc'],
        license: 'CC-BY',
        source: 'mixamo/Quaternius',
        notes: '金属铠甲。'
    },
    char_mage: {
        key: 'char_mage',
        url: 'assets/models/characters/Mage.glb?v=4',
        size: 1.7,
        tints: [/.*/],
        clipMap: { idle: ['idle', 'breath'], walk: ['walk', 'walking'], run: ['run', 'jog'] },
        tags: ['humanoid', 'female', 'fantasy'],
        use: ['npc'],
        license: 'CC-BY',
        source: 'mixamo/Quaternius',
        notes: '法师 / 施法者。'
    },
    char_rogue: {
        key: 'char_rogue',
        url: 'assets/models/characters/Rogue.glb?v=4',
        size: 1.75,
        tints: [/.*/],
        clipMap: { idle: ['idle', 'breath'], walk: ['walk', 'walking'], run: ['run', 'jog'] },
        tags: ['humanoid', 'male', 'fantasy'],
        use: ['npc'],
        license: 'CC-BY',
        source: 'mixamo/Quaternius',
        notes: '浪人 / 盗贼。'
    },
    char_rogue_h: {
        key: 'char_rogue_h',
        url: 'assets/models/characters/Rogue_Hooded.glb?v=4',
        size: 1.75,
        tints: [/.*/],
        clipMap: { idle: ['idle', 'breath'], walk: ['walk', 'walking'], run: ['run', 'jog'] },
        tags: ['humanoid', 'male', 'fantasy', 'hooded'],
        use: ['npc'],
        license: 'CC-BY',
        source: 'mixamo/Quaternius',
        notes: '兜帽版本，用于夜行 NPC。'
    },
    char_robot: {
        key: 'char_robot',
        url: 'assets/models/characters/RobotExpressive.glb?v=4',
        size: 1.7,
        tints: [/.*/],
        // RobotExpressive 13 套：Idle / Walking / Running / Dance / Jump / Death / Sit / StandUp / ThumbsUp / Wave / Yes / No / Punch
        clipMap: {
            idle: ['Idle'],
            walk: ['Walking'],
            run: ['Running'],
            crouch: ['Sitting'],  // 下蹲替代（无专用 crouch）
            jump: ['Jump'],
            dance: ['Dance'],
            talk: ['Wave', 'Yes', 'No'],
            death: ['Death'],
            gesture: ['ThumbsUp', 'Wave', 'Punch']
        },
        tags: ['humanoid', 'robot', 'mech'],
        use: ['npc', 'player-alt'],
        license: 'MIT',
        source: 'three.js / SDL',
        notes: '动作最丰富（13 套）。M2.3 完整 blend tree 时优先扩展它。'
    },
    char_rpm: {
        key: 'char_rpm',
        url: 'assets/models/characters/ReadyPlayer.glb?v=4',
        size: 1.7,
        tints: [/.*/],
        clipMap: { idle: ['idle'], walk: ['walk'], run: ['run'] },
        tags: ['humanoid', 'stylized', 'readyplayer'],
        use: ['npc', 'player-alt'],
        license: 'CC0 / ReadyPlayer.me',
        source: 'readyplayer.me',
        notes: 'ReadyPlayer.me 全身角色（用于 M2.5 Avatar 自定义）。'
    },
    char_knight_student: {
        key: 'char_knight_student',
        url: 'assets/models/characters/LeePerrySmith.glb?v=4',
        size: 1.7,
        tints: [/.*/],
        clipMap: { idle: ['idle'], walk: ['walk'], run: ['run'] },
        tags: ['humanoid', 'rigged', 'reference'],
        use: ['reference', 'test'],
        license: 'CC-BY',
        source: 'three.js',
        notes: 'Lee Perry-Smith 经典角色测试身体。纹理质量高。'
    },

    // ===== 静态道具（prop, 1 套） =====
    prop_nefertiti: {
        key: 'prop_nefertiti',
        url: 'assets/models/characters/Nefertiti.glb?v=4',
        size: 1.5,
        tints: [],
        clipMap: {},
        tags: ['statue', 'museum', 'ancient'],
        use: ['ambient'],
        license: 'CC0',
        source: 'three.js / mpan3',
        notes: '纳芙蒂蒂半身像，固定展品，无动画。'
    },
    prop_facecap: {
        key: 'prop_facecap',
        url: 'assets/models/characters/Facecap.glb?v=4',
        size: 0.3,
        tints: [],
        clipMap: {},
        tags: ['face', 'morph-target'],
        use: ['reference', 'test'],
        license: 'CC-BY',
        source: 'three.js / Josh Robison',
        notes: 'facecap 带 morph target，用于 M2.4 表情系统测试。'
    },

    // ===== 骨骼动画动物（animal, 6 套） =====
    animal_fox: {
        key: 'animal_fox',
        url: 'assets/models/characters/Fox.glb?v=4',
        size: 0.4,
        tints: [],
        clipMap: { idle: ['Survey'], walk: ['Walk'], run: ['Run'] },
        tags: ['animal', 'quadruped'],
        use: ['ambient'],
        license: 'CC0',
        source: 'Khronos / AsoboStudio',
        notes: 'Khronos 招牌狐狸，Survey/Walk/Run 三个 clip。'
    },
    animal_horse: {
        key: 'animal_horse',
        url: 'assets/models/characters/Horse.glb?v=4',
        size: 1.6,
        tints: [],
        clipMap: { idle: ['idle'], walk: ['walk'], run: ['run', 'gallop'] },
        tags: ['animal', 'quadruped', 'rideable'],
        use: ['ambient', 'rideable'],
        license: 'MIT',
        source: 'three.js',
        notes: '未来可作为载具（v6.12+）。'
    },
    animal_duck: {
        key: 'animal_duck',
        url: 'assets/models/characters/Duck.glb?v=4',
        size: 0.25,
        tints: [],
        clipMap: { idle: ['idle'] },
        tags: ['animal', 'aquatic'],
        use: ['ambient'],
        license: 'MIT',
        source: 'three.js',
        notes: '公园池塘鸭子。'
    },
    animal_parrot: {
        key: 'animal_parrot',
        url: 'assets/models/characters/Parrot.glb?v=4',
        size: 0.3,
        tints: [],
        clipMap: { idle: ['idle'], fly: ['fly', 'flap'] },
        tags: ['animal', 'bird'],
        use: ['ambient'],
        license: 'CC-BY',
        source: 'three.js',
        notes: '鹦鹉，idle + fly 动画。'
    },
    animal_stork: {
        key: 'animal_stork',
        url: 'assets/models/characters/Stork.glb?v=4',
        size: 0.8,
        tints: [],
        clipMap: { idle: ['idle'], fly: ['fly'] },
        tags: ['animal', 'bird'],
        use: ['ambient'],
        license: 'CC-BY',
        source: 'three.js',
        notes: '鹳，长腿。'
    },
    animal_flamingo: {
        key: 'animal_flamingo',
        url: 'assets/models/characters/Flamingo.glb?v=4',
        size: 1.0,
        tints: [],
        clipMap: { idle: ['idle'], fly: ['fly'] },
        tags: ['animal', 'bird'],
        use: ['ambient'],
        license: 'CC-BY',
        source: 'three.js',
        notes: '火烈鸟，iconic。'
    }
};

/**
 * 按 key 拿角色定义
 * @param {string} key
 * @returns {object|null}
 */
export function getChar(key) {
    return CHARACTERS[key] || null;
}

/**
 * 按用途筛选（player / npc / ambient / rideable / ...）
 * @param {string} useTag
 * @returns {object[]}
 */
export function listByUse(useTag) {
    return Object.values(CHARACTERS).filter(c => c.use.includes(useTag));
}

/**
 * 按 tag 筛选（humanoid / animal / robot / ...）
 * @param {string} tag
 * @returns {object[]}
 */
export function listByTag(tag) {
    return Object.values(CHARACTERS).filter(c => c.tags.includes(tag));
}

/**
 * 给定一组 keywords（用户想找的特征），返回最匹配的角色 key
 * 用法：suggestKey(['armor', 'humanoid']) → 'char_knight' / 'char_soldier'
 * @param {string[]} keywords
 * @returns {string|null}
 */
export function suggestKey(keywords) {
    if (!Array.isArray(keywords) || !keywords.length) return null;
    const all = Object.values(CHARACTERS);
    let best = null;
    let bestScore = 0;
    for (const c of all) {
        let s = 0;
        for (const kw of keywords) {
            if (c.tags.includes(kw)) s += 2;
            if (c.use.includes(kw)) s += 1;
            if ((c.notes || '').toLowerCase().includes(kw)) s += 1;
        }
        if (s > bestScore) { bestScore = s; best = c.key; }
    }
    return best;
}

/**
 * 把注册表导出为 index.html 兼容的扁平数组 [{ key, url }]
 * 用途：window.__CHAR_LOAD__ = exportLoadList();
 * @returns {{key: string, url: string}[]}
 */
export function exportLoadList() {
    return Object.values(CHARACTERS).map(c => ({ key: c.key, url: c.url }));
}

/**
 * 在 GLTF 的 animations 列表里找最匹配的 clip
 * @param {THREE.AnimationClip[]} animations
 * @param {string} intent  'idle' | 'walk' | 'run' | ...
 * @param {string[]} keywords   该 intent 的候选关键词（来自注册表）
 * @returns {THREE.AnimationClip|null}
 */
export function pickClip(animations, intent, keywords) {
    if (!animations || !animations.length) return null;
    if (!keywords || !keywords.length) keywords = [intent];
    for (const kw of keywords) {
        const m = animations.find(a => a.name && a.name.toLowerCase().includes(kw.toLowerCase()));
        if (m) return m;
    }
    return animations[0];
}

/**
 * 调试输出：打印所有已注册角色
 */
export function dumpRegistry() {
    const out = [];
    out.push('=== CharacterRegistry v6.11.0 ===');
    out.push(`Total: ${Object.keys(CHARACTERS).length} characters`);
    for (const c of Object.values(CHARACTERS)) {
        out.push(`  [${c.key}] ${c.tags.join('/')} use=${c.use.join(',')} src=${c.source}`);
    }
    console.log(out.join('\n'));
    return out.join('\n');
}
