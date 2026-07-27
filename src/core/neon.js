    // ===== P25B: 霓虹招牌 + GTA V 双层 Billboard 辉光系统 =====
    function createNeonSystem() {
        // ---- 辉光 blob 纹理（Canvas 128×128 径向渐变） ----
        const blobCanvas = document.createElement('canvas');
        blobCanvas.width = 128; blobCanvas.height = 128;
        const bctx = blobCanvas.getContext('2d');
        const bgrad = bctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        bgrad.addColorStop(0, 'rgba(255,255,255,1)');
        bgrad.addColorStop(0.08, 'rgba(255,255,255,0.95)');
        bgrad.addColorStop(0.2, 'rgba(255,255,255,0.7)');
        bgrad.addColorStop(0.45, 'rgba(255,255,255,0.25)');
        bgrad.addColorStop(0.7, 'rgba(255,255,255,0.04)');
        bgrad.addColorStop(1, 'rgba(255,255,255,0)');
        bctx.fillStyle = bgrad; bctx.fillRect(0, 0, 128, 128);
        const blobTex = new THREE.CanvasTexture(blobCanvas);
        blobTex.needsUpdate = true;

        const billboardMatA = new THREE.MeshBasicMaterial({
            map: blobTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        const billboardMatB = billboardMatA.clone();
        const billboardGeo = new THREE.PlaneGeometry(2, 2);

        // ---- 赛博朋克色板 ----
        const cyberColors = [0xff00ff, 0x0080ff, 0x39ff14, 0x00ffff, 0xff1493, 0xffaa00, 0xff3366, 0x00ffcc];

        // ---- 霓虹招牌 Canvas 纹理（预生成 8 个） ----
        const neonTexts = ['霓虹城', '酒吧', '光', 'CYBER', '开放', '24H', '龍', 'CLUB'];
        const neonTexs = [];
        for (let i = 0; i < neonTexts.length; i++) {
            const nc = document.createElement('canvas');
            nc.width = 256; nc.height = 64;
            const nctx = nc.getContext('2d');
            // 背景透明
            nctx.clearRect(0, 0, 256, 64);
            // 光晕 (外发光)
            nctx.shadowColor = '#' + cyberColors[i % cyberColors.length].toString(16).padStart(6, '0');
            nctx.shadowBlur = 18;
            nctx.font = 'bold 36px "PingFang SC","Microsoft YaHei",sans-serif';
            nctx.fillStyle = '#' + cyberColors[i % cyberColors.length].toString(16).padStart(6, '0');
            nctx.textAlign = 'center';
            nctx.fillText(neonTexts[i], 128, 44);
            // 再画一层白色加强中心亮度
            nctx.shadowBlur = 4;
            nctx.shadowColor = 'rgba(255,255,255,0.6)';
            nctx.fillStyle = 'rgba(255,255,255,0.85)';
            nctx.fillText(neonTexts[i], 128, 44);
            const tex = new THREE.CanvasTexture(nc);
            tex.needsUpdate = true;
            neonTexs.push(tex);
        }

        // ---- A. GTA V 双层 Billboard：路灯辉光 ----
        const lampPositions = [];
        for (const lamp of window._lampLights) {
            lampPositions.push(lamp.position.clone());
        }
        const lampCount = lampPositions.length;
        let lampBillboardA = null, lampBillboardB = null;

        if (lampCount > 0) {
            const lampGeo = new THREE.PlaneGeometry(3.5, 3.5);
            lampBillboardA = new THREE.InstancedMesh(lampGeo, billboardMatA, lampCount);
            lampBillboardB = new THREE.InstancedMesh(lampGeo, billboardMatB, lampCount);
            lampBillboardA.name = 'lampBillboardA';
            lampBillboardB.name = 'lampBillboardB';

            const dummy = new THREE.Object3D();
            for (let i = 0; i < lampCount; i++) {
                const pos = lampPositions[i];
                dummy.position.copy(pos);
                dummy.position.y += 0.3;
                dummy.scale.setScalar(0.01); // 初始极小（白天不可见）
                dummy.updateMatrix();
                lampBillboardA.setMatrixAt(i, dummy.matrix);
                // B 层微偏移 + 微旋转
                dummy.rotation.z = Math.random() * Math.PI * 2;
                dummy.scale.setScalar(0.01);
                dummy.position.x += 0.3;
                dummy.updateMatrix();
                lampBillboardB.setMatrixAt(i, dummy.matrix);
            }
            lampBillboardA.instanceMatrix.needsUpdate = true;
            lampBillboardB.instanceMatrix.needsUpdate = true;
            lampBillboardA.renderOrder = 999;
            lampBillboardB.renderOrder = 999;
            scene.add(lampBillboardA);
            scene.add(lampBillboardB);
        }

        // ---- B. 霓虹招牌 Billboard：高楼顶部 ----
        const tallBlds = window._bldData.filter(b => b.topY > 25 && b.w > 5);
        // 去重：同一 cx,cz 只取最高的那条记录
        const dedup = new Map();
        for (const b of tallBlds) {
            const key = `${b.cx.toFixed(0)},${b.cz.toFixed(0)}`;
            if (!dedup.has(key) || b.topY > dedup.get(key).topY) dedup.set(key, b);
        }
        const uniqueBlds = [...dedup.values()];
        const neonCount = Math.min(uniqueBlds.length, 40);
        let neonSigns = null;

        if (neonCount > 0) {
            const selected = uniqueBlds.slice(0, neonCount);
            const signGeo = new THREE.PlaneGeometry(6, 1.5);
            neonSigns = new THREE.InstancedMesh(signGeo, new THREE.MeshBasicMaterial({
                map: neonTexs[0], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            }), neonCount);
            neonSigns.name = 'neonSigns';

            const dummy = new THREE.Object3D();
            for (let i = 0; i < neonCount; i++) {
                const b = selected[i];
                const texIdx = i % neonTexs.length;
                const colorIdx = i % cyberColors.length;

                // give each instance its own material via a clone... actually InstancedMesh can do per-instance color
                neonSigns.setColorAt(i, new THREE.Color(cyberColors[colorIdx]));

                dummy.position.set(b.cx, b.topY + 0.5, b.cz);
                // Billboard 始终面向相机 → 用 lookAt world origin hack
                dummy.rotation.set(0, 0, 0);
                dummy.scale.setScalar(0.01);
                dummy.updateMatrix();
                neonSigns.setMatrixAt(i, dummy.matrix);
            }
            neonSigns.instanceMatrix.needsUpdate = true;
            if (neonSigns.instanceColor) neonSigns.instanceColor.needsUpdate = true;
            neonSigns.renderOrder = 998;
            scene.add(neonSigns);
        }

        // P25B优化: 预存霓虹招牌位置，避免运行时 getMatrixAt 回读
        const _neonSignPositions = selected ? selected.map(b => ({
            x: b.cx, y: b.topY + 0.5, z: b.cz
        })) : [];

        window._neonSystem = {
            lampPositions,
            lampBillboardA, lampBillboardB,
            neonSigns,
            _neonSignPositions,
            blobTex,
            neonTexs,
            cyberColors,
        };
        console.log(`[P25B] 霓虹系统: ${lampCount} 路灯辉光 + ${neonCount} 霓虹招牌, DC=${(lampBillboardA?2:0)+(neonSigns?1:0)}`);
    }

    // P25B: 每帧更新 Billboard 朝向相机 + 夜间渐显缩放
    const _nsDummy = new THREE.Object3D(); // 复用，避免每帧 new
    function updateNeonSystem(dt) {
        const ns = window._neonSystem;
        if (!ns) return;
        const night = window._nightSmooth || 0;
        const now = performance.now();

        const cx = camera.position.x;
        const cz = camera.position.z;

        // ---- 路灯双层 Billboard ----
        if (ns.lampBillboardA && ns.lampBillboardB) {
            const positions = ns.lampPositions;
            const count = positions.length;
            for (let i = 0; i < count; i++) {
                const p = positions[i];
                const angle = Math.atan2(cx - p.x, cz - p.z);
                const scale = night * (3.5 + Math.sin(i * 1.3 + now * 0.001) * 0.4);

                // A 层
                _nsDummy.position.set(p.x, p.y + 0.3, p.z);
                _nsDummy.rotation.set(0, angle, 0);
                _nsDummy.scale.setScalar(scale);
                _nsDummy.updateMatrix();
                ns.lampBillboardA.setMatrixAt(i, _nsDummy.matrix);

                // B 层：微偏移 + 微旋转（模拟 GTA V 双层 glare）
                _nsDummy.position.x += 0.15;
                _nsDummy.rotation.set(0, angle, now * 0.0003 + i * 0.7);
                _nsDummy.scale.setScalar(scale * 0.75);
                _nsDummy.updateMatrix();
                ns.lampBillboardB.setMatrixAt(i, _nsDummy.matrix);
            }
            ns.lampBillboardA.instanceMatrix.needsUpdate = true;
            ns.lampBillboardB.instanceMatrix.needsUpdate = true;
        }

        // ---- 霓虹招牌 Billboard ----
        if (ns.neonSigns && ns._neonSignPositions) {
            const positions = ns._neonSignPositions;
            const count = Math.min(ns.neonSigns.count, positions.length);
            for (let i = 0; i < count; i++) {
                const p = positions[i];
                const angle = Math.atan2(cx - p.x, cz - p.z);
                const scale = night * (6.0 + Math.sin(i * 0.9 + now * 0.001) * 1.0);

                _nsDummy.position.set(p.x, p.y, p.z);
                _nsDummy.rotation.set(0, angle, 0);
                _nsDummy.scale.set(scale, scale * 0.25, 1);
                _nsDummy.updateMatrix();
                ns.neonSigns.setMatrixAt(i, _nsDummy.matrix);
            }
            ns.neonSigns.instanceMatrix.needsUpdate = true;
            ns.neonSigns.visible = night > 0.02;
        }

        // 路灯 billboard 夜间可见
        if (ns.lampBillboardA) ns.lampBillboardA.visible = night > 0.02;
        if (ns.lampBillboardB) ns.lampBillboardB.visible = night > 0.02;
    }

