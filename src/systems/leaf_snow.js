    let leafMesh = null;
    let leafData = []; // {baseX, baseY, baseZ, phase, speed, wobble}
    const LEAF_COUNT = 300;
    
    function createLeafSystem() {
        if (leafMesh) return;
        
        // 小方形 plane geometry（带秋叶色）
        const leafGeo = new THREE.PlaneGeometry(0.3, 0.2);
        leafGeo.translate(0.15, 0.1, 0);
        const leafMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(SEASON.lerped.leafColor),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75,
            depthWrite: false
        });
        leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, LEAF_COUNT);
        leafMesh.renderOrder = 2;
        leafMesh.visible = false;
        scene.add(leafMesh);
        window._leafMesh = leafMesh;
        
        // 初始化每个叶子的轨道参数
        const spawnW = 40, spawnH = 22;
        leafData = [];
        for (let i = 0; i < LEAF_COUNT; i++) {
            leafData.push({
                baseX: rng.range(-spawnW, spawnW),
                baseY: rng.range(spawnH * 0.2, spawnH),
                baseZ: rng.range(-spawnW, spawnW),
                phase: rng.float() * Math.PI * 2,
                speed: 0.15 + rng.float() * 0.5,
                wobble: 0.3 + rng.float() * 0.8,
                spin: 0.5 + rng.float() * 2.5
            });
        }
    }
    
    function updateLeafSystem(dt) {
        if (!leafMesh) return;
        const amount = SEASON.lerped.leafAmount;
        leafMesh.visible = amount > 0.02;
        if (!leafMesh.visible) return;
        
        const mat = leafMesh.material;
        mat.color.set(SEASON.lerped.leafColor);
        mat.opacity = 0.5 + amount * 0.4;
        
        const dummy = new THREE.Object3D();
        const cx = camera ? camera.position.x : 0;
        const cz = camera ? camera.position.z : 0;
        const spawnW = 40, spawnH = 22;
        
        for (let i = 0; i < LEAF_COUNT; i++) {
            const d = leafData[i];
            d.baseY -= d.speed * dt;
            
            // 绕圈重置
            if (d.baseY < 0) {
                d.baseY = spawnH * 0.5 + rng.float() * spawnH * 0.5;
                d.baseX = cx + rng.range(-spawnW, spawnW);
                d.baseZ = cz + rng.range(-spawnW, spawnW);
            }
            
            // 水平漂移+摆动
            const t = performance.now() * 0.001 + d.phase;
            const wx = Math.sin(t * d.wobble) * 0.3;
            const wz = Math.cos(t * d.wobble * 1.3) * 0.3;
            const wind = WEATHER.wind.force || new THREE.Vector3(0, 0, 0);
            
            const x = d.baseX + wx + wind.x * 0.03;
            const y = d.baseY;
            const z = d.baseZ + wz + wind.z * 0.03;
            
            dummy.position.set(x, y, z);
            // 旋转下落
            dummy.rotation.set(
                t * d.spin * 0.7,
                t * d.spin * 1.2,
                Math.sin(t * d.wobble * 0.5) * 0.6
            );
            dummy.updateMatrix();
            leafMesh.setMatrixAt(i, dummy.matrix);
        }
        leafMesh.instanceMatrix.needsUpdate = true;
    }

    // ---- P20B: 冬雪系统 (InstancedMesh Billboard, 30K flakes) ----
    let snowMesh = null;
    const SNOW_COUNT_MOBILE = 12000;
    const SNOW_COUNT_DESKTOP = 30000;

    function createSnowSystem() {
        if (snowMesh) return;
        const count = isMobile ? SNOW_COUNT_MOBILE : SNOW_COUNT_DESKTOP;
        const spawnW = 45, spawnH = 30;

        // shared quad geometry
        const quadGeo = new THREE.PlaneGeometry(1, 1);
        // per-instance random data: (sizeVariation, phaseSeed)
        const randData = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
            randData[i*2] = rng.float();
            randData[i*2+1] = rng.float() * Math.PI * 2;
        }
        quadGeo.setAttribute('aRand', new THREE.InstancedBufferAttribute(randData, 2));

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: {value:0}, uAmount: {value:0}, uWind: {value:new THREE.Vector3()},
                uSpeed: {value:2.5}, uSway: {value:0.7}, uSpawnH: {value:spawnH}, uSpawnW: {value:spawnW},
                uCameraPos: {value:new THREE.Vector3()}
            },
            vertexShader: `
                attribute vec2 aRand;
                uniform float uTime, uAmount, uSpeed, uSway, uSpawnH, uSpawnW;
                uniform vec3 uWind, uCameraPos;
                varying float vAlpha;
                varying vec2 vUv;
                varying float vCore;
                void main() {
                    vec3 basePos = instanceMatrix[3].xyz;
                    float phase = aRand.y;
                    float fallSpeed = uSpeed * (0.55 + 0.80 * aRand.y) * max(uAmount, 0.001);
                    float cycleT = uSpawnH / fallSpeed;
                    float rawT = mod(uTime + phase * cycleT * 0.35, cycleT);
                    float t = rawT / cycleT;
                    float newY = uSpawnH - t * uSpawnH;
                    // figure-eight flutter
                    float sf = uSway * (0.25 + 0.75 * aRand.y) * uAmount;
                    float swayX = sin(uTime*0.7+phase) + 0.35*sin(uTime*1.6+phase*1.7);
                    float swayZ = cos(uTime*0.6+phase) + 0.35*cos(uTime*1.3+phase*1.3);
                    // wind drift (subtle; accumulates over t)
                    float windX = uWind.x * t * 0.025;
                    float windZ = uWind.z * t * 0.025;
                    vec3 animatedPos = vec3(
                        basePos.x + windX + swayX * sf,
                        newY,
                        basePos.z + windZ + swayZ * sf
                    );
                    // camera-centered volume wrapping
                    vec3 camFloor = vec3(uCameraPos.x, 0.0, uCameraPos.z);
                    vec3 vol = vec3(uSpawnW * 2.0, uSpawnH, uSpawnW * 2.0);
                    vec3 origin = camFloor - vec3(uSpawnW, 0.0, uSpawnW);
                    animatedPos = mod(animatedPos - origin, vol) + origin;
                    // billboard: extract camera right/up from viewMatrix
                    float size = (0.05 + aRand.x * 0.10) * uAmount;
                    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]) * size;
                    vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]) * size;
                    vec3 worldPos = animatedPos + right * position.x + up * position.y;
                    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
                    vUv = uv;
                    vAlpha = smoothstep(0.0, 0.04, t) * smoothstep(1.0, 0.84, t) * uAmount;
                    vCore = aRand.x;
                }
            `,
            fragmentShader: `
                varying float vAlpha;
                varying vec2 vUv;
                varying float vCore;
                void main() {
                    float d = length(vUv - 0.5) * 2.0;
                    float disc = 1.0 - smoothstep(0.70, 1.0, d);
                    float core = 1.0 - smoothstep(0.0, 0.32, d);
                    float alpha = disc * 0.58 + core * 0.22 * (0.5 + 0.5 * vCore);
                    alpha *= vAlpha;
                    if (alpha < 0.003) discard;
                    gl_FragColor = vec4(0.95, 0.97, 1.0, alpha);
                }
            `,
            transparent: true, depthWrite: false, blending: THREE.NormalBlending
        });

        snowMesh = new THREE.InstancedMesh(quadGeo, mat, count);
        snowMesh.frustumCulled = false;
        snowMesh.renderOrder = 1;
        snowMesh.visible = false;

        // initialize instance matrices with random positions in volume
        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            dummy.position.set(
                rng.range(-spawnW, spawnW),
                rng.float() * spawnH,
                rng.range(-spawnW, spawnW)
            );
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            snowMesh.setMatrixAt(i, dummy.matrix);
        }
        snowMesh.instanceMatrix.needsUpdate = true;

        scene.add(snowMesh);
        window._snowMesh = snowMesh;
    }

    function updateSnowSystem(dt) {
        if (!snowMesh) return;
        const amount = SEASON.lerped.snowAmount;
        snowMesh.visible = amount > 0.02;
        if (!snowMesh.visible) return;
        const m = snowMesh.material;
        m.uniforms.uTime.value += dt;
        m.uniforms.uAmount.value = amount;
        m.uniforms.uWind.value.copy(WEATHER.wind.force || WEATHER.wind.dir);
        if (camera) m.uniforms.uCameraPos.value.copy(camera.position);
    }

    // ===== P15: 植被系统 (Cross-Plane Instanced Billboard) =====
    let treeMesh = null;
    let treeData = []; // {pos, scale, type, swayPhase, swaySpeed}
    let treeAtlas = null;
    const TREE_COUNT = 400;
    const TREE_ATLAS_COLS = 3, TREE_ATLAS_ROWS = 2;
    const TREE_TYPES = [
        { name:'round',    canopyW:3.5, canopyH:4.0, trunkH:2.0, trunkW:0.3 },  // 圆形阔叶
        { name:'cone',     canopyW:2.5, canopyH:5.5, trunkH:2.5, trunkW:0.25 }, // 锥形针叶
        { name:'palm',     canopyW:4.0, canopyH:3.0, trunkH:4.0, trunkW:0.2 },  // 棕榈扇形
        { name:'bush',     canopyW:2.0, canopyH:2.0, trunkH:0.6, trunkW:0.15 }, // 低矮灌木
        { name:'weeping',  canopyW:3.0, canopyH:3.5, trunkH:2.5, trunkW:0.25 }, // 垂枝
        { name:'columnar', canopyW:1.8, canopyH:5.0, trunkH:2.0, trunkW:0.2 },  // 柱状
    ];

    function generateTreeAtlas() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cw = size / TREE_ATLAS_COLS;
        const ch = size / TREE_ATLAS_ROWS;

        function drawTreeCell(ctx, ox, oy, w, h, type) {
            ctx.save();
            const cx = ox + w / 2, baseY = oy + h;
            const trunkH_ratio = type.trunkH / (type.trunkH + type.canopyH);
            const canopyTop = baseY - (type.trunkH + type.canopyH) * (h / (type.trunkH + type.canopyH)) * 0.95;
            const trunkTop = canopyTop;

            // 树干 (棕色渐变)
            const trunkGrad = ctx.createLinearGradient(0, trunkTop, 0, baseY);
            trunkGrad.addColorStop(0, '#5a3a1a');
            trunkGrad.addColorStop(0.6, '#4a2a10');
            trunkGrad.addColorStop(1, '#3a1a08');
            ctx.fillStyle = trunkGrad;
            const tw = type.trunkW * 0.25 * w;
            ctx.fillRect(cx - tw / 2, trunkTop, tw, baseY - trunkTop);

            // 树冠 (渐变绿)
            const cx2 = cx;
            const canopyY = canopyTop;
            const cR = type.canopyW * 0.15 * w;

            if (type.name === 'round' || type.name === 'bush') {
                const radGrad = ctx.createRadialGradient(cx2, canopyY + cR * 0.3, cR * 0.1, cx2, canopyY + cR * 0.3, cR);
                radGrad.addColorStop(0, '#5a8a30');
                radGrad.addColorStop(0.5, '#3a6a1a');
                radGrad.addColorStop(0.85, '#2a4a10');
                radGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = radGrad;
                ctx.beginPath();
                ctx.arc(cx2, canopyY + cR * 0.5, cR, 0, Math.PI * 2);
                ctx.fill();
                // 高点光
                const hlGrad = ctx.createRadialGradient(cx2 - cR * 0.2, canopyY + cR * 0.2, cR * 0.05, cx2, canopyY + cR * 0.4, cR * 0.8);
                hlGrad.addColorStop(0, 'rgba(140,200,80,0.5)');
                hlGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = hlGrad;
                ctx.beginPath();
                ctx.arc(cx2, canopyY + cR * 0.5, cR, 0, Math.PI * 2);
                ctx.fill();
            } else if (type.name === 'cone') {
                const grad = ctx.createLinearGradient(0, canopyY, 0, canopyY + cR * 2.2);
                grad.addColorStop(0, '#3a6a1a');
                grad.addColorStop(0.6, '#2a5010');
                grad.addColorStop(1, '#1a3008');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(cx2, canopyY - cR * 0.1);
                ctx.lineTo(cx2 + cR * 0.6, canopyY + cR * 2.2);
                ctx.lineTo(cx2 - cR * 0.6, canopyY + cR * 2.2);
                ctx.closePath();
                ctx.fill();
                // 层次
                for (let li = 0; li < 3; li++) {
                    const ly = canopyY + cR * (0.6 + li * 0.55);
                    const lw = cR * (0.55 - li * 0.12);
                    ctx.fillStyle = li % 2 === 0 ? '#4a7a20' : '#3a5a14';
                    ctx.beginPath();
                    ctx.moveTo(cx2, ly - cR * 0.15);
                    ctx.lineTo(cx2 + lw, ly + cR * 0.4);
                    ctx.lineTo(cx2 - lw, ly + cR * 0.4);
                    ctx.closePath();
                    ctx.fill();
                }
            } else if (type.name === 'palm') {
                // 扇形叶片
                for (let fi = 0; fi < 7; fi++) {
                    const angle = -Math.PI * 0.7 + fi * Math.PI * 1.4 / 6;
                    const leafLen = cR * 1.3;
                    ctx.strokeStyle = fi % 2 === 0 ? '#4a8a20' : '#3a6a14';
                    ctx.lineWidth = 2 + Math.random() * 2;
                    ctx.beginPath();
                    const lx = cx2 + Math.cos(angle) * leafLen * 0.3;
                    const ly = canopyY + Math.sin(angle) * leafLen * 0.3;
                    ctx.moveTo(cx2, canopyY + cR * 0.2);
                    ctx.quadraticCurveTo(lx, ly - leafLen * 0.3, cx2 + Math.cos(angle) * leafLen, canopyY + Math.sin(angle) * leafLen);
                    ctx.stroke();
                }
                // 树干要更高更细
                ctx.fillStyle = '#6a5a3a';
                ctx.fillRect(cx2 - 1.5, trunkTop - type.trunkH * 0.3 * (h / 8), 3, baseY - trunkTop + type.trunkH * 0.3 * (h / 8));
            } else if (type.name === 'weeping') {
                const radGrad = ctx.createRadialGradient(cx2, canopyY + cR * 0.5, cR * 0.1, cx2, canopyY + cR * 0.5, cR);
                radGrad.addColorStop(0, '#6a9a3a');
                radGrad.addColorStop(0.5, '#4a6a20');
                radGrad.addColorStop(0.85, '#2a4a10');
                radGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = radGrad;
                ctx.beginPath();
                ctx.ellipse(cx2, canopyY + cR * 0.7, cR * 0.9, cR * 1.1, 0, 0, Math.PI * 2);
                ctx.fill();
                // 下垂线条
                for (let di = 0; di < 8; di++) {
                    const dx = cx2 + (di - 3.5) * cR * 0.25;
                    ctx.strokeStyle = `rgba(60,120,30,${0.3 + Math.random() * 0.4})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(dx, canopyY + cR * 0.3);
                    ctx.quadraticCurveTo(dx + (Math.random() - 0.5) * cR * 0.5, canopyY + cR * 1.2, dx, canopyY + cR * 1.6);
                    ctx.stroke();
                }
            } else if (type.name === 'columnar') {
                const grad = ctx.createLinearGradient(0, canopyY, 0, canopyY + cR * 2.5);
                grad.addColorStop(0, '#4a7a20');
                grad.addColorStop(1, '#1a3008');
                ctx.fillStyle = grad;
                const rTop = cR * 0.35, rBot = cR * 0.5;
                ctx.beginPath();
                ctx.moveTo(cx2 - rTop, canopyY);
                ctx.lineTo(cx2 - rBot, canopyY + cR * 2.5);
                ctx.lineTo(cx2 + rBot, canopyY + cR * 2.5);
                ctx.lineTo(cx2 + rTop, canopyY);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }

        for (let row = 0; row < TREE_ATLAS_ROWS; row++) {
            for (let col = 0; col < TREE_ATLAS_COLS; col++) {
                const idx = row * TREE_ATLAS_COLS + col;
                if (idx < TREE_TYPES.length) {
                    const ox = col * cw, oy = row * ch;
                    drawTreeCell(ctx, ox, oy, cw, ch, TREE_TYPES[idx]);
                }
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        return tex;
    }

    function createTreeCrossGeometry(typeIdx) {
        const t = TREE_TYPES[typeIdx];
        const totalH = t.trunkH + t.canopyH;
        const hw = t.canopyW / 2;
        const hh = totalH;
        // 十字平面: 两片互相垂直的 Quad
        const verts = [];
        const uvs = [];
        const indices = [];

        // 计算该树型在图集中的 UV 区域
        const cellW = 1 / TREE_ATLAS_COLS;
        const cellH = 1 / TREE_ATLAS_ROWS;
        const col = typeIdx % TREE_ATLAS_COLS;
        const row = Math.floor(typeIdx / TREE_ATLAS_COLS);
        const u0 = col * cellW + cellW * 0.08;
        const u1 = (col + 1) * cellW - cellW * 0.08;
        const v0 = row * cellH + cellH * 0.02;
        const v1 = (row + 1) * cellH - cellH * 0.02;

        // Plane 1: XZ cross plane (facing along Z axis)
        const off = verts.length / 3;
        verts.push(-hw, 0, 0, -hw, hh, 0, hw, hh, 0, hw, 0, 0);
        uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
        indices.push(off, off + 1, off + 2, off, off + 2, off + 3);

        // Plane 2: XZ cross plane (facing along X axis)
        const off2 = verts.length / 3;
        verts.push(0, 0, -hw, 0, hh, -hw, 0, hh, hw, 0, 0, hw);
        uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
        indices.push(off2, off2 + 1, off2 + 2, off2, off2 + 2, off2 + 3);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }

