        moveSpeed: 0
    };

    // ---- 输入 ----
    const keys = window.keys || {};
    let isPointerLocked = false, gamePaused = false, gameStarted = false;
    let qualityPreset = (isMobile ? 1 : 2);
    let shadowQuality = isMobile ? 512 : 2048;

    const QUALITY_PRESETS = {
        0: { name: '流畅', pixelRatioCap: 1.0, shadow: 512,  bloomStrength: 0.35, ssao: false,  ssaoRadius: 0.0, post: false },
        1: { name: '均衡', pixelRatioCap: 1.5, shadow: 512, bloomStrength: 0.6, ssao: true,  ssaoRadius: 0.4, post: true },
        2: { name: '高质', pixelRatioCap: 2.0,  shadow: 2048, bloomStrength: 0.85, ssao: true, ssaoRadius: 0.7, post: true },
        3: { name: '极致', pixelRatioCap: 2.0,  shadow: 2048, bloomStrength: 1.1, ssao: true, ssaoRadius: 0.9, post: true }
    };

    function applyQualityPreset(p) {
        const cfg = QUALITY_PRESETS[p] || QUALITY_PRESETS[2];
        shadowQuality = cfg.shadow;
        if (window.sun && window.sun.shadow) {
            window.sun.shadow.mapSize.set(cfg.shadow, cfg.shadow);
            if (window.sun.shadow.map) { window.sun.shadow.map.dispose(); window.sun.shadow.map = null; }
        }
        if (window.renderer) {
            window.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.pixelRatioCap));
        }
        try { rebuildPostPipeline(cfg); } catch (e) { console.warn('[quality] rebuild post failed', e); }
    }


    // ---- 引擎初始化（完整保留） ----
    function initEngine() {
        try {
            var _testCanvas = document.createElement('canvas');
            var _testGL = _testCanvas.getContext('webgl2') || _testCanvas.getContext('webgl') || _testCanvas.getContext('experimental-webgl');
            if (!_testGL) {
                var _e = new Error('WebGL 不可用（硬件加速被禁用？）');
                _e.code = 'NO_WEBGL';
                throw _e;
            }
        } catch(_e) { throw _e; }

        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x7a9ab8, 0.0055);

        camera = new THREE.PerspectiveCamera(62, window.innerWidth/window.innerHeight, 0.1, 2000);
        camera.position.set(0, 5, 10);

        // ===== P14: 3D音频监听器 =====
        window._audioListener = new THREE.AudioListener();
        camera.add(window._audioListener);

        renderer = new THREE.WebGLRenderer({
            antialias: !isMobile,
            powerPreference: 'high-performance',
            alpha: false, stencil: false, depth: true
        });
        renderer.setClearColor(0x0a0e14, 1.0);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window._pixelRatio || Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.autoUpdate = true;
        renderer.shadowMap.bias = -0.0005;
        renderer.shadowMap.normalBias = 0.02;
        renderer.shadowMap.radius = 4;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(renderer.domElement);

        // ===== 自定义天空穹顶着色器 =====
        const skyDomeGeo = new THREE.SphereGeometry(100, 32, 16);
        const skyDomeMat = new THREE.ShaderMaterial({
            uniforms: {
                uDayness: { value: 0.85 },
                uSunDirection: { value: new THREE.Vector3(0.5, 0.8, -0.3) },
                uTime: { value: 0 },
                uTurbidity: { value: 2.5 },
                uExposure: { value: 1.0 },
                uGroundColor: { value: new THREE.Color(0.02, 0.01, 0.02) },
                uCloudCover: { value: 0.5 }
            },
            // ===== P18 大气散射天空穹顶 =====
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_Position.z = gl_Position.w;
                }
            `,
            fragmentShader: `
                // ===== P18 大气散射着色器 (Rayleigh + Mie) =====
                uniform float uDayness;
                uniform vec3 uSunDirection;
                uniform float uTime;
                uniform float uTurbidity;
                uniform float uExposure;
                uniform vec3 uGroundColor;
                uniform float uCloudCover;
                varying vec3 vWorldPosition;

                const float PI = 3.14159265359;
                const float MIE_G = 0.76;

                float rayleighPhase(float cosTheta) {
                    return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
                }

                float hgPhase(float cosTheta, float g) {
                    float g2 = g * g;
                    return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
                }

                // ===== 噪声函数（云层） =====
                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + 0.1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                float noise(vec3 p) {
                    vec3 i = floor(p);
                    vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                            mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                            mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
                }
                float fbm(vec3 p) {
                    float v = 0.0, a = 0.5;
                    for(int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
                    return v;
                }

                void main() {
                    vec3 dir = normalize(vWorldPosition);
                    float y = dir.y;
                    vec3 sunDir = normalize(uSunDirection);
                    float sunY = sunDir.y;
                    float cosViewSun = max(dot(dir, sunDir), 0.0);

                    // ===== 大气散射核心 (Rayleigh + Mie) =====
                    // 光学深度近似：高度越低 / 太阳越低，光线穿过大气越厚
                    float viewHeight = max(y + 0.05, 0.0);

                    // Rayleigh: λ⁻⁴ 依赖 → 短波(蓝)散射强
                    vec3 betaR = vec3(5.8e-6, 13.5e-6, 33.1e-6) * 1e6; // 放大以便计算
                    float rayleighOpticalDepth = 1.0 / max(viewHeight * 1.5 + 0.08, 0.001);
                    float sunRayleighDepth = 1.0 / max(sunY * 1.8 + 0.1, 0.001);
                    vec3 rayleighExt = exp(-betaR * sunRayleighDepth * 0.8);

                    // Mie: 与波长无关，集中在太阳附近
                    float mieOpticalDepth = 1.0 / max(viewHeight * 0.8 + 0.02, 0.001);
                    float sunMieDepth = 1.0 / max(sunY * 1.0 + 0.05, 0.001);
                    float mieExt = exp(-0.5 * sunMieDepth);

                    // 散射量
                    vec3 rayleighScatter = betaR * rayleighOpticalDepth * rayleighPhase(cosViewSun) * vec3(1.0, 0.95, 0.9) * rayleighExt;
                    float mieScatter = mieOpticalDepth * hgPhase(cosViewSun, MIE_G) * 0.06 * mieExt * uTurbidity;

                    // 天顶色随太阳高度变化
                    float sunsetBlend = 1.0 - smoothstep(-0.15, 0.25, sunY);
                    vec3 zenithColor = mix(vec3(0.15, 0.3, 0.85), vec3(0.25, 0.15, 0.55), sunsetBlend * 0.7);
                    vec3 horizonColor = mix(vec3(0.55, 0.7, 1.0), vec3(1.0, 0.45, 0.18), sunsetBlend);

                    // 基础天空：高度渐变 + 散射
                    float horizonFade = pow(1.0 - max(viewHeight, 0.0), 0.55);
                    vec3 baseSky = mix(zenithColor, horizonColor, horizonFade);
                    baseSky += rayleighScatter * 0.25;

                    // Mie 散射环（太阳周围亮晕）
                    float mieRing = pow(cosViewSun + 0.02, 12.0) * mieScatter * 40.0;
                    float mieWideRing = pow(cosViewSun + 0.05, 1.8) * mieScatter * 3.0;
                    vec3 mieContribution = vec3(1.0, 0.85, 0.6) * (mieRing + mieWideRing);

                    // 日落增强：近地平线的暖色调散射
                    float horizonSunBoost = (1.0 - abs(y)) * sunsetBlend * pow(cosViewSun + 0.1, 2.5) * 0.25;
                    vec3 sunsetGlow = vec3(1.0, 0.4, 0.1) * horizonSunBoost;

                    vec3 skyColor = baseSky + mieContribution + sunsetGlow;
                    skyColor *= uDayness * 0.9 + 0.1;

                    // ===== 太阳盘 =====
                    float sunDisk = smoothstep(0.99945, 1.0, cosViewSun);
                    vec3 sunCoreColor = vec3(1.0, 0.95, 0.85) * sunDisk * 6.0;
                    float sunInnerGlow = pow(cosViewSun + 0.15, 32.0) * 0.6;
                    vec3 sunGlowColor = vec3(1.0, 0.85, 0.55) * sunInnerGlow;
                    skyColor += (sunCoreColor + sunGlowColor) * uDayness;

                    // ===== 云层 =====
                    vec3 cloudPos = dir * 30.0 + vec3(uTime * 0.04, 0.0, uTime * 0.02);
                    float cloudNoise = fbm(cloudPos);
                    float cloudDensity = smoothstep(0.35, 0.72, cloudNoise) * uDayness * uCloudCover;
                    float cloudSunEdge = pow(max(dot(dir, sunDir), 0.0), 6.0);
                    vec3 cloudBright = mix(vec3(0.75, 0.8, 0.85), vec3(1.0, 0.9, 0.65), cloudSunEdge);
                    vec3 cloudDark = mix(vec3(0.38, 0.4, 0.45), vec3(0.2, 0.18, 0.25), 1.0 - uDayness);
                    vec3 cloudColor = mix(cloudDark, cloudBright, cloudDensity);
                    skyColor += cloudColor * cloudDensity;

                    // ===== 星星 =====
                    float starVis = (1.0 - uDayness) * smoothstep(0.05, 0.15, y);
                    vec3 starPos = dir * 200.0;
                    vec3 starCell = floor(starPos * 30.0);
                    float starHash = hash(starCell);
                    float starPattern = step(0.9975, starHash) * starVis;
                    float starTwinkle = sin(uTime * 3.0 + starHash * 100.0 + starCell.x * 0.5) * 0.5 + 0.5;
                    vec3 starColor = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.9, 0.7), starHash) * starPattern * (0.5 + 0.5 * starTwinkle);
                    skyColor += starColor;

                    // ===== 月亮 =====
                    float moonVis = (1.0 - uDayness) * smoothstep(0.0, 0.2, y + 0.1);
                    vec3 moonDir = normalize(vec3(-sunDir.x * 0.8, 0.3 + 0.3 * (1.0 - uDayness), -sunDir.z * 0.8));
                    float moonAngle = max(dot(dir, moonDir), 0.0);
                    float moonDisk = smoothstep(0.999, 1.0, moonAngle);
                    float moonGlow = pow(moonAngle, 16.0) * 0.12;
                    vec3 moonColor = vec3(0.85, 0.85, 0.95) * (moonDisk * 1.5 + moonGlow) * moonVis;
                    skyColor += moonColor;

                    // ===== 下半球：地面 =====
                    if(y < 0.0) {
                        float groundBlend = exp(y * 12.0);
                        skyColor = mix(uGroundColor, horizonColor * 0.7, groundBlend);
                    }

                    // ===== HDR 色调映射 =====
                    skyColor = skyColor / (skyColor * uExposure + vec3(1.0));
                    skyColor = pow(skyColor, vec3(1.0/2.2));
                    gl_FragColor = vec4(skyColor, 1.0);
                }
            `
            side: THREE.BackSide,
            depthWrite: false
        });
        const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
        skyDome.name = 'skyDome';
        scene.add(skyDome);
        window._skyDome = skyDome;

        // ===== IBL =====
        try {
            const pmrem = new THREE.PMREMGenerator(renderer);
            pmrem.compileEquirectangularShader();
            const envRT = pmrem.fromScene(skyDome, 0.04);
            scene.environment = envRT.texture;
            window._envRT = envRT;
            pmrem.dispose();
        } catch(e){ console.warn('IBL failed', e); }

        // 三点光 + 半球光
        ambient = new THREE.AmbientLight(0x8a7a6a, 0.45);
        scene.add(ambient);
        hemi = new THREE.HemisphereLight(0x9ec5e8, 0x3a2a1a, 0.6);
        scene.add(hemi);
        sun = new THREE.DirectionalLight(0xfff0d0, 3.0);
        sun.position.set(-80, 120, -60);
        sun.castShadow = true;
        sun.shadow.mapSize.set(isMobile ? 512 : 2048, isMobile ? 512 : 2048);
        sun.shadow.camera.near = 1; sun.shadow.camera.far = 500;
        sun.shadow.camera.left = -250; sun.shadow.camera.right = 250;
        sun.shadow.camera.top = 250; sun.shadow.camera.bottom = -250;
        sun.shadow.bias = -0.00005; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
        scene.add(sun);
        window._sun = sun;
        const fill = new THREE.DirectionalLight(0x6688c0, 0.55);
        fill.position.set(80, 60, 80);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xc9a96e, 0.35);
        rim.position.set(0, 20, -120);
        scene.add(rim);

        // P25A: 月光 DirectionalLight（冷蓝白，仅夜间启用）
        const moonLight = new THREE.DirectionalLight(0x8899cc, 0.0);
        moonLight.position.set(60, 30, 60);
        moonLight.castShadow = false;
        scene.add(moonLight);
        window._moonLight = moonLight;

        // 后处理
        if (isMobile) {
            try { rebuildMobileBloom(); } catch(e) { composer = null; }
        } else {
            try { rebuildPostPipeline(QUALITY_PRESETS[qualityPreset]); } catch(e) {
                console.warn('EffectComposer init failed', e); composer = null;
            }
        }

        clock = new THREE.Clock();

        // ---- P20B-III: Wet Lens Shader ----
        const WetLensShader = {
            uniforms: {
                tDiffuse: { value: null },
                uTime: { value: 0 },
                uWetness: { value: 0.0 },
                uResolution: { value: new THREE.Vector2() },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform sampler2D tDiffuse;
                uniform float uTime, uWetness;
                uniform vec2 uResolution;

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }
                float noise(vec2 p) {
                    vec2 i = floor(p); vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
                }

                vec2 droplet(vec2 uv, vec2 center, float radius, float idx) {
                    vec2 delta = (uv - center) * uResolution / uResolution.y;
                    float dist = length(delta);
                    if (dist > radius) return vec2(0.0);
                    float falloff = 1.0 - smoothstep(0.0, radius, dist);
                    falloff *= falloff;
                    // refraction: pull toward center
                    float refract = falloff * 0.025;
                    // vertical streak drag
                    float streak = falloff * 0.012 * sin(idx * 13.7);
                    return normalize(delta + 0.001) * refract + vec2(0.0, streak);
                }

                void main() {
                    vec2 uv = vUv;
                    float w = clamp(uWetness, 0.0, 1.0);
                    vec2 offset = vec2(0.0);

                    if (w > 0.01) {
                        // 3 layers of droplets at different scales
                        for (int l = 0; l < 3; l++) {
                            float scale = 1.0 + float(l) * 0.5;
                            vec2 grid = floor(uv * uResolution / 80.0 * scale + 0.5);
                            for (int i = -1; i <= 1; i++) {
                                for (int j = -1; j <= 1; j++) {
                                    vec2 cell = grid + vec2(float(i), float(j));
                                    float rng = hash(cell * (1.0 + float(l) * 7.3));
                                    if (rng > 1.05 - 2.0 * w) continue;
                                    vec2 center = (cell + vec2(hash(cell*3.7), hash(cell*9.1)) * 0.6)
                                                  / (uResolution / 80.0 * scale);
                                    float radius = 0.15 + hash(cell*5.9) * 0.35;
                                    radius *= 0.6 + float(l) * 0.2;
                                    offset += droplet(uv, center, radius, rng) * w;
                                }
                            }
                        }
                    }

                    vec4 color = texture2D(tDiffuse, uv + offset * w);

                    // moisture darkening at edges
                    float vignette = 1.0 - smoothstep(0.3, 1.2, length(uv - 0.5) * 1.8) * 0.08 * w;
                    color.rgb *= vignette;

                    gl_FragColor = color;
                }
            `,
        };

        function rebuildPostPipeline(cfg) {
            if (!renderer || isMobile) { composer = null; return; }
            if (!cfg.post) { composer = null; return; }
            if (composer) { try { composer.dispose && composer.dispose(); } catch (_) {} composer = null; }
            composer = new EffectComposer(renderer);
            const renderPass = new RenderPass(scene, camera);
            composer.addPass(renderPass);

            if (cfg.ssao && cfg.ssaoRadius > 0) {
                try {
                    ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
                    ssaoPass.kernelRadius = cfg.ssaoRadius;
                    ssaoPass.minDistance = 0.001;
                    ssaoPass.maxDistance = 0.05;
                    ssaoPass.output = SSAOPass.OUTPUT.Default;
                    composer.addPass(ssaoPass);
                    window._ssao = ssaoPass;
                } catch (e) { console.warn('SSAO failed, skip', e); }
            } else { ssaoPass = null; }

            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                cfg.bloomStrength, 0.55, 0.78
            );
            composer.addPass(bloomPass);
            window._bloom = bloomPass;

            try {
                let filmPass = new ShaderPass(FilmShader);
                filmPass.uniforms.uResolution.value = new THREE.Vector2(
                    window.innerWidth * renderer.getPixelRatio(),
                    window.innerHeight * renderer.getPixelRatio()
                );
                const filmOn = (qualityPreset >= 1);
                filmPass.uniforms.uVignette.value = filmOn ? 0.45 : 0.0;
                filmPass.uniforms.uGrain.value    = filmOn ? 0.06 : 0.0;
                filmPass.uniforms.uFxaa.value     = 1.0;
                filmPass.uniforms.uChroma.value   = filmOn ? 0.6 : 0.0;
                filmPass.uniforms.uSharp.value    = filmOn ? 0.5 : 0.0;
                composer.addPass(filmPass);
                window._film = filmPass;
            } catch (e) { console.warn('FilmPass failed, skip', e); }

            // P20B-III: Wet Lens (W)
            try {
                const wetLensPass = new ShaderPass(WetLensShader);
                wetLensPass.uniforms.uResolution.value = new THREE.Vector2(
                    window.innerWidth * renderer.getPixelRatio(),
                    window.innerHeight * renderer.getPixelRatio()
                );
                composer.addPass(wetLensPass);
                window._wetLens = wetLensPass;
            } catch (e) { console.warn('WetLensPass failed, skip', e); }

            outputPass = new OutputPass();
            composer.addPass(outputPass);
            window._composer = composer;
        }

        function rebuildMobileBloom() {
            if (!renderer) { composer = null; return; }
            if (composer) { try { composer.dispose(); } catch(_) {} composer = null; }
            composer = new EffectComposer(renderer);
            composer.addPass(new RenderPass(scene, camera));
            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.3, 0.4, 0.85
            );
            composer.addPass(bloomPass);
            composer.addPass(new OutputPass());
            window._bloom = bloomPass;
            window._composer = composer;
        }

        if (window.__game && window.__game.renderer) {
            window.__game.renderer.attach({ scene, camera, renderer, composer, clock, isMobile });
            window.__game.renderer.syncGlobals();
        }
    }

