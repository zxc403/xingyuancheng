// ===== P25C+P25D: 窗户光照系统 (World-Space UV Grid + Interior Mapping) =====
// P25C: 基于 onBeforeCompile 注入，DC=0，纯 Shader 逐窗 Hash 亮灭/色温/亮度
// P25D: Interior Mapping (方案B) — 近景射线步进假3D房间, LOD 混合远景 UV Grid
// 参考: three-fenestra emissiveVariation + Joost van Dongen Interior Mapping (2008)

window._windowLightRefs = [];
window._p25cActive = true;

// ---- P25D: 房间纹理图集生成器 (4×4 = 16 种房间, Canvas 程序化) ----
function generateRoomAtlas() {
    const cellSize = 256, cols = 4, rows = 4;
    const canvas = document.createElement('canvas');
    canvas.width = cellSize * cols;
    canvas.height = cellSize * rows;
    const ctx = canvas.getContext('2d');
    const styles = [
        { w:[74,58,42],  f:[42,32,21], t:'living'  },
        { w:[58,69,85],  f:[26,37,53], t:'office'  },
        { w:[85,58,58],  f:[53,32,32], t:'bedroom' },
        { w:[58,74,58],  f:[32,42,32], t:'kitchen' },
        { w:[69,58,85],  f:[37,26,53], t:'bath'    },
        { w:[85,74,58],  f:[53,42,32], t:'dining'  },
        { w:[42,53,64],  f:[21,26,37], t:'empty'   },
        { w:[74,69,53],  f:[42,37,21], t:'office'  },
        { w:[58,58,69],  f:[26,26,37], t:'living'  },
        { w:[85,58,69],  f:[53,32,37], t:'bedroom' },
        { w:[69,74,85],  f:[37,42,53], t:'office'  },
        { w:[58,69,64],  f:[26,37,32], t:'kitchen' },
        { w:[85,69,53],  f:[53,42,21], t:'living'  },
        { w:[53,58,85],  f:[21,26,53], t:'office'  },
        { w:[85,58,48],  f:[53,32,21], t:'dining'  },
        { w:[58,85,74],  f:[26,53,42], t:'living'  },
    ];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            const s = styles[idx];
            const x = c * cellSize, y = r * cellSize;
            const cx = x + cellSize / 2;
            const rng = (n) => { let h = (idx * 9301 + n * 49297 + 233280) % 233280; return h / 233280; };
            // Wall gradient
            const grad = ctx.createLinearGradient(x, y, x, y + cellSize);
            grad.addColorStop(0, `rgb(${s.w[0]*0.82|0},${s.w[1]*0.82|0},${s.w[2]*0.82|0})`);
            grad.addColorStop(0.5, `rgb(${s.w[0]},${s.w[1]},${s.w[2]})`);
            grad.addColorStop(1, `rgb(${s.w[0]*0.65|0},${s.w[1]*0.65|0},${s.w[2]*0.65|0})`);
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, cellSize, cellSize);
            // Floor strip
            ctx.fillStyle = `rgb(${s.f[0]},${s.f[1]},${s.f[2]})`;
            ctx.fillRect(x, y + cellSize * 0.82, cellSize, cellSize * 0.18);
            ctx.fillStyle = `rgba(${s.f[0]+22|0},${s.f[1]+22|0},${s.f[2]+22|0},0.5)`;
            ctx.fillRect(x, y + cellSize * 0.82, cellSize, 2);
            // Ceiling strip
            ctx.fillStyle = `rgba(${s.w[0]+12|0},${s.w[1]+12|0},${s.w[2]+12|0},0.6)`;
            ctx.fillRect(x, y, cellSize, cellSize * 0.08);
            // Furniture
            const dark = 'rgba(28,24,18,0.82)';
            if (s.t === 'living') {
                ctx.fillStyle = dark; ctx.fillRect(cx-65, y+cellSize*0.6, 130, 28); ctx.fillRect(cx-65, y+cellSize*0.53, 130, 12);
                ctx.fillStyle = 'rgba(38,34,25,0.7)'; ctx.fillRect(cx+52, y+cellSize*0.66, 18, 20);
                if (rng(1) > 0.4) {
                    ctx.fillStyle = 'rgba(12,12,30,0.9)'; ctx.fillRect(cx-35, y+cellSize*0.14, 70, 42);
                    const tg = ctx.createRadialGradient(cx, y+cellSize*0.35, 4, cx, y+cellSize*0.35, 38);
                    tg.addColorStop(0, 'rgba(70,110,190,0.5)'); tg.addColorStop(1, 'rgba(35,55,110,0.05)');
                    ctx.fillStyle = tg; ctx.fillRect(cx-32, y+cellSize*0.17, 64, 36);
                }
            } else if (s.t === 'office') {
                ctx.fillStyle = dark; ctx.fillRect(cx-55, y+cellSize*0.6, 110, 22);
                ctx.fillStyle = 'rgba(18,18,18,0.7)'; ctx.fillRect(cx-18, y+cellSize*0.7, 36, 16);
                ctx.fillStyle = 'rgba(12,18,28,0.9)'; ctx.fillRect(cx-28, y+cellSize*0.26, 56, 38);
                const mg = ctx.createRadialGradient(cx, y+cellSize*0.45, 3, cx, y+cellSize*0.45, 28);
                mg.addColorStop(0, 'rgba(55,95,155,0.5)'); mg.addColorStop(1, 'rgba(25,45,85,0.05)');
                ctx.fillStyle = mg; ctx.fillRect(cx-25, y+cellSize*0.29, 50, 32);
                ctx.fillStyle = 'rgba(28,24,18,0.5)'; ctx.fillRect(x+cellSize*0.04, y+cellSize*0.18, 10, cellSize*0.5);
            } else if (s.t === 'bedroom') {
                ctx.fillStyle = 'rgba(50,38,32,0.82)'; ctx.fillRect(cx-60, y+cellSize*0.6, 120, 28);
                ctx.fillStyle = 'rgba(68,58,53,0.7)'; ctx.fillRect(cx-55, y+cellSize*0.58, 110, 8);
                ctx.fillStyle = 'rgba(78,73,68,0.6)';
                ctx.fillRect(cx-50, y+cellSize*0.56, 35, 8); ctx.fillRect(cx+15, y+cellSize*0.56, 35, 8);
                ctx.fillStyle = 'rgba(32,26,20,0.7)';
                ctx.fillRect(cx-85, y+cellSize*0.66, 18, 20); ctx.fillRect(cx+67, y+cellSize*0.66, 18, 20);
                const lg = ctx.createRadialGradient(cx-76, y+cellSize*0.7, 2, cx-76, y+cellSize*0.7, 14);
                lg.addColorStop(0, 'rgba(255,200,100,0.4)'); lg.addColorStop(1, 'rgba(255,200,100,0)');
                ctx.fillStyle = lg; ctx.fillRect(cx-95, y+cellSize*0.58, 40, 30);
            } else if (s.t === 'kitchen') {
                ctx.fillStyle = dark; ctx.fillRect(x+cellSize*0.04, y+cellSize*0.58, cellSize*0.92, 22);
                ctx.fillStyle = 'rgba(52,50,43,0.9)'; ctx.fillRect(x+cellSize*0.04, y+cellSize*0.58, cellSize*0.92, 4);
                ctx.fillStyle = 'rgba(30,28,24,0.7)';
                ctx.fillRect(x+cellSize*0.04, y+cellSize*0.08, cellSize*0.92, 24);
                ctx.fillRect(x+cellSize*0.04, y+cellSize*0.33, cellSize*0.92, 24);
            } else if (s.t === 'dining') {
                ctx.fillStyle = dark; ctx.fillRect(cx-50, y+cellSize*0.58, 100, 25);
                ctx.fillStyle = 'rgba(22,20,16,0.7)';
                ctx.fillRect(cx-70, y+cellSize*0.66, 18, 18); ctx.fillRect(cx+52, y+cellSize*0.66, 18, 18);
                ctx.fillRect(cx-15, y+cellSize*0.7, 30, 14);
            } else if (s.t === 'bath') {
                ctx.fillStyle = 'rgba(55,55,60,0.7)'; ctx.fillRect(x+cellSize*0.08, y+cellSize*0.53, cellSize*0.5, 30);
                ctx.fillStyle = 'rgba(48,48,53,0.6)'; ctx.fillRect(x+cellSize*0.63, y+cellSize*0.63, 32, 20);
            } else {
                for (let i = 0; i < 6; i++) {
                    ctx.fillStyle = `rgba(0,0,0,${0.04 + rng(i)*0.06})`;
                    ctx.fillRect(x + rng(i*2)*cellSize, y + rng(i*2+1)*cellSize*0.7, 3+rng(i+3)*5, 3+rng(i+4)*5);
                }
            }
            // Subtle noise
            for (let i = 0; i < 80; i++) {
                const nx = x + rng(i*3) * cellSize, ny = y + rng(i*3+1) * cellSize;
                ctx.fillStyle = `rgba(${rng(i*5)>0.5?255:0},${rng(i*5+1)>0.5?255:0},${rng(i*5+2)>0.5?255:0},0.015)`;
                ctx.fillRect(nx, ny, 2, 2);
            }
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
}

