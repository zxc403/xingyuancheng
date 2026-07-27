    // ===== P11B: 天气系统 =====
    const WEATHER = {
        states: ['Clear','Overcast','Drizzle','Rain','HeavyRain','Thunderstorm'],
        current: 'Clear',
        target: 'Clear',
        progress: 1.0,
        transitionSpeed: 0.25,
        profiles: {
            Clear:       { cloudCover:0.20,rainIntensity:0,  fogBoost:0,   skyDarken:0,   wetness:0,   lightningFreq:0 },
            Overcast:    { cloudCover:0.85,rainIntensity:0,  fogBoost:0.10,skyDarken:0.25,wetness:0,   lightningFreq:0 },
            Drizzle:     { cloudCover:0.90,rainIntensity:0.25,fogBoost:0.25,skyDarken:0.35,wetness:0.35,lightningFreq:0 },
            Rain:        { cloudCover:0.95,rainIntensity:0.60,fogBoost:0.50,skyDarken:0.55,wetness:0.70,lightningFreq:0 },
            HeavyRain:   { cloudCover:1.00,rainIntensity:1.00,fogBoost:0.80,skyDarken:0.75,wetness:1.00,lightningFreq:0.05 },
            Thunderstorm:{ cloudCover:1.00,rainIntensity:0.85,fogBoost:0.95,skyDarken:0.85,wetness:1.00,lightningFreq:1.00 }
        },
        lerped: { cloudCover:0.20,rainIntensity:0,fogBoost:0,skyDarken:0,wetness:0,lightningFreq:0,windSpeed:0 },
        wind: { dir: new THREE.Vector3(1,0,0.3).normalize(), baseSpeed:5, gust:0, time:0, force: new THREE.Vector3(1,0,0) },
        timeSinceBolt: 0,
        nextBoltIn: 10,
        cycleTimer: 0,
        cycleIdx: 0,
        cycleOrder: ['Clear','Overcast','Drizzle','Rain','HeavyRain','Thunderstorm','HeavyRain','Rain','Drizzle','Overcast']
    };

    // ===== P13: 季节系统 =====
    const SEASON = {
        names: ['Spring','Summer','Autumn','Winter'],
        name: 'Spring',
        seasonality: 0.0,      // 0=mid-spring, 0.25=mid-summer, 0.5=mid-autumn, 0.75=mid-winter
        cycleDays: 300.0,      // 完整一年 = 300 秒（~5分钟）
        transitionSpeed: 0.8,  // 颜色/效果 lerp 速度
        lerpedSeasonality: 0.0,
        profiles: {
            Spring: { groundTint:0x5a6e3a, skySaturation:0.85, fogHue:0x8a9e7a, leafColor:0x7eb546, tempBias:0.0, snowAmount:0, leafAmount:0.1 },
            Summer: { groundTint:0x4a6e2a, skySaturation:1.00, fogHue:0x9ab888, leafColor:0x3d6b20, tempBias:+0.15, snowAmount:0, leafAmount:0 },
            Autumn: { groundTint:0x6e5a2a, skySaturation:0.65, fogHue:0xb89a6a, leafColor:0xd4902a, tempBias:-0.05, snowAmount:0, leafAmount:0.4 },
            Winter:  { groundTint:0x7a8a9a, skySaturation:0.40, fogHue:0x8899aa, leafColor:0x6a6a6a, tempBias:-0.30, snowAmount:0.6, leafAmount:0 }
        },
        lerped: { groundTint:0x5a6e3a, skySaturation:0.85, fogHue:0x8a9e7a, leafColor:0x7eb546, tempBias:0.0, snowAmount:0, leafAmount:0.1 }
    };

    function updateSeasons(dt) {
        // seasonality 正弦波形
        SEASON.seasonality = (DAYNIGHT.elapsed % SEASON.cycleDays) / SEASON.cycleDays;
        SEASON.lerpedSeasonality += (SEASON.seasonality - SEASON.lerpedSeasonality) * Math.min(1, dt * SEASON.transitionSpeed);

        // 确定当前季名
        const s = SEASON.seasonality;
        let idx = Math.floor(s * 4) % 4;
        SEASON.name = SEASON.names[idx];

        // lerp 季节效果
        const keys = ['groundTint','skySaturation','fogHue','leafColor','tempBias','snowAmount','leafAmount'];
        // 用正弦插值平滑跨季节过渡
        const phase = s * 4; // 0-4 映射到四季段
        const seg = phase % 1;
        const smooth = seg < 0.5 ? 2*seg*seg : 1 - Math.pow(-2*seg + 2, 2)/2; // ease-in-out

        const from = SEASON.profiles[SEASON.names[Math.floor(phase) % 4]];
        const to = SEASON.profiles[SEASON.names[(Math.floor(phase) + 1) % 4]];
        for (const k of keys) {
            SEASON.lerped[k] = from[k] + (to[k] - from[k]) * smooth;
        }
    }

    function setWeather(state) {
        if (!WEATHER.states.includes(state)) return;
        if (WEATHER.target === state && WEATHER.progress >= 1) return;
        WEATHER.current = WEATHER.target;
        WEATHER.target = state;
        WEATHER.progress = 0;
        if (WEATHER.progress >= 1) {
            for (const k of Object.keys(WEATHER.lerped)) WEATHER.lerped[k] = WEATHER.profiles[WEATHER.current][k];
        }
    }

    function updateWeather(dt) {
        if (WEATHER.progress < 1) {
            WEATHER.progress = Math.min(1, WEATHER.progress + dt * WEATHER.transitionSpeed);
            const from = WEATHER.profiles[WEATHER.current];
            const to = WEATHER.profiles[WEATHER.target];
            for (const k of Object.keys(WEATHER.lerped)) {
                WEATHER.lerped[k] = from[k] + (to[k] - from[k]) * WEATHER.progress;
            }
            if (WEATHER.progress >= 1) WEATHER.current = WEATHER.target;
        }
        // 风
        WEATHER.wind.time += dt;
        WEATHER.wind.gust = (Math.sin(WEATHER.wind.time * 0.7) * 0.5 + 0.5) * WEATHER.wind.baseSpeed * 0.6;
        const spd = WEATHER.wind.baseSpeed + WEATHER.wind.gust;
        WEATHER.wind.force = WEATHER.wind.dir.clone().multiplyScalar(spd);
        // P1修复：风力归一化到0-1，存入lerped.windSpeed供音频系统使用
        // baseSpeed=5→≈0.33，gust最大→baseSpeed*1.6=8→≈0.53，极端可达0.7+
        WEATHER.lerped.windSpeed = Math.min(1, spd / 15);

        // 自动循环（每 30 秒切换，受季节影响概率偏向）
        WEATHER.cycleTimer += dt;
        if (WEATHER.cycleTimer > 30 && WEATHER.progress >= 1) {
            WEATHER.cycleTimer = 0;
            
            // 季节偏向：tempBias 正→更多雷雨概率，负→更多阴云雪
            const tb = SEASON.lerped.tempBias;
            const roll = Math.random();
            let targetState;
            if (tb > 0.05 && roll < tb * 0.4) {
                targetState = roll < tb * 0.15 ? 'Thunderstorm' : (roll < tb * 0.25 ? 'HeavyRain' : 'Rain');
            } else if (tb < -0.05 && roll < -tb * 0.5) {
                targetState = 'Overcast';
            } else {
                WEATHER.cycleIdx = (WEATHER.cycleIdx + 1) % WEATHER.cycleOrder.length;
                targetState = WEATHER.cycleOrder[WEATHER.cycleIdx];
            }
            setWeather(targetState);
        }

        // 闪电计时
        WEATHER.timeSinceBolt += dt;
        const lf = WEATHER.lerped.lightningFreq;
        if (lf > 0.01 && WEATHER.timeSinceBolt > WEATHER.nextBoltIn && WEATHER.progress >= 0.5) {
            WEATHER.timeSinceBolt = 0;
            WEATHER.nextBoltIn = 3 + Math.random() * (12 / lf);
            triggerLightning();
        }
    }

    // ---- 闪电 ----
    let boltLine = null, boltGlow = null, boltLight = null;
    function generateBolt(start, end, displace, branches) {
        const pts = [start.clone(), end.clone()];
        function recurse(a, b, d, depth) {
            if (depth <= 0) return;
            const mid = a.clone().add(b).multiplyScalar(0.5);
            const perp = new THREE.Vector3(-(b.z-a.z), 0, b.x-a.x).normalize();
            mid.x += perp.x * (Math.random()-0.5) * d * 2;
            mid.z += perp.z * (Math.random()-0.5) * d * 2;
            mid.y += (Math.random()-0.4) * d;
            pts.splice(pts.indexOf(b), 0, mid);
            const nd = d * 0.55;
            recurse(a, mid, nd, depth-1);
            recurse(mid, b, nd, depth-1);
            // 分支
            if (Math.random() < 0.3 && depth > 1 && branches) {
                const branchEnd = mid.clone();
                branchEnd.x += (Math.random()-0.5) * d * 3;
                branchEnd.z += (Math.random()-0.5) * d * 3;
                branchEnd.y -= Math.random() * d * 0.8;
                pts.push(branchEnd);
                recurse(mid, branchEnd, nd*0.7, depth-2);
            }
        }
        recurse(start, end, displace, 5);
        return pts;
    }

    function triggerLightning() {
        if (!scene) return;
        // 清理旧闪电
        if (boltLine) { scene.remove(boltLine); boltLine.geometry.dispose(); boltLine.material.dispose(); boltLine=null; }
        if (boltGlow) { scene.remove(boltGlow); boltGlow.geometry.dispose(); boltGlow.material.dispose(); boltGlow=null; }

        const cpos = camera ? camera.position : new THREE.Vector3(0,30,0);
        const angle = Math.random()*Math.PI*2;
        const dist = 40 + Math.random()*80;
        const sx = cpos.x + Math.cos(angle)*dist;
        const sz = cpos.z + Math.sin(angle)*dist;
        const sy = 50 + Math.random()*30;
        const ey = getTerrainH(sx, sz) + 0.5;
        const start = new THREE.Vector3(sx, sy, sz);
        const end = new THREE.Vector3(sx, ey, sz);
        const pts = generateBolt(start, end, 25, true);

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        boltLine = new THREE.Line(geo, new THREE.LineBasicMaterial({color:0xccddff, transparent:true, opacity:0.9, depthWrite:false}));
        scene.add(boltLine);

        const glowGeo = new THREE.BufferGeometry().setFromPoints(pts);
        boltGlow = new THREE.Line(glowGeo, new THREE.LineBasicMaterial({color:0xaaccff, transparent:true, opacity:0.3, linewidth:1, depthWrite:false}));
        boltGlow.scale.set(1.3, 1.3, 1.3);
        scene.add(boltGlow);

        // 闪光点光源
        if (!boltLight) {
            boltLight = new THREE.PointLight(0xddeeff, 0, 200);
            scene.add(boltLight);
            window._boltLight = boltLight;
        }
        const midPt = pts[Math.floor(pts.length/2)];
        boltLight.position.copy(midPt);
        boltLight.intensity = 80;

        // SkyDome 闪白
        if (window._skyDome) {
            const origSun = window._skyDome.material.uniforms.uSunColor.value.getHex();
            window._skyDome.material.uniforms.uSunColor.value.set(0xffffff);
            setTimeout(() => {
                if (window._skyDome) window._skyDome.material.uniforms.uSunColor.value.setHex(origSun);
            }, 80);
        }

        // 闪电衰减
        const decayStart = performance.now();
        function decayBolt() {
            const elapsed = (performance.now() - decayStart) / 1000;
            const fade = Math.max(0, 1 - elapsed * 3);
            if (boltLine) boltLine.material.opacity = fade * 0.9;
            if (boltGlow) boltGlow.material.opacity = fade * 0.3;
            if (boltLight) boltLight.intensity = 80 * fade;
            if (elapsed < 0.35) { requestAnimationFrame(decayBolt); }
            else {
                if (boltLine) { scene.remove(boltLine); boltLine.geometry.dispose(); boltLine.material.dispose(); boltLine=null; }
                if (boltGlow) { scene.remove(boltGlow); boltGlow.geometry.dispose(); boltGlow.material.dispose(); boltGlow=null; }
                if (boltLight) boltLight.intensity = 0;
            }
        }
        requestAnimationFrame(decayBolt);

        // P1修复：雷声音画同步 — 由 triggerLightning() 统一触发
        // 延迟 0.8-2.3 秒模拟声速传播（每340m/s，闪电20-80m外）
        const thunderDelay = 0.8 + Math.random() * 1.5;
        setTimeout(() => _playThunder(), thunderDelay * 1000);
    }

    // ---- P20B: 雨系统 (CK42BB 升级, 50K LineSegments) ----
    let rainMesh = null;
    const RAIN_COUNT_MOBILE = 20000;
    const RAIN_COUNT_DESKTOP = 50000;

    function createRainSystem() {
        if (rainMesh) return;
        const count = isMobile ? RAIN_COUNT_MOBILE : RAIN_COUNT_DESKTOP;
        const spawnW = 56, spawnH = 34;
        const vertices = count * 2;
        const positions = new Float32Array(vertices * 3);
        const seeds = new Float32Array(vertices * 2);

        for (let i = 0; i < count; i++) {
            const x = rng.range(-spawnW, spawnW);
            const y = rng.float() * spawnH;
            const z = rng.range(-spawnW, spawnW);
            const seed = rng.float();
            const phase = rng.float() * Math.PI * 2;
            const i6 = i * 6;
            // both vertices share base position; VS distinguishes top/bottom via gl_VertexID
            positions[i6]=x; positions[i6+1]=y; positions[i6+2]=z;
            positions[i6+3]=x; positions[i6+4]=y; positions[i6+5]=z;
            const i4 = i * 4;
            seeds[i4]=seed; seeds[i4+1]=phase;
            seeds[i4+2]=seed; seeds[i4+3]=phase;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: {value:0}, uIntensity: {value:0}, uWind: {value:new THREE.Vector3()},
                uGravity: {value:-20}, uSpawnH: {value:spawnH}, uSpawnW: {value:spawnW},
                uDropLength: {value:0.35}, uOpacity: {value:0.5},
                uColor: {value:new THREE.Color(0.72,0.80,0.95)},
                uCameraPos: {value:new THREE.Vector3()}
            },
            vertexShader: `
                attribute vec2 aSeed;
                uniform float uTime, uIntensity, uGravity, uSpawnH, uSpawnW, uDropLength, uOpacity;
                uniform vec3 uWind, uCameraPos;
                varying float vAlpha;
                void main() {
                    float seed = aSeed.x, phase = aSeed.y;
                    float isTip = float(gl_VertexID & 1);
                    float speed = (0.45 + seed * 0.55) * abs(uGravity) * max(uIntensity, 0.001);
                    float cycleTime = uSpawnH / speed;
                    float t = mod(uTime + phase * cycleTime * 0.3, cycleTime) / cycleTime;
                    float fallY = uSpawnH - t * uSpawnH;
                    float newY = fallY - isTip * uDropLength;
                    float windX = uWind.x * t * 0.65 + uWind.z * t * 0.2 * seed;
                    float windZ = uWind.z * t * 0.65 - uWind.x * t * 0.2 * seed;
                    vec3 pos = vec3(position.x + windX, newY, position.z + windZ);
                    pos.xz += uCameraPos.xz;
                    vAlpha = smoothstep(0.0, 0.04, t) * smoothstep(1.0, 0.82, t) * uIntensity * uOpacity;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;
                void main() {
                    gl_FragColor = vec4(uColor, vAlpha);
                }
            `,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
        rainMesh = new THREE.LineSegments(geo, mat);
        rainMesh.frustumCulled = false;
        rainMesh.renderOrder = 1;
        scene.add(rainMesh);
        window._rainMesh = rainMesh;
    }

    function updateRainSystem(dt) {
        if (!rainMesh) return;
        const m = rainMesh.material;
        const intensity = WEATHER.lerped.rainIntensity;
        m.uniforms.uTime.value += dt;
        m.uniforms.uIntensity.value = intensity;
        m.uniforms.uWind.value.copy(WEATHER.wind.force || WEATHER.wind.dir);
        m.uniforms.uDropLength.value = 0.3 + intensity * 0.45;
        m.uniforms.uOpacity.value = 0.4 + intensity * 0.4;
        if (camera) m.uniforms.uCameraPos.value.copy(camera.position);
        rainMesh.visible = intensity > 0.03;
    }

    // ---- P20B-II: Splash 地面水花 (InstancedMesh ring pool) ----
    let splashMesh = null;
    const SPLASH_MAX = 500;
    const SPLASH_LIFETIME = 0.28;
    let splashData = [];

    function createSplashSystem() {
        if (splashMesh) return;
        const ringGeo = new THREE.RingGeometry(0.25, 0.38, 16);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xccddff,
            transparent: true, opacity: 0.38,
            side: THREE.DoubleSide, depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        splashMesh = new THREE.InstancedMesh(ringGeo, mat, SPLASH_MAX);
        splashMesh.frustumCulled = false;
        splashMesh.renderOrder = 2;
        splashMesh.count = SPLASH_MAX;

        const dummy = new THREE.Object3D();
        dummy.position.set(0, -999, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        for (let i = 0; i < SPLASH_MAX; i++) {
            splashMesh.setMatrixAt(i, dummy.matrix);
        }
        splashMesh.instanceMatrix.needsUpdate = true;

        splashData = new Array(SPLASH_MAX).fill(null).map(() => ({ life: 0, maxLife: 0, x: 0, z: 0 }));
        scene.add(splashMesh);
        window._splashMesh = splashMesh;
    }

    function updateSplashSystem(dt) {
        if (!splashMesh) return;
        const intensity = WEATHER.lerped.rainIntensity;
        const cx = camera ? camera.position.x : 0;
        const cz = camera ? camera.position.z : 0;

        // spawn
        if (intensity > 0.05) {
            const spawnRate = intensity * 700;
            let toSpawn = spawnRate * dt;
            if (Math.random() < toSpawn - Math.floor(toSpawn)) toSpawn = Math.ceil(toSpawn);
            else toSpawn = Math.floor(toSpawn);
            for (let s = 0; s < toSpawn; s++) {
                const angle = rng.float() * Math.PI * 2;
                const dist = Math.sqrt(rng.float()) * 22;
                const sx = cx + Math.cos(angle) * dist;
                const sz = cz + Math.sin(angle) * dist;
                for (let i = 0; i < SPLASH_MAX; i++) {
                    if (splashData[i].life <= 0) {
                        splashData[i].x = sx;
                        splashData[i].z = sz;
                        splashData[i].maxLife = SPLASH_LIFETIME * (0.6 + rng.float() * 0.8);
                        splashData[i].life = splashData[i].maxLife;
                        break;
                    }
                }
            }
        }

        // update
        const dummy = new THREE.Object3D();
        for (let i = 0; i < SPLASH_MAX; i++) {
            const sd = splashData[i];
            if (sd.life > 0) {
                sd.life -= dt;
                if (sd.life <= 0) {
                    dummy.position.set(0, -999, 0);
                    dummy.scale.set(0, 0, 0);
                } else {
                    const t = 1.0 - sd.life / sd.maxLife;
                    const scale = 0.15 + t * 2.2;
                    dummy.position.set(sd.x, 0.06, sd.z);
                    dummy.rotation.set(-Math.PI / 2, 0, 0);
                    dummy.scale.set(scale, scale, scale);
                }
                dummy.updateMatrix();
                splashMesh.setMatrixAt(i, dummy.matrix);
            }
        }
        splashMesh.instanceMatrix.needsUpdate = true;
    }

    // ---- P13: 秋叶系统 (InstancedMesh) ----
