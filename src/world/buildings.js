    // ===== P4: 建筑生成 (程序化建筑体) =====
    // 判别地块所属城区
    function getDistrict(cx, cz) {
        const da = dist2D(cx,cz, 90,100); // A上城CBD
        const db = dist2D(cx,cz, 0,50);   // B中城商住
        const dc = dist2D(cx,cz, -100,-90); // C下城工业
        const dd = dist2D(cx,cz, -30,-120); // D河岸
        let best='B', minD=db;
        if (da<minD) { best='A'; minD=da; }
        if (dc<minD) { best='C'; minD=dc; }
        if (dd<minD) { best='D'; minD=dd; }
        return best;
    }

    // 城区建筑参数
    const DISTRICT_PARAMS = {
        A: { hMin:30, hMax:85, wMin:6, wMax:18, setback:0.4,  colors:[0x8899bb,0x7788aa,0x99aacc,0x667788], roofChance:0.8, glassChance:0.7 },
        B: { hMin:12, hMax:40, wMin:5, wMax:14, setback:0.25, colors:[0xccbba0,0xbbaa88,0xd4c4a8,0xa89878], roofChance:0.5, glassChance:0.3 },
        C: { hMin:8,  hMax:22, wMin:8, wMax:20, setback:0.15, colors:[0x665544,0x776655,0x554433,0x887766], roofChance:0.2, glassChance:0.1 },
        D: { hMin:10, hMax:30, wMin:5, wMax:16, setback:0.3,  colors:[0x998877,0xaa9988,0x887766,0xbbaa99], roofChance:0.4, glassChance:0.25},
    };

    function buildBuildings() {
        const bldGroup = new THREE.Group();
        bldGroup.name = 'buildings';
        const seed = 42;

        // 简易伪随机（确定性，避免每次刷新不同）
        let s = seed;
        function rnd(mn,mx) { s=(s*1664525+1013904223)&0x7fffffff; return mn+(s/0x7fffffff)*(mx-mn); }

        plots.forEach((plot, idx) => {
            const dist = getDistrict(plot.cx, plot.cz);
            const dp = DISTRICT_PARAMS[dist];
            s = seed + idx * 137;

            // 建筑占地：地块内缩退线
            const setback = rnd(0.8, 1.8) + plot.w * dp.setback;
            const bw = Math.min(plot.w - setback, rnd(dp.wMin*0.5, dp.wMin));
            const bd = Math.min(plot.d - setback, rnd(dp.wMin*0.5, dp.wMin));
            if (bw < 3 || bd < 3) return;

            const totalH = rnd(dp.hMin, dp.hMax);
            const cx = plot.cx + rnd(-0.3,0.3)*(plot.w-bw);
            const cz = plot.cz + rnd(-0.3,0.3)*(plot.d-bd);
            const baseY = getTerrainH(cx, cz);

            // 建筑分段（底座+主体+顶冠）
            const segments = [];
            const segCount = totalH > 45 ? 3 : (totalH > 20 ? 2 : 1);

            if (segCount >= 3) {
                // 三段式：底座宽、中段略收、顶冠窄
                const baseH = totalH*0.15;
                const midH  = totalH*0.65;
                const topH  = totalH*0.20;
                segments.push({h:baseH, w:bw, d:bd, colorIdx:0});
                segments.push({h:midH,  w:bw*0.88, d:bd*0.88, colorIdx:1});
                segments.push({h:topH,  w:bw*0.6, d:bd*0.6, colorIdx:2});
            } else if (segCount === 2) {
                const baseH = totalH*0.25;
                const topH  = totalH*0.75;
                segments.push({h:baseH, w:bw, d:bd, colorIdx:0});
                segments.push({h:topH,  w:bw*0.82, d:bd*0.82, colorIdx:1});
            } else {
                segments.push({h:totalH, w:bw, d:bd, colorIdx:0});
            }

            let accumY = baseY;
            for (const seg of segments) {
                const geo = new THREE.BoxGeometry(seg.w, seg.h, seg.d);
                const color = dp.colors[seg.colorIdx % dp.colors.length];
                const matOpts = {color, roughness:0.6, metalness:0.3};
                // P5: 应用立面窗格纹理
                const fTex = facadeTextures[dist];
                if (fTex) {
                    matOpts.map = fTex;
                    // 让纹理在建筑立面上正确重复
                    const repH = Math.max(1, Math.floor(seg.h / 4));
                    const repW = Math.max(1, Math.floor(Math.max(seg.w, seg.d) / 3));
                    const repTex = fTex.clone();
                    repTex.needsUpdate = true;
                    repTex.repeat.set(repW, repH);
                    matOpts.map = repTex;
                }
                const mat = new THREE.MeshStandardMaterial(matOpts);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(cx, accumY + seg.h/2, cz);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                bldGroup.add(mesh);
                // P6+P8: 记录建筑网格，夜景窗户发光
                window._bldMeshes.push({
                    mesh,
                    nightEmissive: new THREE.Color(dist === 'A' ? 0x8899cc : (dist === 'B' ? 0xffcc66 : 0x665544))
                });
                // P25B: 记录建筑位置供霓虹招牌放置
                window._bldData.push({ cx: parseFloat(cx.toFixed(1)), cz: parseFloat(cz.toFixed(1)), topY: accumY + seg.h, w: seg.w, d: seg.d, dist });
                accumY += seg.h;
            }

            // P17: 内饰映射窗户 (每个建筑分段各面添加小窗平面)
            const interiorMat = window._interiorMat;
            if (interiorMat && segCount > 0) {
                const roomDepth = 3.0;
                const winW = 1.5, winH = 2.0, gap = 0.3;
                const localRng = (function(){ let ss = seed + idx * 971; return function(mn,mx) { ss=(ss*1664525+1013904223)&0x7fffffff; return mn+(ss/0x7fffffff)*(mx-mn); }; })();
                const winGeo = new THREE.PlaneGeometry(winW, winH);

                // 对每个分段添加窗户
                let segAccumY = baseY;
                for (const seg of segments) {
                    const segCY = segAccumY + seg.h / 2;
                    const roomsPerW = Math.max(2, Math.floor(seg.w / (winW + gap)));
                    const roomsPerH = Math.max(2, Math.floor(seg.h / (winH + gap)));
                    const roomsPerD = Math.max(2, Math.floor(seg.d / (winW + gap)));
                    const winWidth  = (seg.w - (roomsPerW-1)*gap) / roomsPerW;
                    const winHeight = (seg.h - (roomsPerH-1)*gap) / roomsPerH;
                    const winDepth  = (seg.d - (roomsPerD-1)*gap) / roomsPerD;

                    // 前/后 (Z轴)
                    for (const zSign of [-1, 1]) {
                        const cols = roomsPerW, rows = roomsPerH;
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                if (localRng(0,1) > 0.65) continue;
                                const wx = -seg.w/2 + c * (winWidth + gap) + winWidth/2 + gap/2;
                                const wy = -seg.h/2 + r * (winHeight + gap) + winHeight/2 + gap/2;
                                const wp = new THREE.Mesh(winGeo, interiorMat.clone());
                                // 前(+Z)面默认朝向OK; 后(-Z)面旋转180°使房间向内延伸
                                wp.position.set(cx + wx, segCY + wy, cz + (zSign > 0 ? seg.d/2 + 0.02 : -(seg.d/2 + 0.02)));
                                if (zSign < 0) wp.rotation.y = Math.PI;
                                wp.material.uniforms.uRoomIndex.value = Math.floor(localRng(0, 3.999));
                                wp.material.uniforms.uRoomDepth.value = roomDepth * localRng(0.7, 1.3);
                                wp.renderOrder = 2;
                                bldGroup.add(wp);
                                window._interiorWindows.push(wp.material);
                            }
                        }
                    }
                    // 左/右 (X轴)
                    for (const xSign of [-1, 1]) {
                        const cols = roomsPerD, rows = roomsPerH;
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                if (localRng(0,1) > 0.65) continue;
                                const wz = -seg.d/2 + c * (winDepth + gap) + winDepth/2 + gap/2;
                                const wy = -seg.h/2 + r * (winHeight + gap) + winHeight/2 + gap/2;
                                const wp = new THREE.Mesh(winGeo, interiorMat.clone());
                                wp.position.set(cx + xSign * (seg.w/2 + 0.02), segCY + wy, cz + wz);
                                wp.rotation.y = xSign > 0 ? Math.PI/2 : -Math.PI/2;
                                wp.material.uniforms.uRoomIndex.value = Math.floor(localRng(0, 3.999));
                                wp.material.uniforms.uRoomDepth.value = roomDepth * localRng(0.7, 1.3);
                                wp.renderOrder = 2;
                                bldGroup.add(wp);
                                window._interiorWindows.push(wp.material);
                            }
                        }
                    }
                    segAccumY += seg.h;
                }
            }

            // 楼顶装饰
            if (rnd(0,1) < dp.roofChance) {
                const roofSize = bw*0.35;
                const roofH = rnd(1.5, 4);
                const roofGeo = new THREE.BoxGeometry(roofSize, roofH, roofSize);
                const roofMat = new THREE.MeshStandardMaterial({color:0x555555, roughness:0.4, metalness:0.7});
                const roof = new THREE.Mesh(roofGeo, roofMat);
                roof.position.set(cx, accumY+roofH/2, cz);
                roof.castShadow = true;
                bldGroup.add(roof);

                // 空调外机 / 水箱小方块
                if (rnd(0,1)>0.5) {
                    const boxGeo = new THREE.BoxGeometry(roofSize*0.4, roofH*0.5, roofSize*0.3);
                    const boxMat = new THREE.MeshStandardMaterial({color:0x888888, roughness:0.5, metalness:0.6});
                    const box = new THREE.Mesh(boxGeo, boxMat);
                    box.position.set(cx+roofSize*0.5, accumY+roofH*0.8, cz);
                    bldGroup.add(box);
                }
            }

            // 玻璃幕墙闪光条 (CBD高层)
            if (dist==='A' && rnd(0,1)<dp.glassChance && totalH>40) {
                const stripeH=totalH*0.7, stripeW=bw*0.07;
                for (let si=0; si<3; si++) {
                    const gGeo = new THREE.BoxGeometry(stripeW, stripeH, bd*1.02);
                    const gMat = new THREE.MeshStandardMaterial({color:0xaaccff, roughness:0.15, metalness:0.9, emissive:0x112233, emissiveIntensity:0.3});
                    const gMesh = new THREE.Mesh(gGeo, gMat);
                    const sx = cx + (si-1)*bw*0.3;
                    gMesh.position.set(sx, baseY+totalH*0.5, cz);
                    bldGroup.add(gMesh);
                    // P6+P8: 玻璃幕墙夜景加强
                    window._glassStripes.push({mesh: gMesh, baseEmissiveIntensity: 0.3});
                }
            }
        });

        scene.add(bldGroup);
        window._bldGroup = bldGroup;
        return bldGroup.children.length;
    }

    // ===== P5: 立面纹理 + 街道家具 + 雾层 =====
    // Canvas 窗格纹理生成
    const facadeTextures = {};

    function generateFacadeTexture(district) {
        const size = 256;
        const cv = document.createElement('canvas');
        cv.width = size; cv.height = size;
        const ctx = cv.getContext('2d');

        let bgColor, winColor, winDensity, winGlow, winShape;

        switch(district) {
        case 'A': // 上城CBD - 蓝灰玻璃幕墙，密集亮窗
            bgColor='#3a4455'; winColor='#8899cc'; winDensity=0.75; winGlow='#aaccff'; winShape='tall';
            break;
        case 'B': // 中城商住 - 米色墙面，中密暖黄窗
            bgColor='#c4b898'; winColor='#ffe8a0'; winDensity=0.50; winGlow='#ffcc66'; winShape='square';
            break;
        case 'C': // 下城工业 - 深灰墙面，稀疏大窗+横条
            bgColor='#4a3f35'; winColor='#998877'; winDensity=0.30; winGlow='#665544'; winShape='wide';
            break;
        case 'D': // 河岸 - 浅褐墙面，中等方窗
        default:
            bgColor='#a89880'; winColor='#eeddbb'; winDensity=0.45; winGlow='#ddaa66'; winShape='square';
            break;
        }

        // 背景墙色
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);

        // 水平楼层线
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        for (let y=0; y<size; y+=size/12) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
        }

        // 垂直柱线
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        for (let x=0; x<size; x+=size/8) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
        }

        // 窗户
        const gap = 4;
        const floorH = Math.floor(size / 12);
        const colW = Math.floor(size / 8);
        for (let row=0; row<12; row++) {
            for (let col=0; col<8; col++) {
                if (rng.float() > winDensity) continue;
                const wx = col*colW + gap, wy = row*floorH + gap;
                let ww, wh;
                if (winShape==='tall')   { ww=colW*0.55; wh=floorH*0.75; }
                else if (winShape==='wide') { ww=colW*0.75; wh=floorH*0.45; }
                else { ww=colW*0.50; wh=floorH*0.55; }

                // 窗框
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(wx-1, wy-1, ww+2, wh+2);
                // 窗玻璃
                const lit = rng.float() < 0.7;
                ctx.fillStyle = lit ? winGlow : winColor;
                ctx.fillRect(wx, wy, ww, wh);
                // 窗格十字
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(wx+ww/2, wy); ctx.lineTo(wx+ww/2, wy+wh); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(wx, wy+wh/2); ctx.lineTo(wx+ww, wy+wh/2); ctx.stroke();
            }
        }

        // CBD 额外：反光条纹
        if (district==='A') {
            for (let i=0; i<4; i++) {
                const sx = 30 + i*60;
                const grad = ctx.createLinearGradient(sx, 0, sx+18, 0);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(0.4, 'rgba(200,220,255,0.25)');
                grad.addColorStop(0.6, 'rgba(200,220,255,0.25)');
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(sx, 0, 18, size);
            }
        }

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        return tex;
    }

    // ===== P17: 内饰映射系统 =====
    // 房间内饰图集 (Canvas 2x2 四类房间)
    function generateInteriorAtlas() {
        const atlasSize = 512, roomSize = 256;
        const cv = document.createElement('canvas');
        cv.width = atlasSize; cv.height = atlasSize;
        const ctx = cv.getContext('2d');
        const rooms = [
            { wall:'#d4c5a9', floor:'#8b7355', ceil:'#f0ead6', accent:'#c0392b', light:'#fff8e7', name:'living' },
            { wall:'#b8c5d6', floor:'#5a5a5a', ceil:'#e8e8e8', accent:'#2c3e50', light:'#e8f0ff', name:'office'  },
            { wall:'#c4d4e0', floor:'#7a6b5a', ceil:'#edf0f5', accent:'#8b4513', light:'#fff0e0', name:'bedroom' },
            { wall:'#e8e4df', floor:'#a09080', ceil:'#f5f2ed', accent:'#666666', light:'#fffff0', name:'corridor'}
        ];
        for (let ri = 0; ri < 4; ri++) {
            const rx = (ri % 2) * roomSize, ry = Math.floor(ri / 2) * roomSize;
            const r = rooms[ri];
            // 天花板 (顶部 30px)
            ctx.fillStyle = r.ceil;
            ctx.fillRect(rx, ry, roomSize, 30);
            const cg = ctx.createRadialGradient(rx+roomSize/2, ry+15, 5, rx+roomSize/2, ry+15, 70);
            cg.addColorStop(0, 'rgba(255,255,240,0.55)'); cg.addColorStop(1, 'rgba(255,255,240,0)');
            ctx.fillStyle = cg;
            ctx.fillRect(rx, ry, roomSize, 30);
            // 背墙 (30~226)
            ctx.fillStyle = r.wall;
            ctx.fillRect(rx, ry+30, roomSize, 196);
            // 装饰画
            ctx.fillStyle = r.accent;
            ctx.fillRect(rx+85, ry+70, 86, 65);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(rx+90, ry+75, 76, 55);
            // 地板 (226~256)
            ctx.fillStyle = r.floor;
            ctx.fillRect(rx, ry+226, roomSize, 30);
            const fg = ctx.createLinearGradient(rx, ry+226, rx, ry+256);
            fg.addColorStop(0, 'rgba(255,255,255,0.08)'); fg.addColorStop(1, 'rgba(0,0,0,0.12)');
            ctx.fillStyle = fg;
            ctx.fillRect(rx, ry+226, roomSize, 30);
            // 房间专属细节
            if (ri === 0) {  // 客厅: 沙发
                ctx.fillStyle = '#8b4513'; ctx.fillRect(rx+70, ry+162, 116, 32);
                ctx.fillStyle = '#a0522d'; ctx.fillRect(rx+64, ry+178, 128, 14);
            } else if (ri === 1) {  // 办公室: 桌+屏
                ctx.fillStyle = '#4a3728'; ctx.fillRect(rx+60, ry+168, 136, 22);
                ctx.fillStyle = '#1a1a2e'; ctx.fillRect(rx+108, ry+138, 44, 32);
                ctx.fillStyle = 'rgba(160,200,255,0.5)'; ctx.fillRect(rx+111, ry+141, 38, 26);
            } else if (ri === 2) {  // 卧室: 床
                ctx.fillStyle = '#e8dcc8'; ctx.fillRect(rx+90, ry+155, 90, 45);
                ctx.fillStyle = '#d4c4a0'; ctx.fillRect(rx+86, ry+151, 98, 10);
                ctx.fillStyle = '#f5efe0'; ctx.fillRect(rx+130, ry+157, 40, 38);
            } else if (ri === 3) {  // 走廊: 门
                ctx.fillStyle = '#6b5b4f'; ctx.fillRect(rx+35, ry+50, 35, 150);
                ctx.fillRect(rx+186, ry+50, 35, 150);
            }
        }
        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        return tex;
    }

    // 内饰映射 ShaderMaterial 工厂
    function createInteriorMaterial(atlas) {
        const vertShader = `
            varying vec3 vLocalPos;
            varying vec3 vLocalCamera;
            varying vec2 vUv;
            varying vec3 vWorldNormal;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vUv = uv;
                vLocalPos = position;
                mat4 invModel = inverse(modelMatrix);
                vLocalCamera = (invModel * vec4(cameraPosition, 1.0)).xyz;
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * mvPosition;
            }
        `;
        const fragShader = `
            uniform sampler2D uRoomAtlas;
            uniform float uRoomDepth;
            uniform float uNightFactor;
            uniform float uRoomIndex;
            varying vec3 vLocalPos;
            varying vec3 vLocalCamera;
            varying vec2 vUv;
            varying vec3 vWorldNormal;
            void main() {
                vec3 viewDir = normalize(vLocalCamera - vLocalPos);
                vec3 boxMin = vec3(-0.5, -0.5, -uRoomDepth);
                vec3 boxMax = vec3(0.5, 0.5, 0.0);
                vec3 tMin = (boxMin - vLocalPos) / viewDir;
                vec3 tMax = (boxMax - vLocalPos) / viewDir;
                vec3 t1 = min(tMin, tMax), t2 = max(tMin, tMax);
                float tNear = max(max(t1.x, t1.y), t1.z);
                float tFar  = min(min(t2.x, t2.y), t2.z);
                if (tNear >= tFar || tFar <= 0.0) { discard; return; }
                float t = tNear > 0.0 ? tNear : tFar;
                vec3 hit = vLocalPos + viewDir * t;
                vec3 ah = abs(hit);
                float roomU = mod(uRoomIndex, 2.0) * 0.5;
                float roomV = floor(uRoomIndex / 2.0) * 0.5;
                vec2 auv;
                if (ah.y >= ah.x && ah.y >= ah.z) {
                    if (hit.y > 0.0) {
                        auv = vec2(roomU + (hit.x + 0.5) * 0.5, roomV + 0.0 + (hit.z / -uRoomDepth) * 0.06);
                    } else {
                        auv = vec2(roomU + (hit.x + 0.5) * 0.5, roomV + 0.44 + (hit.z / -uRoomDepth) * 0.06);
                    }
                } else if (ah.z >= ah.x) {
                    auv = vec2(roomU + (hit.x + 0.5) * 0.5, roomV + 0.06 + (hit.y + 0.5) * 0.38);
                } else {
                    float sideV = (hit.z / -uRoomDepth) * 0.5;
                    auv = vec2(roomU + sideV, roomV + 0.06 + (hit.y + 0.5) * 0.38);
                }
                vec4 texColor = texture2D(uRoomAtlas, auv);
                vec3 lightPos = vec3(0.0, 0.2, -uRoomDepth * 0.3);
                float distL = length(hit - lightPos);
                float atten = 0.28 + 0.72 / (1.0 + distL * distL * 0.35);
                float winLight = max(0.0, hit.z / uRoomDepth + 0.25);
                float emissiveS = uNightFactor * 0.85;
                float amb = mix(0.48, 0.06, uNightFactor);
                vec3 col = texColor.rgb * (amb + atten * 0.48 + winLight * 0.18) + texColor.rgb * emissiveS * 1.15;
                float ef = smoothstep(0.04, 0.0, abs(vUv.x - 0.5) * 2.0) * smoothstep(0.04, 0.0, abs(vUv.y - 0.5) * 2.0);
                col *= mix(0.6, 1.0, ef);
                gl_FragColor = vec4(col, 1.0);
            }
        `;
        return new THREE.ShaderMaterial({
            uniforms: {
                uRoomAtlas: { value: atlas },
                uRoomDepth: { value: 3.0 },
                uNightFactor: { value: 0.0 },
                uRoomIndex: { value: 0.0 }
            },
            vertexShader: vertShader,
            fragmentShader: fragShader,
            side: THREE.DoubleSide
        });
    }

    // 街道家具放置
    function buildStreetFurniture() {
        const furnGroup = new THREE.Group();
        furnGroup.name = 'streetFurniture';

        // 路灯几何复用
        const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 6, 8);
        const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6);
        const lampGeo = new THREE.SphereGeometry(0.35, 8, 6);
        const poleMat = new THREE.MeshStandardMaterial({color:0x333333, roughness:0.4, metalness:0.8});
        const lampMat = new THREE.MeshStandardMaterial({color:0xffeedd, roughness:0.3, metalness:0.2, emissive:0x332211, emissiveIntensity:0.5});

        // 树几何复用
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 3, 6);
        const leafGeo1 = new THREE.SphereGeometry(1.5, 8, 5);
        const leafGeo2 = new THREE.SphereGeometry(1.0, 8, 5);
        const trunkMat = new THREE.MeshStandardMaterial({color:0x5c3a1e, roughness:0.8});
        const leafMat = new THREE.MeshStandardMaterial({color:0x3a6b2a, roughness:0.7});

        const lampInterval = 28;
        const treeInterval = 22;

        for (const s of roadSegments) {
            const dx = s.x2-s.x1, dz = s.z2-s.z1;
            const len = Math.sqrt(dx*dx+dz*dz);
            if (len < 10) continue;
            const nx = -dz/len, nz = dx/len;
            const isArterial = s.w >= 7;

            // 路灯（主干道两侧）
            if (isArterial) {
                const steps = Math.floor(len / lampInterval);
                for (let i=1; i<steps; i++) {
                    const t = i/steps;
                    const px = s.x1+dx*t, pz = s.z1+dz*t;
                    for (const side of [-1, 1]) {
                        const ox = px + nx * side * (s.w*0.5 + 1.5);
                        const oz = pz + nz * side * (s.w*0.5 + 1.5);
                        const gh = getTerrainH(ox, oz);

                        const pole = new THREE.Mesh(poleGeo, poleMat);
                        pole.position.set(ox, gh+3, oz);
                        pole.castShadow = true;
                        furnGroup.add(pole);

                        const arm = new THREE.Mesh(armGeo, poleMat);
                        arm.rotation.z = Math.PI/2;
                        arm.position.set(ox + nx*side*0.9, gh+5.8, oz + nz*side*0.9);
                        furnGroup.add(arm);

                        const lamp = new THREE.Mesh(lampGeo, lampMat);
                        lamp.position.set(ox + nx*side*1.7, gh+5.8, oz + nz*side*1.7);
                        furnGroup.add(lamp);

                        // 点光源
                        const pt = new THREE.PointLight(0xffcc88, 8, 18, 1.5);
                        pt.position.copy(lamp.position);
                        furnGroup.add(pt);
                        // P6+P8: 记录路灯以便日夜切换
                        window._lampLights.push(pt);
                    }
                }
            }

            // 树木（所有道路两侧）
            const tSteps = Math.floor(len / treeInterval);
            for (let i=1; i<tSteps; i++) {
                const px = s.x1+dx*(i/tSteps), pz = s.z1+dz*(i/tSteps);
                const side = i%2===0 ? 1 : -1;
                const ox = px + nx*side*(s.w*0.5 + 2.5 + Math.sin(i*2.3)*0.6);
                const oz = pz + nz*side*(s.w*0.5 + 2.5 + Math.sin(i*2.3)*0.6);
                const gh = getTerrainH(ox, oz);

                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 1.5;
                trunk.castShadow = true;
                tree.add(trunk);

                const leaf1 = new THREE.Mesh(leafGeo1, leafMat);
                leaf1.position.y = 3.5;
                leaf1.castShadow = true;
                tree.add(leaf1);

                const leaf2 = new THREE.Mesh(leafGeo2, leafMat);
                leaf2.position.y = 5.0;
                leaf2.castShadow = true;
                tree.add(leaf2);

                tree.position.set(ox, gh, oz);
                tree.scale.setScalar(0.7 + Math.sin(i*1.7)*0.3);
                furnGroup.add(tree);
            }
        }

        scene.add(furnGroup);
        window._furnGroup = furnGroup;
        return furnGroup.children.length;
    }

