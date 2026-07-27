    // ===== P6+P8: 日夜循环 + 夜景发光 =====
    const DAYNIGHT = {
        cycleDuration: 150,              // 完整日夜循环秒数（2.5分钟）
        elapsed: 0,
        dayness: 0.85,                   // 起始值（白天）
        prevDayness: 0.85,              // 上一帧值（用于阈值检测）
        targetSpeed: 1.0,               // 时间倍速（1=正常）
    };
    window._bldMeshes = [];              // 建筑网格引用 {mesh, nightEmissive}
    window._bldData = [];               // P25B: 建筑位置数据 {cx, cz, topY, w, d, dist}
    window._lampLights = [];             // 路灯 PointLight 引用
    window._glassStripes = [];           // CBD 玻璃幕墙引用 {mesh, baseEmissiveIntensity}
    window._interiorWindows = [];        // P17: 内饰映射窗户材质引用

    function updateLightIntensity(light, baseVal, dayScale, nightScale, t) {
        light.intensity = baseVal * (nightScale + (dayScale - nightScale) * t);
    }
    function updateLightColor(light, dayColor, nightColor, t) {
        const dc = new THREE.Color(dayColor), nc = new THREE.Color(nightColor);
        light.color.copy(dc).lerp(nc, 1 - t);
    }

    function updateDayNight(dt) {
        DAYNIGHT.elapsed += dt * DAYNIGHT.targetSpeed;
        DAYNIGHT.prevDayness = DAYNIGHT.dayness;
        const fullCycle = DAYNIGHT.cycleDuration;
        const raw = Math.sin((DAYNIGHT.elapsed / fullCycle) * Math.PI * 2 + Math.PI * 0.75);
        DAYNIGHT.dayness = (raw + 1) / 2;
        const d = DAYNIGHT.dayness;

        // ==== 天气系数 ====
        const w = WEATHER.lerped;
        const skyBright = 1 - w.skyDarken * 0.7;
        const lightAtten = 1 - w.skyDarken * 0.5;

        const sunPhase = (DAYNIGHT.elapsed / fullCycle) * Math.PI * 2;
        const sunElevation = Math.sin(sunPhase - Math.PI * 0.15) * 0.75 + 0.25;
        const sunAzimuthX = Math.cos(sunPhase + Math.PI * 0.2);
        const sunAzimuthZ = Math.sin(sunPhase + Math.PI * 0.2);
        const sunDir = new THREE.Vector3(sunAzimuthX, sunElevation, sunAzimuthZ).normalize();

        // 更新 SkyDome uniforms
        const sd = window._skyDome;
        if (sd) {
            sd.material.uniforms.uDayness.value = d;
            sd.material.uniforms.uSunDirection.value.copy(sunDir);
            sd.material.uniforms.uCloudCover.value = w.cloudCover;
            const sunsetWarm = 1 - Math.max(0, (d - 0.15) / 0.2);
            sd.material.uniforms.uSunColor.value.copy(
                new THREE.Color(1.0, 0.95 - sunsetWarm * 0.3, 0.8 - sunsetWarm * 0.5)
            );
            // 阴天天空偏灰 + 季节饱和度
            const overcastGray = 1 - w.skyDarken;
            const seasSat = SEASON.lerped.skySaturation;
            sd.material.uniforms.uZenithColor.value.copy(
                new THREE.Color().lerpColors(
                    new THREE.Color(0.08, 0.08, 0.18),
                    new THREE.Color(0.2*skyBright, 0.5*skyBright, 0.9*skyBright),
                    d
                )
            );
            // 季节：spring/green, summer/full, autumn/orange, winter/desaturated
            const zenithBase = sd.material.uniforms.uZenithColor.value;
            const seasZenith = zenithBase.clone();
            seasZenith.r += (SEASON.lerped.groundTint>>16 & 0xff)/255 * 0.04;
            seasZenith.g += (SEASON.lerped.groundTint>>8 & 0xff)/255 * 0.04;
            seasZenith.b += (SEASON.lerped.groundTint & 0xff)/255 * 0.04;
            seasZenith.lerp(zenithBase, 0.88);
            seasZenith.multiplyScalar(seasSat);
            sd.material.uniforms.uZenithColor.value.copy(seasZenith);
        
            sd.material.uniforms.uHorizonColor.value.copy(
                new THREE.Color().lerpColors(
                    new THREE.Color(0.3*overcastGray, 0.15*overcastGray, 0.05*overcastGray),
                    new THREE.Color(0.8*skyBright, 0.85*skyBright, 0.9*skyBright),
                    d
                )
            );
            // 季节地平线
            const horizBase = sd.material.uniforms.uHorizonColor.value.clone();
            horizBase.r *= (0.9 + seasSat * 0.2);
            horizBase.g *= (0.85 + seasSat * 0.3);
            horizBase.b *= (0.9 + seasSat * 0.2);
            sd.material.uniforms.uHorizonColor.value.copy(horizBase);
            sd.material.uniforms.uGroundColor.value.copy(
                new THREE.Color().lerpColors(
                    new THREE.Color(0.01, 0.005, 0.01),
                    new THREE.Color(0.02, 0.01, 0.02),
                    d
                )
            );
        }

        // 太阳 DirectionalLight：天气削弱
        if (window._sun) {
            const sun = window._sun;
            sun.position.set(sunDir.x * 120, sunDir.y * 120, sunDir.z * 120);
            updateLightIntensity(sun, 3.0, 3.0*lightAtten, 0.12, d);
            updateLightColor(sun, 0xfff0d0, 0x445577, d);
        }

        // ===== P25A: 双曲线式环境光过渡 + 月光 =====
        // smoothstep 让昼夜过渡更自然：白天保持高亮、黄昏快速下降、夜间平缓
        const nightSmooth = d < 0.5 ? (1.0 - Math.pow(d / 0.5, 0.55)) : 0.0; // 0=白天, 1=纯夜
        window._nightSmooth = nightSmooth;
        const dayAtten = 1.0 - nightSmooth;

        if (ambient) {
            // 夜间环境光：保留微弱冷蓝 bounce，而非完全压黑
            const ambNightIntensity = 0.08 + nightSmooth * 0.03;
            ambient.intensity = (0.45 * dayAtten + ambNightIntensity) * (1 - w.skyDarken * 0.45);
            const ambDay = new THREE.Color(0x8a7a6a), ambNight = new THREE.Color(0x1a2a3a);
            ambient.color.copy(ambDay).lerp(ambNight, nightSmooth);
        }
        if (hemi) {
            hemi.intensity = (0.6 * dayAtten + nightSmooth * 0.08) * (1 - w.skyDarken * 0.45);
            const hemiSkyDay = new THREE.Color(0x9ec5e8), hemiSkyNight = new THREE.Color(0x0d1a2a);
            const hemiGndDay = new THREE.Color(0x3a2a1a), hemiGndNight = new THREE.Color(0x050810);
            // HemisphereLight color 由 sky + ground 组成, 这里简化处理 skyColor
            hemi.color.copy(hemiSkyDay).lerp(hemiSkyNight, nightSmooth);
        }
        const fill = scene.children.find(c => c.isDirectionalLight && c !== sun && c !== hemi && c !== window._moonLight && c.intensity < 1);
        if (fill) {
            fill.intensity = 0.55 * dayAtten + nightSmooth * 0.04;
        }

        // P25A: 月光（冷蓝白方向光，夜间渐显，模拟月光照射建筑）
        if (window._moonLight) {
            const ml = window._moonLight;
            // 月亮方向：与太阳相反
            const moonDir = new THREE.Vector3(-sunDir.x * 0.7, 0.25 + nightSmooth * 0.15, -sunDir.z * 0.7).normalize();
            ml.position.set(moonDir.x * 100, moonDir.y * 100, moonDir.z * 100);
            ml.intensity = nightSmooth * 0.28 * (1 - w.skyDarken * 0.4);
            const moonColor = new THREE.Color().lerpColors(
                new THREE.Color(0x223344), new THREE.Color(0x8899cc), nightSmooth
            );
            ml.color.copy(moonColor);
        }

        // P25A: Bloom 日夜联动（夜间阈值低/强度高/半径大，霓虹灯更突出）
        if (window._bloom && !isMobile) {
            const cfg = QUALITY_PRESETS[qualityPreset];
            const nightBloomStr = cfg.bloomStrength + nightSmooth * 0.7;
            const nightBloomThresh = 0.55 - nightSmooth * 0.22;
            const nightBloomRadius = 0.78 + nightSmooth * 0.12;
            window._bloom.strength = cfg.bloomStrength * (1 - nightSmooth) + nightBloomStr * nightSmooth;
            window._bloom.threshold = nightBloomThresh;
            window._bloom.radius = nightBloomRadius;
        }
        if (window._bloom && isMobile) {
            window._bloom.strength = 0.3 + nightSmooth * 0.7;
            window._bloom.threshold = 0.55 - nightSmooth * 0.25;
            window._bloom.radius = 0.78 + nightSmooth * 0.15;
        }

        // 雾色 + 天气雾增强 + 季节
        const fogDay = new THREE.Color(0x7a9ab8), fogNight = new THREE.Color(0x0a0e14);
        const fogColor = fogDay.clone().lerp(fogNight, 1 - d);
        // 雨天雾向灰白偏移
        const rainFog = new THREE.Color(0x8899aa);
        const fogFinal = fogColor.clone().lerp(rainFog, w.fogBoost * 0.4);
        // 季节雾色混入
        const seasFog = new THREE.Color(SEASON.lerped.fogHue);
        fogFinal.lerp(seasFog, 0.25);
        if (scene.fog) scene.fog.color.copy(fogFinal);
        if (scene.fog instanceof THREE.FogExp2) scene.fog.density = 0.0055 - d * 0.0015 + w.fogBoost * 0.006;
        if (scene.fog instanceof THREE.Fog) scene.fog.far = 450 - w.fogBoost * 180;

        if (window._fogPlane) {
            const fp = window._fogPlane;
            fp.material.uniforms.uColor.value.copy(fogFinal).multiplyScalar(0.6);
            fp.material.uniforms.uFogColor.value.copy(fogFinal);
            fp.material.uniforms.uTime && (fp.material.uniforms.uTime.value += dt * (1 + w.rainIntensity * 2));
            fp.material.uniforms.uWind && fp.material.uniforms.uWind.value.set(w.wind.force * 1.5, w.wind.force * 1.8);
        }

        // Tone mapping
        if (renderer) renderer.toneMappingExposure = 0.65 + d * 0.55 - w.skyDarken * 0.2;

        // ==== 湿地面 ====
        if (window._terrain && window._terrain.material) {
            const tm = window._terrain.material;
            if (tm.userData._baseRoughness === undefined) tm.userData._baseRoughness = tm.roughness;
            if (tm.userData._baseEnvIntensity === undefined) tm.userData._baseEnvIntensity = tm.envMapIntensity || 0;
            const wet = w.wetness;
            tm.roughness = tm.userData._baseRoughness * (1 - wet * 0.75);
            tm.envMapIntensity = (tm.userData._baseEnvIntensity || 0) + wet * 1.5;
            // 湿地面颜色偏暗蓝灰
            const baseColor = tm.userData._baseColor || (tm.color ? tm.color.getHex() : 0x555555);
            if (!tm.userData._baseColor && tm.color) tm.userData._baseColor = baseColor;
            const bc = new THREE.Color(baseColor);
            const wetColor = new THREE.Color(0x3a4048);
            if (tm.color) tm.color.copy(bc).lerp(wetColor, wet * 0.5);
        }

        // ==== 季节地面色调 ====
        if (window._terrain && window._terrain.material && window._terrain.material.color) {
            const tc = window._terrain.material.color;
            if (tc.userData._origTerrainColor === undefined) tc.userData._origTerrainColor = tc.getHex();
            const orig = new THREE.Color(tc.userData._origTerrainColor);
            const seasTint = new THREE.Color(SEASON.lerped.groundTint);
            tc.copy(orig).lerp(seasTint, 0.35);
        }

        // ==== 夜景发光：阈值触发（避免每帧遍历所有材质） ====
        const nightThreshold = 0.35;
        const crossedIntoNight = (DAYNIGHT.prevDayness > nightThreshold && d <= nightThreshold);
        const crossedOutOfNight = (DAYNIGHT.prevDayness <= nightThreshold && d > nightThreshold);

        if (crossedIntoNight || crossedOutOfNight) {
            const nightFactor = d < nightThreshold ? (1 - d / nightThreshold) : 0;

            // P25C: 窗户光照系统接管建筑 emissive（per-pixel shader）
            if (!window._p25cActive) {
                for (const bm of window._bldMeshes) {
                    if (bm.nightEmissive) {
                        bm.mesh.material.emissive.copy(bm.nightEmissive);
                        bm.mesh.material.emissiveIntensity = nightFactor * 0.7;
                        bm.mesh.material.needsUpdate = true;
                    }
                }
            }

            // CBD 玻璃幕墙 emissive 增强
            for (const gs of window._glassStripes) {
                gs.mesh.material.emissiveIntensity = gs.baseEmissiveIntensity + nightFactor * 0.8;
            }

            // P17: 内饰映射窗户夜间发光
            for (const im of window._interiorWindows) {
                im.uniforms.uNightFactor.value = nightFactor;
            }

            // 路灯
            for (const lamp of window._lampLights) {
                lamp.intensity = 1.0 + nightFactor * 7.0;
            }
        }

        // 路灯渐变（在阈值区间内平滑）
        if (d < nightThreshold + 0.08) {
            const nf = d < nightThreshold ? (1 - d / nightThreshold) : 0;
            for (const lamp of window._lampLights) {
                lamp.intensity = 1.0 + nf * 7.0;
            }
        }

        // P17: 内饰窗户持续渐变 (每帧更新 nightFactor)
        const smoothNightFactor = d < nightThreshold ? (1 - d / nightThreshold) * (d < nightThreshold * 0.5 ? 1.0 : (nightThreshold - d) / (nightThreshold * 0.5)) : 0;
        for (const im of window._interiorWindows) {
            im.uniforms.uNightFactor.value = smoothNightFactor;
        }
    }

