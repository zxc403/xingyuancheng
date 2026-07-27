// ===== P25C: 窗户光照系统 (World-Space UV Grid + Emissive) =====
// 基于 onBeforeCompile 注入，DC=0，纯 Shader 逐窗 Hash 亮灭/色温/亮度
// 参考: three-fenestra emissiveVariation + Joost van Dongen Interior Mapping (2008)

window._windowLightRefs = [];
window._p25cActive = true;

// ---- 公共 GLSL 注入片段 (所有建筑材质共享，保证 shader 复用) ----
const WL_DECLARATIONS = `
varying vec3 wlWorldPos;
varying vec3 wlNormal;
uniform float wlNight;
uniform vec3 wlSeed;

float wl_hash3(vec3 p) { float h = dot(p, vec3(127.1, 311.7, 74.7)); return fract(sin(h) * 43758.5453123); }
float wl_hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

const WL_VERTEX = `
vec4 wl_wp = modelMatrix * vec4(position, 1.0);
wlWorldPos = wl_wp.xyz;
wlNormal = normalize(mat3(modelMatrix) * normal);
`;

const WL_EMISSIVE = `
// P25C: 窗户发光 (World-Space Grid, 仅侧立面)
if (wlNight > 0.003 && abs(wlNormal.y) < 0.65) {
    // 墙面投影：根据法线方向选择正确的 2D 坐标轴
    vec2 wallUV;
    if (abs(wlNormal.x) > abs(wlNormal.z)) {
        wallUV = vec2(wlWorldPos.z, wlWorldPos.y);
    } else {
        wallUV = vec2(wlWorldPos.x, wlWorldPos.y);
    }

    // 窗格尺寸: 宽~3.4m x 高~3.8m (含墙体间距)
    float cw = 3.4 + wl_hash3(wlSeed + vec3(1.0, 0.0, 0.0)) * 0.7;
    float ch = 3.8 + wl_hash3(wlSeed + vec3(0.0, 1.0, 0.0)) * 0.9;
    vec2 cellUV = wallUV / vec2(cw, ch);
    vec2 cellIdx = floor(cellUV);
    vec2 cellFrac = fract(cellUV);

    // 窗户区域判定: 格中心方形区域
    vec2 center = cellFrac - 0.5;
    float margin = 0.07 + wl_hash2(cellIdx + wlSeed.xy * 0.37) * 0.05;
    float inside = 1.0 - smoothstep(0.30 - margin, 0.38, max(abs(center.x), abs(center.y)));

    if (inside > 0.0) {
        // 逐窗 Hash 决定: 亮/灭、暖/冷/TV蓝、亮度
        float hs = wl_hash2(cellIdx + wlSeed.xy * 13.0);
        if (hs < 0.58) {
            float ct = wl_hash2(cellIdx + wlSeed.xy * 29.0);
            float bt = 0.3 + wl_hash2(cellIdx + wlSeed.xy * 41.0) * 0.5;
            vec3 wc;
            if (ct < 0.18) {
                wc = vec3(0.55, 0.68, 0.95);  // 冷白 fluorescent
            } else if (ct > 0.88) {
                wc = vec3(0.25, 0.35, 0.88);  // TV 蓝紫光
                bt *= 0.65;
            } else {
                wc = vec3(1.0, 0.82, 0.48);   // 暖白 incandescent 2700K
            }
            // 高层略亮 (模拟办公室更亮)
            float heightBoost = smoothstep(0.0, 45.0, wlWorldPos.y) * 0.15;
            totalEmissiveRadiance += wc * (bt + heightBoost) * inside * wlNight;
        }
    }
}
`;

// ---- 将窗户光照注入材质 ----
function injectWindowLights(material, worldPos) {
    if (material.userData._wlInjected) return;
    material.userData._wlInjected = true;

    material.onBeforeCompile = (shader) => {
        // Seed (基于建筑世界位置，同一建筑各面一致)
        shader.uniforms.wlNight = { value: 0.0 };
        shader.uniforms.wlSeed  = { value: new THREE.Vector3(
            worldPos.x * 0.37, worldPos.z * 0.37, 0.5
        )};

        // 注入声明
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            '#include <common>\n' + WL_DECLARATIONS
        );

        // 注入顶点代码
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n' + WL_VERTEX
        );

        // 注入 emissive 计算（在 emissivemap_fragment 之后叠加）
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\n' + WL_EMISSIVE
        );

        window._windowLightRefs.push({
            uniforms: shader.uniforms,
            material: material
        });
    };

    material.needsUpdate = true;
}

// ---- 批量处理所有建筑材质 ----
function createWindowLights() {
    if (!window._bldMeshes) return 0;

    let count = 0;
    for (const bm of window._bldMeshes) {
        if (!bm.mesh || !bm.mesh.material) continue;

        const mats = Array.isArray(bm.mesh.material) ? bm.mesh.material : [bm.mesh.material];
        const pos = bm.mesh.position;

        for (const mat of mats) {
            if ((mat.isMeshStandardMaterial || mat.isMeshPhongMaterial) && !mat.userData._wlInjected) {
                injectWindowLights(mat, pos);
                count++;
            }
        }
    }

    console.log(`[P25C] 窗户光照注入 ${count} 个材质 (共 ${window._windowLightRefs.length} 个 shader 实例)`);
    return count;
}

// ---- 每帧更新 nightFactor ----
function updateWindowLights(dt) {
    const night = window._nightSmooth || 0.0;
    for (const ref of window._windowLightRefs) {
        if (ref.uniforms && ref.uniforms.wlNight !== undefined) {
            ref.uniforms.wlNight.value = night;
        }
    }
}

// 挂载到 window
window.createWindowLights = createWindowLights;
window.updateWindowLights = updateWindowLights;
