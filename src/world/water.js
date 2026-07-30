    // ===== P16: 水体系统 (Gerstner + Schlick Fresnel + 泡沫 + 日夜/季节联动) =====
    const WATER = {
        level: -5.0,            // 水面高度
        size: 500,              // 水面尺寸
        segments: 256,          // 网格细分
        mesh: null,
        time: 0
    };

    // ===== P19: 平面反射系统 (GTA5同款: 240x120镜像相机 + 裁剪面) =====
    const REFLECTION = {
        rt: null,
        mirrorCamera: null,
        size: { w: 240, h: 120 },
        clipPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER.level)
    };

    function initReflection() {
        if (!renderer) return;
        REFLECTION.rt = new THREE.WebGLRenderTarget(REFLECTION.size.w, REFLECTION.size.h, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });
        REFLECTION.mirrorCamera = new THREE.PerspectiveCamera(
            60, REFLECTION.size.w / REFLECTION.size.h, 0.1, 1000
        );
        renderer.localClippingEnabled = true;
        console.log('[P19] 平面反射系统初始化 (240×120, GTA5同款)');
    }

    function renderReflection() {
        if (!REFLECTION.rt || !REFLECTION.mirrorCamera || !WATER.mesh) return;

        // 1. 隐藏水体（避免无限递归反射水中水）
        WATER.mesh.visible = false;

        // 2. 计算镜像相机位置：关于水面 y=WATER.level 反射
        const camPos = camera.position;
        REFLECTION.mirrorCamera.position.set(
            camPos.x,
            2.0 * WATER.level - camPos.y,
            camPos.z
        );
        // 镜像相机朝向：反射视线方向
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        const reflectDir = new THREE.Vector3(camDir.x, -camDir.y, camDir.z);
        const lookTarget = REFLECTION.mirrorCamera.position.clone().add(reflectDir.multiplyScalar(100));
        REFLECTION.mirrorCamera.lookAt(lookTarget);

        // 3. 克隆主相机投影参数
        REFLECTION.mirrorCamera.fov = camera.fov;
        REFLECTION.mirrorCamera.aspect = REFLECTION.size.w / REFLECTION.size.h;
        REFLECTION.mirrorCamera.near = 0.5;
        REFLECTION.mirrorCamera.far = camera.far;
        REFLECTION.mirrorCamera.updateProjectionMatrix();

        // 4. 渲染反射（直接用 renderer，跳过 composer 避免双重后处理）
        const oldTarget = renderer.getRenderTarget();
        const oldClear = renderer.getClearColor(new THREE.Color());
        const oldClearAlpha = renderer.getClearAlpha();
        const oldClipPlanes = renderer.clippingPlanes;
        renderer.clippingPlanes = [REFLECTION.clipPlane];
        renderer.setRenderTarget(REFLECTION.rt);
        renderer.setClearColor(new THREE.Color(0x0a0e14), 1.0);
        renderer.clear();
        renderer.render(scene, REFLECTION.mirrorCamera);
        renderer.setRenderTarget(oldTarget);
        renderer.setClearColor(oldClear, oldClearAlpha);
        renderer.clippingPlanes = oldClipPlanes;

        // 5. 恢复水体可见
        WATER.mesh.visible = true;

        // 6. 更新水着色器反射 Uniform
        if (WATER.mesh) {
            const mat = WATER.mesh.material;
            mat.uniforms.uReflectionTex.value = REFLECTION.rt.texture;
            mat.uniforms.uReflectMatrix.value.copy(
                REFLECTION.mirrorCamera.projectionMatrix
            ).multiply(REFLECTION.mirrorCamera.matrixWorldInverse);
            mat.uniforms.uUseReflection.value = true;
        }
    }

    function createWaterSystem() {
        const geo = new THREE.PlaneGeometry(WATER.size, WATER.size, WATER.segments, WATER.segments);
        geo.rotateX(-Math.PI / 2);

        const waterMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uDayness: { value: 0.85 },
                uSnowAmount: { value: 0 },
                // P20A: 天气-水体耦合
                uStormIntensity: { value: 0 },
                uWindDirection: { value: new THREE.Vector2(1, 0) },
                uWindSpeed: { value: 0 },
                uCameraPos: { value: new THREE.Vector3() },
                uEnvMap: { value: scene.environment || null },
                uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.4) },
                uWaterLevel: { value: WATER.level },
                // P19: 平面反射
                uReflectionTex: { value: null },
                uReflectMatrix: { value: new THREE.Matrix4() },
                uUseReflection: { value: false }
            },
            vertexShader: /* glsl */`
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying float vWaveHeight;
                varying vec3 vViewDir;
                varying vec2 vReflectUV;

                uniform float uTime;
                // P20A: 天气-水体耦合
                uniform float uStormIntensity;
                uniform vec2 uWindDirection;
                uniform float uWindSpeed;
                uniform mat4 uReflectMatrix;

                // Gerstner wave function
                vec3 gerstner(vec2 uv, float A, vec2 dir, float steepness, float speed, float t) {
                    vec2 k = normalize(dir);
                    float w = sqrt(9.8 * length(dir));
                    float phase = dot(k, uv) * length(dir) - w * speed * t;
                    float s = steepness * A;
                    return vec3(
                        s * k.x * cos(phase),
                        A * sin(phase),
                        s * k.y * cos(phase)
                    );
                }

                // Gerstner wave normal
                vec3 gerstnerNormal(vec2 uv, float A, vec2 dir, float steepness, float speed, float t) {
                    vec2 k = normalize(dir);
                    float kLen = length(dir);
                    float w = sqrt(9.8 * kLen);
                    float phase = dot(k, uv) * kLen - w * speed * t;
                    float WA = w * A;
                    float s = steepness * A;
                    float c = cos(phase), sPhase = sin(phase);
                    return vec3(
                        -k.x * WA * c,
                        1.0 - s * kLen * sPhase,
                        -k.y * WA * c
                    );
                }

                void main() {
                    vec3 pos = position;
                    vec3 normal = vec3(0.0, 1.0, 0.0);

                    // P20A: 天气调制系数（mysimulator风暴参数模型）
                    float stormAmp   = 1.0 + uStormIntensity * 2.0;   // 平静→暴风雨：振幅最大 3x
                    float stormSteep = 1.0 + uStormIntensity * 1.5;   // 波峰更尖锐
                    float stormSpeed = 1.0 + uStormIntensity * 0.5;   // 波速加快
                    // 主导波方向向风向靠拢（前2个振幅最大的波）
                    float windBlend = uStormIntensity * 0.7;
                    vec2 wind2d = uWindSpeed > 0.01 ? normalize(uWindDirection) : vec2(1.0, 0.6);
                    vec2 domDir1 = mix(vec2(1.0, 0.6), wind2d, windBlend);
                    vec2 domDir2 = mix(vec2(-0.6, 1.0), wind2d, windBlend * 0.8);

                    // 8 Gerstner waves — 天气调制振幅/陡度/速度
                    pos += gerstner(pos.xz, 0.18 * stormAmp, domDir1,              0.35 * stormSteep, 0.7 * stormSpeed, uTime);
                    pos += gerstner(pos.xz, 0.13 * stormAmp, domDir2,              0.30 * stormSteep, 0.9 * stormSpeed, uTime);
                    pos += gerstner(pos.xz, 0.08 * stormAmp, vec2(0.4, -0.85),     0.45 * stormSteep, 1.1 * stormSpeed, uTime);
                    pos += gerstner(pos.xz, 0.06 * stormAmp, vec2(-0.9, -0.3),     0.50 * stormSteep, 1.3 * stormSpeed, uTime);
                    pos += gerstner(pos.xz, 0.04 * stormAmp, vec2(0.7, -0.5),      0.40 * stormSteep, 1.5 * stormSpeed, uTime);
                    pos += gerstner(pos.xz, 0.03 * stormAmp, vec2(-0.4, 0.75),     0.55 * stormSteep, 1.7 * stormSpeed, uTime);
                    pos += gerstner(pos.xz, 0.02 * stormAmp, vec2(0.2, -0.95),     0.50 * stormSteep, 1.9 * stormSpeed, uTime);
                    pos += gerstner(pos.xz, 0.015* stormAmp, vec2(-0.7, -0.65),    0.45 * stormSteep, 2.1 * stormSpeed, uTime);

                    normal += gerstnerNormal(pos.xz, 0.18 * stormAmp, domDir1,              0.35 * stormSteep, 0.7 * stormSpeed, uTime);
                    normal += gerstnerNormal(pos.xz, 0.13 * stormAmp, domDir2,              0.30 * stormSteep, 0.9 * stormSpeed, uTime);
                    normal += gerstnerNormal(pos.xz, 0.08 * stormAmp, vec2(0.4, -0.85),     0.45 * stormSteep, 1.1 * stormSpeed, uTime);
                    normal += gerstnerNormal(pos.xz, 0.06 * stormAmp, vec2(-0.9, -0.3),     0.50 * stormSteep, 1.3 * stormSpeed, uTime);
                    normal += gerstnerNormal(pos.xz, 0.04 * stormAmp, vec2(0.7, -0.5),      0.40 * stormSteep, 1.5 * stormSpeed, uTime);
                    normal += gerstnerNormal(pos.xz, 0.03 * stormAmp, vec2(-0.4, 0.75),     0.55 * stormSteep, 1.7 * stormSpeed, uTime);
                    normal += gerstnerNormal(pos.xz, 0.02 * stormAmp, vec2(0.2, -0.95),     0.50 * stormSteep, 1.9 * stormSpeed, uTime);
                    normal += gerstnerNormal(pos.xz, 0.015* stormAmp, vec2(-0.7, -0.65),    0.45 * stormSteep, 2.1 * stormSpeed, uTime);
                    normal = normalize(normal);

                    vWorldPos = pos;
                    vWaveHeight = pos.y;
                    vNormal = normal;
                    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
                    vViewDir = normalize(-mvPos.xyz);

                    // P19: 反射 UV（世界空间 → 镜像相机裁剪空间 → [0,1]）
                    vec4 reflectClip = uReflectMatrix * vec4(pos, 1.0);
                    vReflectUV = (reflectClip.xy / max(reflectClip.w, 0.001)) * 0.5 + 0.5;

                    gl_Position = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: /* glsl */`
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying float vWaveHeight;
                varying vec3 vViewDir;
                varying vec2 vReflectUV;

                uniform float uTime;
                uniform float uDayness;
                uniform float uSnowAmount;
                // P20A: 天气-水体耦合
                uniform float uStormIntensity;
                uniform vec2 uWindDirection;
                uniform float uWindSpeed;
                uniform samplerCube uEnvMap;
                uniform vec3 uSunDir;
                uniform float uWaterLevel;
                uniform sampler2D uReflectionTex;
                uniform bool uUseReflection;

                // Schlick Fresnel
                float schlickFresnel(vec3 V, vec3 N, float ior) {
                    float r0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
                    float cosTheta = clamp(1.0 - abs(dot(V, N)), 0.0, 1.0);
                    return r0 + (1.0 - r0) * pow(cosTheta, 5.0);
                }

                void main() {
                    vec3 N = normalize(vNormal);
                    vec3 V = normalize(vViewDir);

                    // Fresnel
                    float fresnel = schlickFresnel(V, N, 1.33);

                    // --- 反射色：P19 平面反射纹理（GTA5同款，反射真实城市天际线） ---
                    vec3 reflectColor = vec3(0.3, 0.5, 0.7);
                    if (uUseReflection) {
                        vec2 refUV = clamp(vReflectUV, 0.001, 0.999);
                        reflectColor = texture2D(uReflectionTex, refUV).rgb;
                    } else {
                        // 兜底：环境贴图
                        vec3 reflectDir = reflect(-V, N);
                        reflectColor = texture(uEnvMap, reflectDir).rgb;
                    }

                    // --- 折射色：深水颜色 ---
                    // 浅水偏青色，深水偏深蓝
                    float depth = 1.0 - clamp(vWaveHeight - uWaterLevel + 3.0, 0.0, 3.0) / 3.0;
                    vec3 shallowColor = vec3(0.1, 0.35, 0.45);  // 浅水青绿
                    vec3 deepColor    = vec3(0.02, 0.08, 0.2);   // 深水暗蓝
                    vec3 waterColor = mix(shallowColor, deepColor, depth);

                    // --- 日夜联动：水温色调 ---
                    // 白天偏蓝绿，夜晚偏暗暖
                    vec3 dayWater   = waterColor;
                    vec3 nightWater = waterColor * vec3(0.6, 0.5, 0.55);
                    waterColor = mix(nightWater, dayWater, uDayness);

                    // P20A: 风暴水面变暗变灰（mysimulator Storm 效果）
                    vec3 stormWater = vec3(0.08, 0.12, 0.18);
                    waterColor = mix(waterColor, stormWater, uStormIntensity * 0.55);

                    // --- 冬季冰冻 ---
                    float ice = uSnowAmount;
                    vec3 iceColor = vec3(0.7, 0.78, 0.85);
                    float iceFresnel = fresnel * (1.0 - ice * 0.4);
                    waterColor = mix(waterColor, iceColor, ice * 0.6);

                    // --- 镜面高光 (Blinn-Phong) ---
                    vec3 sunDir = normalize(uSunDir);
                    vec3 H = normalize(sunDir + V);
                    float spec = pow(max(dot(N, H), 0.0), 256.0);
                    vec3 specColor = vec3(1.0, 0.95, 0.8) * spec * 0.6 * uDayness;
                    // 冬季减弱高光
                    specColor *= (1.0 - ice * 0.8);

                    // --- 泡沫 ---
                    float foamThreshold = 0.08 + ice * 0.05 - uStormIntensity * 0.05;
                    float foamMask = smoothstep(foamThreshold, foamThreshold + 0.06, vWaveHeight - uWaterLevel);
                    vec3 foamColor = vec3(0.9, 0.92, 0.95);
                    // 冬季泡沫变少，风暴白浪增多
                    foamMask *= (1.0 - ice * 0.5 + uStormIntensity * 1.2);

                    // --- 高频法线细节（程序化涟漪） ---
                    float ripple = 0.0;
                    vec2 rippleUV = vWorldPos.xz * 40.0;
                    ripple += sin(rippleUV.x * 1.3 + uTime * 2.5) * 0.3;
                    ripple += cos(rippleUV.y * 1.7 - uTime * 3.0) * 0.3;
                    ripple += sin((rippleUV.x + rippleUV.y) * 0.9 + uTime * 1.8) * 0.2;
                    float rippleFresnel = fresnel * (0.85 + ripple * 0.15);
                    rippleFresnel = clamp(rippleFresnel - ice * 0.2, 0.0, 1.0);

                    // --- 合成 ---
                    // P20A: 风暴下反射减弱（波涛汹涌散射反射）
                    float stormFresnel = rippleFresnel * (1.0 - uStormIntensity * 0.2);
                    vec3 color = mix(waterColor, reflectColor, stormFresnel);
                    color += specColor;
                    color = mix(color, foamColor, foamMask * 0.7);

                    // --- 透明度：边缘透明 ---
                    float alpha = 0.88;
                    // 冬季冰面更不透明，风暴更不透明
                    alpha = mix(alpha, 0.95, max(ice, uStormIntensity) * 0.5);

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            depthWrite: true,
            side: THREE.DoubleSide
        });

        const water = new THREE.Mesh(geo, waterMat);
        water.position.y = WATER.level;
        water.renderOrder = 1;
        water.name = 'water';
        water.receiveShadow = true;
        scene.add(water);
        WATER.mesh = water;
        window._water = water;
        console.log('[P16] 水体系统已创建 (Gerstner 8波 + Schlick Fresnel + 泡沫 + 日夜/季节联动)');
    }

    function createAtmosphere() {
        // ===== P18: 体积大气系统 =====

        // --- P18A: 大气透视雾（注入到建筑材质） ---
        const fogColor = new THREE.Color(0.85, 0.82, 0.78);
        const fogShaderPatch = (shader) => {
            shader.vertexShader = shader.vertexShader.replace(
                'void main() {',
                `varying vec3 vFogWorldPos;\n    void main() {\n        vec4 wp = modelMatrix * vec4(position, 1.0);\n        vFogWorldPos = wp.xyz;`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                'void main() {',
                `uniform float uFogNear;\n    uniform float uFogFar;\n    uniform float uFogHeightMin;\n    uniform float uFogHeightMax;\n    uniform vec3 uFogColor;\n    varying vec3 vFogWorldPos;\n    void main() {`
            );
            // Inject fog mix before gl_FragColor
            const patterns = [
                'gl_FragColor = vec4(outgoingLight, diffuseColor.a);',
                'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
                'gl_FragColor = vec4( outgoingLight, 1.0 );',
                'gl_FragColor = vec4(outgoingLight, 1.0);'
            ];
            for (const p of patterns) {
                if (shader.fragmentShader.includes(p)) {
                    shader.fragmentShader = shader.fragmentShader.replace(
                        p,
                        `float fogDist = length(vFogWorldPos.xz - cameraPosition.xz);\n    float distFog = smoothstep(uFogNear, uFogFar, fogDist);\n    float heightFog = 1.0 - smoothstep(uFogHeightMin, uFogHeightMax, vFogWorldPos.y);\n    float totalFog = max(distFog, heightFog * 0.6);\n    outgoingLight = mix(outgoingLight, uFogColor, totalFog * 0.55);\n    ` + p
                    );
                    break;
                }
            }
            shader.uniforms = shader.uniforms || {};
            shader.uniforms.uFogNear = { value: 120 };
            shader.uniforms.uFogFar = { value: 500 };
            shader.uniforms.uFogHeightMin = { value: -20 };
            shader.uniforms.uFogHeightMax = { value: 40 };
            shader.uniforms.uFogColor = { value: new THREE.Color(0.82, 0.84, 0.86) };
        };

        let fogInjected = 0;
        scene.traverse((obj) => {
            if (obj.isMesh && obj.material && obj.material.isMeshStandardMaterial) {
                // 只给建筑和较大物体注入雾效（跳过水面、植被、地面）
                const name = (obj.name || '').toLowerCase();
                const skip = ['water', 'tree', 'leaf', 'pedestrian', 'road', 'grass', 'plant', 'flower', 'bush'];
                if (skip.some(s => name.includes(s))) return;
                // 跳过高物体（比如天空、穹顶）
                if (obj.position.y > 80) return;
                if (obj.geometry && obj.geometry.type === 'PlaneGeometry') return; // 跳过地面
                try {
                    if (!obj.material._fogPatched) {
                        obj.material.onBeforeCompile = fogShaderPatch;
                        obj.material._fogPatched = true;
                        fogInjected++;
                    }
                } catch(e) {}
            }
        });

        // --- P18B: 动态雾色 uniform 存储 ---
        window._atmosphere = {
            fogMaterials: [],
            fogColor: new THREE.Color(0.82, 0.84, 0.86),
            update: function(dt) {
                // 根据时间/天气动态调整雾色
                const d = DAYNIGHT.dayness;
                const sunDir = window._skyDome ? window._skyDome.material.uniforms.uSunDirection.value : new THREE.Vector3(0.5, 0.8, 0.4);
                const sunY = sunDir.y;
                const sunset = 1.0 - smoothstep(-0.15, 0.25, sunY);

                // 白天：微蓝白，日落：暖橙，夜间：深蓝灰
                const dayFog = new THREE.Color(0.82, 0.84, 0.88);
                const sunsetFog = new THREE.Color(0.9, 0.7, 0.55);
                const nightFog = new THREE.Color(0.15, 0.18, 0.3);

                this.fogColor.copy(dayFog).lerp(sunsetFog, sunset * 0.6);
                this.fogColor.lerp(nightFog, (1.0 - d) * 0.7);

                // 更新天空穹顶 turbidity（夕阳时浑浊度增加）
                if (window._skyDome) {
                    window._skyDome.material.uniforms.uTurbidity.value = 2.5 + sunset * 2.0;
                    window._skyDome.material.uniforms.uExposure.value = 0.8 + sunset * 0.4 + d * 0.2;
                }
            }
        };

        console.log(`[P18] 体积大气系统已创建 (大气散射天空 + ${fogInjected} 个材质雾效注入)`);
    }

    function updateWater(dt) {
        if (!WATER.mesh) return;
        WATER.time += dt;
        const mat = WATER.mesh.material;
        mat.uniforms.uTime.value = WATER.time;
        mat.uniforms.uDayness.value = DAYNIGHT.dayness;
        mat.uniforms.uSnowAmount.value = SEASON.lerped.snowAmount;
        // P20A: 天气-水体耦合 — 传递风暴强度/风向/风速
        const w = WEATHER.lerped;
        const stormIntensity = Math.min(1.0, w.rainIntensity * 0.85 + w.lightningFreq * 0.3 + w.windSpeed * 0.15);
        mat.uniforms.uStormIntensity.value = stormIntensity;
        const windDir = WEATHER.wind.dir.clone();
        mat.uniforms.uWindDirection.value.set(windDir.x, windDir.z);
        mat.uniforms.uWindSpeed.value = WEATHER.lerped.windSpeed;
        mat.uniforms.uCameraPos.value.copy(camera.position);
        // 太阳方向（从天穹着色器复用逻辑）
        const sd = window._sun ? window._sun.position.clone().normalize() : new THREE.Vector3(0.5, 0.8, 0.4);
        mat.uniforms.uSunDir.value.copy(sd);
        // 环境贴图
        if (scene.environment) {
            mat.uniforms.uEnvMap.value = scene.environment;
            mat.defines = mat.defines || {};
            mat.defines.USE_ENVMAP = '';
        }
        mat.needsUpdate = true;
    }