// ---- 公共 GLSL 注入片段 (所有建筑材质共享，保证 shader 复用) ----
const WL_DECLARATIONS = `
varying vec3 wlWorldPos;
varying vec3 wlNormal;
uniform float wlNight;
uniform vec3 wlSeed;
uniform vec3 wlCameraPos;
uniform sampler2D wlRoomAtlas;
uniform float wlAtlasCols;
uniform float wlAtlasRows;

float wl_hash3(vec3 p) { float h = dot(p, vec3(127.1, 311.7, 74.7)); return fract(sin(h) * 43758.5453123); }
float wl_hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// ===== P25D: Interior Mapping ray-box intersection =====
// entry: window-local position (world units, relative to window center)
// rayDir: view direction in wall space, depth-normalized (z=1 per step)
// roomHalf: half-extents (width/2, height/2)
// roomDepth: room depth in world units
// Returns vec4(hitUV.x, hitUV.y, faceId, hitFlag)
// faceId: 0=back, 1=floor, 2=ceiling, 3=left, 4=right
vec4 imRayBox(vec2 entry, vec2 rayDir, vec2 roomHalf, float roomDepth) {
    // Back wall at z = roomDepth
    vec2 backHit = entry + rayDir * roomDepth;
    if (abs(backHit.x) <= roomHalf.x && abs(backHit.y) <= roomHalf.y) {
        return vec4(backHit / (roomHalf * 2.0) + 0.5, 0.0, 1.0);
    }
    // Floor at y = -roomHalf.y
    if (rayDir.y < -0.001) {
        float t = (-roomHalf.y - entry.y) / rayDir.y;
        if (t > 0.0 && t < roomDepth) {
            float hx = entry.x + rayDir.x * t;
            if (abs(hx) <= roomHalf.x) {
                return vec4(hx / (roomHalf.x * 2.0) + 0.5, t / roomDepth, 1.0, 1.0);
            }
        }
    }
    // Ceiling at y = roomHalf.y
    if (rayDir.y > 0.001) {
        float t = (roomHalf.y - entry.y) / rayDir.y;
        if (t > 0.0 && t < roomDepth) {
            float hx = entry.x + rayDir.x * t;
            if (abs(hx) <= roomHalf.x) {
                return vec4(hx / (roomHalf.x * 2.0) + 0.5, 1.0 - t / roomDepth, 2.0, 1.0);
            }
        }
    }
    // Left wall at x = -roomHalf.x
    if (rayDir.x < -0.001) {
        float t = (-roomHalf.x - entry.x) / rayDir.x;
        if (t > 0.0 && t < roomDepth) {
            float hy = entry.y + rayDir.y * t;
            if (abs(hy) <= roomHalf.y) {
                return vec4(t / roomDepth, hy / (roomHalf.y * 2.0) + 0.5, 3.0, 1.0);
            }
        }
    }
    // Right wall at x = roomHalf.x
    if (rayDir.x > 0.001) {
        float t = (roomHalf.x - entry.x) / rayDir.x;
        if (t > 0.0 && t < roomDepth) {
            float hy = entry.y + rayDir.y * t;
            if (abs(hy) <= roomHalf.y) {
                return vec4(1.0 - t / roomDepth, hy / (roomHalf.y * 2.0) + 0.5, 4.0, 1.0);
            }
        }
    }
    return vec4(0.0, 0.0, -1.0, 0.0);
}
`;

