    function spawnTrees() {
        if (treeMesh) return;

        // 生成纹理图集
        treeAtlas = generateTreeAtlas();
        const mat = new THREE.MeshStandardMaterial({
            map: treeAtlas,
            alphaTest: 0.15,
            side: THREE.DoubleSide,
            roughness: 0.9,
            metalness: 0.0,
            envMapIntensity: 0.3,
            depthWrite: true,
        });

        // 使用一个通用几何体（所有树型共享，缩放补偿差异）
        // 选择阔叶圆形的尺寸作为基准
        const baseType = TREE_TYPES[0];
        const baseGeo = createTreeCrossGeometry(0);

        treeMesh = new THREE.InstancedMesh(baseGeo, mat, TREE_COUNT);
        treeMesh.castShadow = true;
        treeMesh.receiveShadow = true;
        treeMesh.renderOrder = 1;

        const dummy = new THREE.Object3D();
        const treePositions = [];
        const minDist = 6; // 树木最小间距

        function tooClose(x, z) {
            for (const p of treePositions) {
                const d = Math.sqrt((p.x - x) ** 2 + (p.z - z) ** 2);
                if (d < minDist) return true;
            }
            return false;
        }

        let placed = 0;
        const MAX_ATTEMPTS = TREE_COUNT * 4;
        let attempts = 0;

        // 沿道路采样
        const roadEdgeOffset = 5; // 道路边缘到树木的距离
        while (placed < TREE_COUNT && attempts < MAX_ATTEMPTS) {
            attempts++;
            // 随机选一个路段
            const seg = roadSegments.length > 0 ? rng.pick(roadSegments) : null;
            if (!seg) break;

            // 沿路段随机位置
            const t = rng.float();
            const dx = seg.x2 - seg.x1, dz = seg.z2 - seg.z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            if (len < 3) continue;
            const cx = seg.x1 + dx * t, cz = seg.z1 + dz * t;

            // 垂直偏移（左右两侧随机）
            const perpX = -dz / len, perpZ = dx / len;
            const side = rng.bool(0.5) ? 1 : -1;
            const offsetDist = roadEdgeOffset + seg.w / 2 + rng.range(0, 3);
            const tx = cx + perpX * side * offsetDist;
            const tz = cz + perpZ * side * offsetDist;

            // 检查是否在有效范围内
            if (Math.abs(tx) > 200 || Math.abs(tz) > 200) continue;
            if (tooClose(tx, tz)) continue;

            // 检查地形
            const th = getTerrainH(tx, tz);
            // 检查坡度（采样附近点）
            const th2 = getTerrainH(tx + 3, tz);
            const th3 = getTerrainH(tx, tz + 3);
            if (Math.abs(th2 - th) > 2.5 || Math.abs(th3 - th) > 2.5) continue;

            // 避开道路本身
            if (nearRoad(tx, tz, 4)) continue;

            treePositions.push({ x: tx, z: tz });

            const treeType = rng.int(0, TREE_TYPES.length - 1);
            const tp = TREE_TYPES[treeType];
            const scaleVar = 0.7 + rng.float() * 0.6;
            const totalH = (tp.trunkH + tp.canopyH) * scaleVar;

            dummy.position.set(tx, th, tz);
            dummy.rotation.y = rng.float() * Math.PI * 2;
            dummy.scale.set(scaleVar, scaleVar, scaleVar);
            dummy.updateMatrix();
            treeMesh.setMatrixAt(placed, dummy.matrix);

            // 初始季节色
            const sc = new THREE.Color(SEASON.lerped.leafColor);
            treeMesh.setColorAt(placed, sc);

            treeData.push({
                pos: new THREE.Vector3(tx, th, tz),
                scale: scaleVar,
                type: treeType,
                swayPhase: rng.float() * Math.PI * 2,
                swaySpeed: 0.3 + rng.float() * 0.7,
                swayAmp: 0.15 + rng.float() * 0.35,
            });

            placed++;
        }

        console.log(`[P15] 树木: ${placed} 棵, 尝试 ${attempts} 次`);
        treeMesh.count = placed;
        treeMesh.instanceMatrix.needsUpdate = true;
        if (treeMesh.instanceColor) treeMesh.instanceColor.needsUpdate = true;
        scene.add(treeMesh);
        window._treeMesh = treeMesh;
    }

    function updateTrees(dt) {
        if (!treeMesh) return;

        const seasonColor = new THREE.Color(SEASON.lerped.leafColor);
        const isWinter = SEASON.name === 'Winter';
        const winterBlend = isWinter ? Math.min(1, (SEASON.seasonality - 0.65) / 0.15) : 0;
        // 春秋过渡也做轻微缩放
        const autumnBlend = SEASON.name === 'Autumn' ? Math.min(1, Math.abs(SEASON.seasonality - 0.45) / 0.15) : 0;
        const scaleMult = 1.0 - winterBlend * 0.85 - autumnBlend * 0.1; // 冬季缩到15%

        const dummy = new THREE.Object3D();
        const windF = WEATHER.wind.force || new THREE.Vector3(0, 0, 0);
        const windStr = windF.length();

        for (let i = 0; i < treeMesh.count; i++) {
            const td = treeData[i];
            if (!td) continue;

            // 季节颜色
            treeMesh.setColorAt(i, seasonColor);

            // 冬季缩放 + 风摇
            const ss = td.scale * scaleMult;
            dummy.position.copy(td.pos);
            dummy.rotation.y = (td.swayPhase + td.swaySpeed * performance.now() * 0.001) % (Math.PI * 2);
            dummy.scale.set(ss, ss, ss);

            // 简单风摇：沿 X 微倾
            if (windStr > 0.5 && scaleMult > 0.3) {
                const sway = Math.sin(performance.now() * 0.001 * td.swaySpeed * 3 + td.swayPhase) * td.swayAmp * Math.min(windStr / 10, 1);
                dummy.rotation.z = sway * 0.3;
                dummy.rotation.x = sway * 0.2;
            }

            dummy.updateMatrix();
            treeMesh.setMatrixAt(i, dummy.matrix);
        }

        treeMesh.instanceMatrix.needsUpdate = true;
        if (treeMesh.instanceColor) treeMesh.instanceColor.needsUpdate = true;
    }

    // ---- PBR 纹理加载 ----
    async function loadRealTextures() {
        const allSets = ['asphalt', 'forest', 'plank', 'rocky', 'brick', 'concrete', 'metal', 'iron', 'paving'];
        const sets = (window._isMobile) ? ['asphalt', 'plank', 'rocky', 'concrete', 'paving'] : allSets;
        const chMap = {
            diff:  { file: 'color.jpg',     setFn: (t,tex)=>{ t.colorSpace=THREE.SRGBColorSpace; tex.map=t; } },
            nor:   { file: 'normal.jpg',    setFn: (t,tex)=>{ tex.normalMap=t; } },
            rough: { file: 'roughness.jpg', setFn: (t,tex)=>{ tex.roughnessMap=t; } },
            ao:    { file: 'ao.jpg',        setFn: (t,tex)=>{ tex.aoMap=t; } }
        };
        const chs = ['diff', 'nor', 'rough', 'ao'];
        const out = {};
        const _withTimeout = (p, ms) => Promise.race([
            p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
        ]);
        const tasks = [];
        for (const setName of sets) {
            const tex = { map: null, normalMap: null, roughnessMap: null, aoMap: null };
            out[setName] = tex;
            for (const ch of chs) {
                const chDef = chMap[ch];
                tasks.push((async () => {
                    try {
                        const url = `assets/textures/${setName}/${chDef.file}`;
                        const t = await _withTimeout(new THREE.TextureLoader().loadAsync(url), 30000);
                        chDef.setFn(t, tex);
                        t.wrapS = t.wrapT = THREE.RepeatWrapping;
                        t.anisotropy = 8;
                        t.repeat.set(2, 2);
                    } catch (e) {
                        console.warn(`[RealTexture] fallback ${setName}/${ch}`, e && e.message);
                    }
                })());
            }
        }
        await Promise.allSettled(tasks);
        for (const setName of sets) {
            const tex = out[setName];
            if (!tex.map) tex.map = _mkFallbackTex('#888888', setName);
            if (!tex.normalMap) tex.normalMap = _mkFallbackTex('#8080ff', setName);
            if (!tex.roughnessMap) tex.roughnessMap = _mkFallbackTex('#cccccc', setName);
        }
        return out;
    }

    function _mkFallbackTex(color, seed) {
        try {
            const c = document.createElement('canvas');
            c.width = c.height = 64;
            const ctx = c.getContext('2d');
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 64, 64);
            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            return tex;
        } catch(_) { return null; }
    }

    // ---- HDR 加载 ----
    async function loadRealHDR() {
        let currentHDRKey = null;
        const hdrKeys = { day_quarry:1, night_city:1, sunset_hill:1 };
        try {
            const loader = new RGBELoader();
            loader.setDataType(THREE.HalfFloatType);
            for (const key of Object.keys(hdrKeys)) {
                try {
                    const tex = await Promise.race([
                        loader.loadAsync(`assets/hdr/${key}.hdr`),
                        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
                    ]);
                    hdrKeys[key] = tex;
                } catch(e) { delete hdrKeys[key]; }
            }
        } catch(e) { console.warn('[HDR] loader init failed', e); }
        const tex = hdrKeys['day_quarry'] || hdrKeys['sunset_hill'] || Object.values(hdrKeys)[0];
        if (tex) {
            const pmrem = new THREE.PMREMGenerator(renderer);
            pmrem.compileEquirectangularShader();
            const envRT = pmrem.fromEquirectangular(tex);
            tex.dispose();
            pmrem.dispose();
            return envRT.texture;
        }
        return null;
    }

    // ---- GLB 模型加载 ----
    async function loadRealModels() {
        window._realModels = {};
        window._modelErrors = [];
        window._npcMixers = [];
        const loader = GLTFLoader ? new GLTFLoader() : null;
        if (!loader) return;
        if (DRACOLoader) {
            const draco = new DRACOLoader();
            draco.setDecoderPath('./vendor/three/addons/libs/draco/');
            loader.setDRACOLoader(draco);
        }
        if (KTX2Loader && renderer) {
            const ktx2 = new KTX2Loader();
            ktx2.setTranscoderPath('./vendor/three/addons/libs/basis/');
            ktx2.detectSupport(renderer);
            loader.setKTX2Loader(ktx2);
        }
        const modelList = [
            { key:'building_city', url:'assets/models/building_city.glb' },
            { key:'building_block', url:'assets/models/building_block.glb' },
            { key:'car_mustang', url:'assets/models/car_mustang.glb' },
            { key:'car_truck', url:'assets/models/car_truck.glb' },
            { key:'car_minivan', url:'assets/models/car_minivan.glb' },
            { key:'car_dragster', url:'assets/models/car_dragster.glb' },
            { key:'car_bigset', url:'assets/models/car_bigset.glb' },
            { key:'char_barbarian', url:'assets/models/char_barbarian.glb' },
            { key:'char_knight', url:'assets/models/char_knight.glb' },
            { key:'char_mage', url:'assets/models/char_mage.glb' },
            { key:'char_rogue', url:'assets/models/char_rogue.glb' },
            { key:'char_rogue_h', url:'assets/models/char_rogue_h.glb' },
            { key:'pbr_ferrari', url:'assets/models/pbr_ferrari.glb' },
            { key:'pdr_helmet', url:'assets/models/pdr_helmet.glb' },
            { key:'pbr_boombox', url:'assets/models/pbr_boombox.glb' },
            { key:'pbr_lantern', url:'assets/models/pbr_lantern.glb' },
            { key:'pbr_avocado', url:'assets/models/pbr_avocado.glb' },
            { key:'pbr_camera', url:'assets/models/pbr_camera.glb' },
            { key:'pbr_fish', url:'assets/models/pbr_fish.glb' },
            { key:'pbr_car_concept', url:'assets/models/pbr_car_concept.glb' },
            { key:'pbr_dragon', url:'assets/models/pbr_dragon.glb' },
            { key:'pbr_brainstem', url:'assets/models/pbr_brainstem.glb' },
            { key:'pbr_horse', url:'assets/models/pbr_horse.glb' },
            { key:'pbr_flamingo', url:'assets/models/pbr_flamingo.glb' },
            { key:'pbr_stork', url:'assets/models/pbr_stork.glb' },
            { key:'pbr_cesium', url:'assets/models/pbr_cesium.glb' },
            { key:'pbr_tokyo', url:'assets/models/pbr_tokyo.glb' },
            { key:'scene_cyberpunk', url:'assets/models/scene_cyberpunk.glb' },
        ];
        const tasks = modelList.map(item => (async () => {
            try {
                const gltf = await loader.loadAsync(item.url);
                window._realModels[item.key] = gltf.scene;
            } catch(e) {
                window._modelErrors.push({ key: item.key, err: e.message || String(e) });
            }
        })());
        await Promise.allSettled(tasks);
        console.log('[v7.0] Models loaded:', Object.keys(window._realModels).length);
    }

    // ---- 材质帮助函数 ----
    function createMat(tex, color, metal, rough) {
        return new THREE.MeshStandardMaterial({
            map: tex.map, roughnessMap: tex.roughnessMap,
            normalMap: tex.normalMap, aoMap: tex.aoMap,
            normalScale: new THREE.Vector2(0.8, 0.8),
            color: color, metalness: metal, roughness: rough,
            envMapIntensity: 1.0
        });
    }
