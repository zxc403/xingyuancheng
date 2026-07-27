    function createMulberry32(seed) {
        let state = seed >>> 0;
        return {
            float() { state |= 0; state = state + 0x6D2B79F5 | 0; let t = Math.imul(state ^ state >>> 15, 1 | state); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; },
            int(min, max) { return Math.floor(this.float() * (max - min + 1)) + min; },
            range(min, max) { return min + this.float() * (max - min); },
            pick(arr) { return arr[this.int(0, arr.length - 1)]; },
            bool(prob) { return this.float() < prob; },
        };
    }

    let _citySeed, rng;

    function seedFromURL() { const m = location.search.match(/[?&]seed=(\d+)/); return m ? parseInt(m[1], 10) : 0; }

    function saveGame() {
        try {
            const data = { version: 2, seed: _citySeed,
                daynight: { elapsed: DAYNIGHT.elapsed },
                weather: { current: WEATHER.current, target: WEATHER.target, progress: WEATHER.progress, cycleTimer: WEATHER.cycleTimer },
                season: { seasonality: SEASON.seasonality, name: SEASON.name },
                player: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch },
                timestamp: Date.now()
            };
            localStorage.setItem('sc4like.save.v1', JSON.stringify(data));
            return true;
        } catch(e) { console.warn('[P12] 存档失败'); return false; }
    }

    function loadSave() {
        try { const r = localStorage.getItem('sc4like.save.v1'); return r ? JSON.parse(r) : null; }
        catch(e) { return null; }
    }

    function restoreState(d) {
        if (!d) return;
        DAYNIGHT.elapsed = d.daynight.elapsed;
        if (d.weather) { WEATHER.current = d.weather.current; WEATHER.target = d.weather.target; WEATHER.progress = d.weather.progress; WEATHER.cycleTimer = d.weather.cycleTimer; }
        if (d.season) { SEASON.seasonality = d.season.seasonality; SEASON.lerpedSeasonality = d.season.seasonality; SEASON.name = d.season.name; }
        if (d.player) { player.x = d.player.x; player.y = d.player.y; player.z = d.player.z; player.yaw = d.player.yaw; player.pitch = d.player.pitch; }
    }

    // ---- 构建世界（P1+P2+P3+P4+P5: 地形 + 路网 + 地块 + 建筑 + 立面/家具/雾） ----
    function buildWorld() {
        // Simplex Noise 地形
        const terrainSize = 500, terrainSeg = 200;
        const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSeg, terrainSeg);
        terrainGeo.rotateX(-Math.PI / 2);
        const pos = terrainGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getY(i);
            pos.setZ(i, getTerrainH(x, z));
        }
        terrainGeo.computeVertexNormals();

        const groundTex = window._realTex && window._realTex['asphalt'];
        let groundMat;
        if (groundTex && groundTex.map) {
            groundMat = new THREE.MeshStandardMaterial({
                map: groundTex.map.copy ? groundTex.map : groundTex.map,
                roughnessMap: groundTex.roughnessMap,
                normalMap: groundTex.normalMap,
                aoMap: groundTex.aoMap,
                normalScale: new THREE.Vector2(1, 1),
                roughness: 0.8,
                metalness: 0.05,
                envMapIntensity: 1.0
            });
            if (groundMat.map && groundMat.map.repeat) groundMat.map.repeat.set(20, 20);
            if (groundMat.roughnessMap && groundMat.roughnessMap.repeat) groundMat.roughnessMap.repeat.set(20, 20);
            if (groundMat.normalMap && groundMat.normalMap.repeat) groundMat.normalMap.repeat.set(20, 20);
            if (groundMat.aoMap && groundMat.aoMap.repeat) groundMat.aoMap.repeat.set(20, 20);
        } else {
            groundMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.85, metalness: 0.05 });
        }
        const terrain = new THREE.Mesh(terrainGeo, groundMat);
        terrain.receiveShadow = true;
        terrain.castShadow = true;
        terrain.name = 'terrain';
        // 备份基础材质参数，供天气系统湿地面使用
        groundMat.userData = groundMat.userData || {};
        groundMat.userData._baseRoughness = groundMat.roughness;
        groundMat.userData._baseEnvIntensity = groundMat.envMapIntensity || 0;
        if (groundMat.color) groundMat.userData._baseColor = groundMat.color.getHex();
        scene.add(terrain);
        window._terrain = terrain;

        // ---- P2: 生成路网 ----
        const segCount = buildRoadNetwork();
        console.log(`[P2] 路网: ${segCount} 段道路`);
        renderRoads();

        // ---- P3: 地块划分 ----
        const plotCount = buildPlots();
        console.log(`[P3] 地块: ${plotCount} 个`);
        renderPlots();

        // ---- P4: 建筑生成 ----
        // P5: 预生成立面纹理
        facadeTextures['A'] = generateFacadeTexture('A');
        facadeTextures['B'] = generateFacadeTexture('B');
        facadeTextures['C'] = generateFacadeTexture('C');
        facadeTextures['D'] = generateFacadeTexture('D');
        // P17: 内饰图集 + 材质模板
        const interiorAtlas = generateInteriorAtlas();
        window._interiorMat = createInteriorMaterial(interiorAtlas);
        const bldCount = buildBuildings();
        console.log(`[P4] 建筑: ${bldCount} 个网格体, P17 内饰窗户: ${window._interiorWindows.length}`);

        // ---- P5: 街道家具 + 雾层 ----
        const furnCount = buildStreetFurniture();
        console.log(`[P5] 街道家具: ${furnCount} 个对象`);

        // ---- P25B: 霓虹招牌 + 双层 Billboard ----
        createNeonSystem();

        setupFog();
        createRainSystem();
        createSplashSystem();
        createLeafSystem();
        createSnowSystem();

        // ---- P10: 行人系统 ----
        spawnPedestrians();
        console.log('[P10] 行人系统已启动');

        // ---- P15: 植被系统 ----
        spawnTrees();

        // ---- P14: 3D音频系统 ----
        initCityAudio();

        // PBR 展示圈 - 测试材质
        if (window._realTex) {
            const texList = ['concrete', 'brick', 'metal', 'rocky', 'plank', 'paving'];
            const cols = [0xcccccc, 0x8b4513, 0x8899aa, 0x887766, 0x8b6914, 0x999999];
            texList.forEach((name, i) => {
                const tex = window._realTex[name];
                if (!tex || !tex.map) return;
                const geo = new THREE.BoxGeometry(3, 3, 3);
                const mat = createMat(tex, cols[i], i === 2 ? 0.8 : 0.05, i === 1 ? 0.6 : 0.4);
                const cube = new THREE.Mesh(geo, mat);
                const px = (i - 2.5) * 5, pz = 20;
                cube.position.set(px, getTerrainH(px, pz) + 1.5, pz);
                cube.castShadow = true;
                cube.receiveShadow = true;
                scene.add(cube);
            });
        }

        // GLB 模型展示（贴地形高度）
        if (window._realModels) {
            const placeG = (key, x, z, ry = 0, scale = 1) => {
                if (window._realModels[key]) {
                    const m = window._realModels[key].clone();
                    m.position.set(x, getTerrainH(x, z), z);
                    m.rotation.y = ry;
                    m.scale.setScalar(scale);
                    scene.add(m);
                }
            };
            placeG('building_city', 30, 30, 0, 1.5);
            placeG('building_block', -30, 30, Math.PI / 4, 0.8);
            placeG('car_mustang', 15, 10, Math.PI / 2, 1.0);
            placeG('pbr_ferrari', -15, 15, -Math.PI / 2, 1.0);
            placeG('pbr_boombox', 25, 10, 0, 1.2);
            placeG('pbr_lantern', -25, 10, 0, 0.8);
            placeG('pbr_dragon', 0, 40, 0, 0.06);
        }

        // 光照参考球
        const refGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const refMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1, envMapIntensity: 1.0 });
        const refBall = new THREE.Mesh(refGeo, refMat);
        const rx = 0, rz = 10;
        refBall.position.set(rx, getTerrainH(rx, rz) + 2, rz);
        refBall.castShadow = true;
        scene.add(refBall);

        // ---- P19: 平面反射 ----
        initReflection();

        // ---- P16: 水体系统 ----
        createWaterSystem();

        // ---- P18: 体积大气 ----
        createAtmosphere();
    }

    // ===== P16: 水体系统 (Gerstner + Schlick Fresnel + 泡沫 + 日夜/季节联动) =====
    // ---- 玩家移动 ----
    function updatePlayer(dt) {
        if (!gameStarted || gamePaused) return;
        const speed = 8;
        let mx = 0, mz = 0;
        if (keys['KeyW'] || keys['ArrowUp']) mz = 1;
        if (keys['KeyS'] || keys['ArrowDown']) mz = -1;
        if (keys['KeyA'] || keys['ArrowLeft']) mx = -1;
        if (keys['KeyD'] || keys['ArrowRight']) mx = 1;
        const len = Math.sqrt(mx * mx + mz * mz);
        if (len > 0) { mx /= len; mz /= len; }
        player.vel.x = (Math.cos(player.yaw) * mz - Math.sin(player.yaw) * mx) * speed;
        player.vel.z = (-Math.sin(player.yaw) * mz - Math.cos(player.yaw) * mx) * speed;
        player.moveSpeed = len * speed;
        player.pos.x += player.vel.x * dt;
        player.pos.z += player.vel.z * dt;
        player.pos.y = getTerrainH(player.pos.x, player.pos.z) + 1.7;
    }

    // ---- 相机更新 ----
    function updateCamera() {
        const tx = player.pos.x - Math.sin(player.yaw) * 8 * Math.cos(player.pitch);
        const tz = player.pos.z - Math.cos(player.yaw) * 8 * Math.cos(player.pitch);
        const ty = player.pos.y + 2.5 + Math.sin(player.pitch) * 8;
        camera.position.lerp(new THREE.Vector3(tx, ty, tz), 0.12);
        camera.lookAt(player.pos.x, player.pos.y + player.height * 0.6, player.pos.z);
    }

    // ===== P14: 3D音频系统（程序化合成，零外部文件） =====
    // ---- 输入 ----
    function initInput() {
        window.addEventListener('keydown', e => { keys[e.code] = true; });
        window.addEventListener('keyup', e => {
            keys[e.code] = false;
            // K 键手动切换天气
            if (e.code === 'KeyK' && !e.repeat) {
                const idx = WEATHER.states.indexOf(WEATHER.target);
                const next = WEATHER.states[(idx + 1) % WEATHER.states.length];
                WEATHER.cycleTimer = 0; // 重置自动循环
                setWeather(next);
                console.log('[P11B] 天气切换至:', next);
            }
            // P12: L 键手动存档
            if (e.code === 'KeyL' && !e.repeat) {
                if (saveGame()) {
                    console.log('[P12] 已手动存档 seed=' + _citySeed);
                    const info = document.getElementById('info');
                    const orig = info.textContent;
                    info.textContent += ' | 💾 已保存';
                    setTimeout(() => { if (info.textContent.endsWith('已保存')) info.textContent = orig; }, 1500);
                }
            }
            // P13: J 键切换季节
            if (e.code === 'KeyJ' && !e.repeat) {
                const offset = SEASON.cycleDays / 4;
                DAYNIGHT.elapsed += offset;
                console.log('[P13] 季节跳转至:', SEASON.name);
                const info = document.getElementById('info');
                if (info) info.textContent = `[J] 跳到 ${SEASON.name}`;
                setTimeout(() => { if (info && info.textContent.startsWith('[J]')) info.textContent = ''; }, 2000);
            }
        });
        document.addEventListener('mousemove', e => {
            if (isPointerLocked && gameStarted) {
                player.yaw -= e.movementX * 0.002;
                player.pitch -= e.movementY * 0.002;
                player.pitch = U.clamp(player.pitch, -1.0, 0.6);
            }
        });
        document.addEventListener('pointerlockchange', () => {
            isPointerLocked = document.pointerLockElement === renderer.domElement;
        });
        window.addEventListener('wheel', e => {
            player.pitch += e.deltaY * 0.0005;
            player.pitch = U.clamp(player.pitch, -1.0, 0.6);
        }, { passive: true });
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (composer) composer.setSize(window.innerWidth, window.innerHeight);
        });
    }


    // ===== P18: 更新大气系统 =====
    function updateAtmosphere(dt) {
        if (window._atmosphere && window._atmosphere.update) {
            window._atmosphere.update(dt);
        }
    }

    // ---- 主循环 ----
    function animate() {
        requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.05);

        if (gameStarted && !gamePaused) {
            updateSeasons(dt);
            updateWeather(dt);
            updateDayNight(dt);
            updatePlayer(dt);
            updatePedestrians(dt);
        }
        updateRainSystem(dt);
        updateSplashSystem(dt);
        updateLeafSystem(dt);
        updateSnowSystem(dt);
        updateTrees(dt);
        updateCityAudio(dt);
        updateWater(dt);
        updateAtmosphere(dt);
        updateNeonSystem(dt);
        updateCamera();

        // P12: 每 30 秒自动存档
        if (!window._autoSaveAcc) window._autoSaveAcc = 0;
        window._autoSaveAcc += dt;
        if (window._autoSaveAcc >= 30 && gameStarted) {
            window._autoSaveAcc = 0;
            saveGame();
        }

        if (window._skyDome) window._skyDome.material.uniforms.uTime.value += dt;

        if (window._film && window._film.uniforms && window._film.uniforms.uTime) {
            window._film.uniforms.uTime.value = clock.elapsedTime;
        }

        // P20B-III: Wet Lens update
        if (window._wetLens) {
            const wp = window._wetLens.uniforms;
            wp.uTime.value = clock.elapsedTime;
            wp.uWetness.value = WEATHER.lerped.wetness || 0;
        }

        // P19: 每帧渲染反射贴图（先于主渲染，确保建筑/天空被镜像相机捕获）
        renderReflection();

        if (composer) composer.render();
        else if (renderer) renderer.render(scene, camera);

        // 显示 FPS + dayness + 天气
        const wName = WEATHER.lerped.rainIntensity > 0.05 ? WEATHER.target : (WEATHER.current !== WEATHER.target ? WEATHER.target : WEATHER.current);
        const seasInfo = `${SEASON.name}`;
        document.getElementById('info').textContent = `v15.5 P25B | FPS: ${Math.round(1/dt)} | ${DAYNIGHT.dayness>0.5?'☀':'🌙'} ${(DAYNIGHT.dayness*100).toFixed(0)}% | ${seasInfo} | ${wName}`;
    }

    // ---- 启动 ----
    async function init() {
        // P12: 种子化 RNG 初始化
        _citySeed = seedFromURL() || ((Date.now() & 0x7FFFFFFF) >>> 0);
        rng = createMulberry32(_citySeed);
        console.log(`[P12] 种子: ${_citySeed}` + (seedFromURL() ? ' (来自URL)' : ' (随机生成)'));

        const isMob = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        if (isMob) {
            document.getElementById('blocker').style.display = 'none';
            gameStarted = true;
            gamePaused = false;
        }

        const lt = document.getElementById('loadText');
        try {
            if (lt) lt.textContent = '初始化引擎...';
            await initEngine();

            if (lt) lt.textContent = '加载 PBR 纹理...';
            const realTex = await loadRealTextures().catch(e => { console.warn('[Init] textures failed', e); return null; });
            window._realTex = realTex;

            if (lt) lt.textContent = '加载 HDR 环境...';
            const realHDR = await Promise.race([
                loadRealHDR().catch(e => { console.warn('[Init] HDR failed', e); return null; }),
                new Promise(res => setTimeout(() => res(null), 30000))
            ]);
            if (realHDR) scene.environment = realHDR;
            window._realHDR = realHDR;

            if (lt) lt.textContent = '加载模型...';
            try { await loadRealModels(); } catch(e) { console.warn('[Init] models failed', e); }

            if (lt) lt.textContent = '构建场景...';
            buildWorld();

        } catch(e) {
            if (lt) lt.textContent = '初始化失败: ' + e.message;
            if (/webgl|context/i.test(e.message||'')) {
                document.getElementById('webglFail').style.display = 'flex';
                document.getElementById('loading').style.display = 'none';
            }
            console.error(e);
            return;
        }

        if (!scene || !player) {
            console.warn('[Init] WebGL 未启动');
            return;
        }

        // P12: 尝试恢复存档状态（同种子才恢复）
        const save = loadSave();
        if (save && save.seed === _citySeed) {
            restoreState(save);
            console.log('[P12] 存档已恢复');
        }

        initInput();

        if (!gameStarted) {
            gameStarted = true;
            gamePaused = false;
        }

        setTimeout(() => document.getElementById('loading').classList.add('hide'), 800);
        clock.start();
        animate();
    }

    // 事件绑定
    document.getElementById('blocker').addEventListener('click', () => {
        if (!gameStarted) {
            document.getElementById('blocker').style.display = 'none';
            gameStarted = true;
            gamePaused = false;
            const isMob = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
            if (!isMob) { try { renderer.domElement.requestPointerLock(); } catch(_) {} }
        }
    });

    setTimeout(() => {
        const isMob = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        if (isMob) return;
        if (!gameStarted && typeof player !== 'undefined' && player && typeof scene !== 'undefined' && scene) {
            document.getElementById('blocker').style.display = 'none';
            gameStarted = true;
            gamePaused = false;
            try { renderer.domElement.requestPointerLock(); } catch(_) {}
        }
    }, 12000);

    init();
    console.log('星渊城 v14.0 P18 体积大气 加载完成');
</script>
</body></html>