const WL_VERTEX = `
vec4 wl_wp = modelMatrix * vec4(position, 1.0);
wlWorldPos = wl_wp.xyz;
wlNormal = normalize(mat3(modelMatrix) * normal);
`;

const WL_EMISSIVE = `
// ===== P25C+P25D: 窗户发光 (UV Grid 远景 + Interior Mapping 近景, LOD 混合) =====
if (wlNight > 0.003 && abs(wlNormal.y) < 0.65) {
    vec2 wallUV = abs(wlNormal.x) > abs(wlNormal.z) ? vec2(wlWorldPos.z, wlWorldPos.y) : vec2(wlWorldPos.x, wlWorldPos.y);
    float cw = 3.4 + wl_hash3(wlSeed + vec3(1.0,0.0,0.0)) * 0.7;
    float ch = 3.8 + wl_hash3(wlSeed + vec3(0.0,1.0,0.0)) * 0.9;
    vec2 cellUV = wallUV / vec2(cw, ch);
    vec2 cellIdx = floor(cellUV);
    vec2 cellFrac = fract(cellUV);
    vec2 center = cellFrac - 0.5;
    float margin = 0.07 + wl_hash2(cellIdx + wlSeed.xy * 0.37) * 0.05;
    float inside = 1.0 - smoothstep(0.30 - margin, 0.38, max(abs(center.x), abs(center.y)));
    if (inside > 0.0) {
        float hs = wl_hash2(cellIdx + wlSeed.xy * 13.0);
        if (hs < 0.58) {
            float ct = wl_hash2(cellIdx + wlSeed.xy * 29.0);
            float bt = 0.3 + wl_hash2(cellIdx + wlSeed.xy * 41.0) * 0.5;
            vec3 wc = ct < 0.18 ? vec3(0.55,0.68,0.95) : (ct > 0.88 ? vec3(0.25,0.35,0.88) : vec3(1.0,0.82,0.48));
            if (ct > 0.88) bt *= 0.65;
            float hb = smoothstep(0.0, 45.0, wlWorldPos.y) * 0.15;

            // --- P25C: UV Grid emissive (远景 LOD) ---
            vec3 gridEmissive = wc * (bt + hb) * inside * wlNight;

            // --- P25D: Interior Mapping (近景 LOD, 射线步进假3D房间) ---
            float camDist = length(wlWorldPos - wlCameraPos);
            float lodFactor = smoothstep(25.0, 55.0, camDist); // 0=近(IM), 1=远(grid)

            vec3 imEmissive = gridEmissive; // 默认回退到 grid
            if (lodFactor < 0.99) {
                vec3 viewDir = normalize(wlWorldPos - wlCameraPos);
                vec2 viewWall;
                float viewDepth;
                if (abs(wlNormal.x) > abs(wlNormal.z)) {
                    viewWall = vec2(viewDir.z, viewDir.y);
                    viewDepth = -viewDir.x * sign(wlNormal.x);
                } else {
                    viewWall = vec2(viewDir.x, viewDir.y);
                    viewDepth = -viewDir.z * sign(wlNormal.z);
                }
                if (viewDepth > 0.001) {
                    vec2 rayDir = viewWall / viewDepth;
                    vec2 roomHalf = vec2(cw, ch) * 0.5;
                    float roomDepth = (cw + ch) * 0.5 * (1.3 + wl_hash3(vec3(cellIdx, wlSeed.x)) * 0.7);
                    vec2 entry = (cellFrac - 0.5) * vec2(cw, ch);
                    vec4 hit = imRayBox(entry, rayDir, roomHalf, roomDepth);
                    if (hit.w > 0.5) {
                        float roomIdx = floor(wl_hash2(cellIdx + wlSeed.xy * 7.3) * wlAtlasCols * wlAtlasRows);
                        float roomCol = mod(roomIdx, wlAtlasCols);
                        float roomRow = floor(roomIdx / wlAtlasCols);
                        vec2 atlasUV = (vec2(roomCol, wlAtlasRows - 1.0 - roomRow) + hit.xy) / vec2(wlAtlasCols, wlAtlasRows);
                        vec3 roomColor = texture2D(wlRoomAtlas, atlasUV).rgb;
                        float faceShade = hit.z < 0.5 ? 1.0 : (hit.z < 1.5 ? 0.55 : (hit.z < 2.5 ? 0.35 : 0.75));
                        imEmissive = roomColor * faceShade * (bt + hb) * wlNight;
                    }
                }
            }

            totalEmissiveRadiance += mix(imEmissive, gridEmissive, lodFactor);
        }
    }
}
`;

// ---- 将窗户光照注入材质 ----
function injectWindowLights(material, worldPos) {
    if (material.userData._wlInjected) return;
    material.userData._wlInjected = true;

    material.onBeforeCompile = (shader) => {
        shader.uniforms.wlNight = { value: 0.0 };
        shader.uniforms.wlSeed  = { value: new THREE.Vector3(
            worldPos.x * 0.37, worldPos.z * 0.37, 0.5
        )};
        shader.uniforms.wlCameraPos = { value: new THREE.Vector3() };
        shader.uniforms.wlRoomAtlas = { value: window._roomAtlas || null };
        shader.uniforms.wlAtlasCols = { value: 4.0 };
        shader.uniforms.wlAtlasRows = { value: 4.0 };

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            '#include <common>\n' + WL_DECLARATIONS
        );

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n' + WL_VERTEX
        );

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

    // P25D: 生成房间图集
    window._roomAtlas = generateRoomAtlas();

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

    console.log(`[P25C+P25D] 窗户光照注入 ${count} 个材质 (IM 房间图集 4×4 已生成, ${window._windowLightRefs.length} 个 shader 实例)`);
    return count;
}

// ---- 每帧更新 nightFactor + cameraPos ----
function updateWindowLights(dt) {
    const night = window._nightSmooth || 0.0;
    const camPos = (typeof camera !== 'undefined' && camera) ? camera.position : null;
    for (const ref of window._windowLightRefs) {
        if (ref.uniforms && ref.uniforms.wlNight !== undefined) {
            ref.uniforms.wlNight.value = night;
        }
        if (camPos && ref.uniforms && ref.uniforms.wlCameraPos !== undefined) {
            ref.uniforms.wlCameraPos.value.copy(camPos);
        }
    }
}

// 挂载到 window
window.generateRoomAtlas = generateRoomAtlas;
window.createWindowLights = createWindowLights;
window.updateWindowLights = updateWindowLights;
