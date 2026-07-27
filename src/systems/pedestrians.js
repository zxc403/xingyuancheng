    // ===== P10: 行人系统 =====
    const pedestrianStates = [];    // {segIdx, t, speed, state, idleTimer, colorIdx, phase}
    let pedestrianMesh = null;
    const PED_COUNT = 200;
    const PED_SPEED = 1.2;          // m/s
    const PED_IDLE_MIN = 2.0;       // 最短站立时间
    const PED_IDLE_MAX = 8.0;       // 最长站立时间

    // 从 roadSegments 提取 sidewalk 路径
    // 每条道路段两侧各一条 sidewalk，偏移 w/2 + 2m
    function buildPedestrianNetwork() {
        const paths = []; // [{x1,z1,x2,z2, nx,nz, sideOffset}]
        const junctionMap = new Map(); // 端点 key -> [pathIdx, t]

        for (const s of roadSegments) {
            const dx = s.x2 - s.x1, dz = s.z2 - s.z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            if (len < 6) continue;
            const nx = -dz / len, nz = dx / len;
            const offset = s.w * 0.5 + 2.0; // sidewalk 距路中线

            for (const side of [-1, 1]) {
                const so = offset * side;
                const p = {
                    x1: s.x1 + nx * so,
                    z1: s.z1 + nz * so,
                    x2: s.x2 + nx * so,
                    z2: s.z2 + nz * so,
                    len: len,
                    roadW: s.w
                };
                const idx = paths.length;
                paths.push(p);

                // 记录端点，用于路口连接
                const key1 = `${p.x1.toFixed(1)},${p.z1.toFixed(1)}`;
                const key2 = `${p.x2.toFixed(1)},${p.z2.toFixed(1)}`;
                if (!junctionMap.has(key1)) junctionMap.set(key1, []);
                if (!junctionMap.has(key2)) junctionMap.set(key2, []);
                junctionMap.get(key1).push({ pathIdx: idx, t: 0 });
                junctionMap.get(key2).push({ pathIdx: idx, t: 1 });
            }
        }

        return { paths, junctionMap };
    }

    let pedPaths = [];
    let pedJunctionMap = new Map();

    function spawnPedestrians() {
        const { paths, junctionMap } = buildPedestrianNetwork();
        pedPaths = paths;
        pedJunctionMap = junctionMap;

        if (paths.length === 0) {
            console.warn('[P10] 无 sidewalk 路径，跳过行人');
            return;
        }

        // 构建人体几何体: 身体(圆柱) + 头部(球)
        const bodyGeo = new THREE.CylinderGeometry(0.15, 0.18, 1.0, 8, 4);
        bodyGeo.translate(0, 0.5, 0);
        const headGeo = new THREE.SphereGeometry(0.14, 8, 6);
        headGeo.translate(0, 1.08, 0);
        const mergedGeo = new THREE.BufferGeometry();
        const bodyPos = bodyGeo.attributes.position;
        const headPos = headGeo.attributes.position;
        const totalVerts = bodyPos.count + headPos.count;
        const posArr = new Float32Array(totalVerts * 3);
        const normArr = new Float32Array(totalVerts * 3);

        for (let i = 0; i < bodyPos.count; i++) {
            posArr[i * 3] = bodyPos.getX(i);
            posArr[i * 3 + 1] = bodyPos.getY(i);
            posArr[i * 3 + 2] = bodyPos.getZ(i);
        }
        for (let i = 0; i < headPos.count; i++) {
            const j = bodyPos.count + i;
            posArr[j * 3] = headPos.getX(i);
            posArr[j * 3 + 1] = headPos.getY(i);
            posArr[j * 3 + 2] = headPos.getZ(i);
        }
        mergedGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
        mergedGeo.computeVertexNormals();

        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        pedestrianMesh = new THREE.InstancedMesh(mergedGeo, mat, PED_COUNT);
        pedestrianMesh.castShadow = true;
        pedestrianMesh.receiveShadow = true;
        pedestrianMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const dummy = new THREE.Object3D();
        const colors = [
            0xcc4444, 0x44cc44, 0x4444cc, 0xcccc44,
            0xcc44cc, 0x44cccc, 0x888888, 0xcc8844,
            0x88cc44, 0x4488cc, 0xaa6644, 0x6644aa,
            0x334455, 0x553322, 0x225533, 0x884444,
        ];

        for (let i = 0; i < PED_COUNT; i++) {
            // 随机选一条 sidewalk，随机位置
            const pathIdx = rng.int(0, paths.length - 1);
            const p = paths[pathIdx];
            const t = rng.float();
            const x = p.x1 + (p.x2 - p.x1) * t;
            const z = p.z1 + (p.z2 - p.z1) * t;
            const h = getTerrainH(x, z);

            dummy.position.set(x, h, z);
            dummy.rotation.y = Math.atan2(p.x2 - p.x1, p.z2 - p.z1) + (rng.float() > 0.5 ? 0 : Math.PI);
            dummy.updateMatrix();
            pedestrianMesh.setMatrixAt(i, dummy.matrix);

            const color = colors[rng.int(0, colors.length - 1)];
            pedestrianMesh.setColorAt(i, new THREE.Color(color));

            // 初始状态: 50% idle, 50% walking
            const initialIdle = rng.float() < 0.5;
            pedestrianStates.push({
                pathIdx,
                t,
                speed: PED_SPEED * rng.range(0.7, 1.3),
                state: initialIdle ? 'idle' : 'walk',
                idleTimer: initialIdle ? rng.float() * PED_IDLE_MAX : 0,
                colorIdx: rng.int(0, colors.length - 1),
                phase: rng.float() * Math.PI * 2, // 用于 bob 动画
                forward: true, // true: 从 x1->x2, false: 从 x2->x1
            });
        }

        pedestrianMesh.instanceColor.needsUpdate = true;
        scene.add(pedestrianMesh);
        window._pedestrianMesh = pedestrianMesh;

        console.log(`[P10] 行人系统: ${PED_COUNT} 人, ${paths.length} 条 sidewalk`);
    }

    function findNextSegment(pathIdx, t, forward) {
        // 当前到达端点，在 junctionMap 中查找相邻 sidewalk
        const p = pedPaths[pathIdx];
        const keyX = forward ? p.x2 : p.x1;
        const keyZ = forward ? p.z2 : p.z1;
        const key = `${keyX.toFixed(1)},${keyZ.toFixed(1)}`;
        const candidates = pedJunctionMap.get(key);
        if (!candidates || candidates.length <= 1) {
            // 无分叉或只有自己：掉头或返回
            if (Math.random() < 0.4) return { pathIdx, t: forward ? 1.0 : 0.0, forward: !forward };
            // 随机选一条（如果有其他路径）
            const others = candidates ? candidates.filter(c => c.pathIdx !== pathIdx) : [];
            if (others.length > 0) {
                const pick = others[Math.floor(Math.random() * others.length)];
                return { pathIdx: pick.pathIdx, t: pick.t, forward: pick.t === 0 };
            }
            return { pathIdx, t: forward ? 1.0 : 0.0, forward: !forward };
        }

        const others = candidates.filter(c => c.pathIdx !== pathIdx);
        if (others.length === 0) {
            return { pathIdx, t: forward ? 1.0 : 0.0, forward: !forward };
        }
        const pick = others[Math.floor(Math.random() * others.length)];
        return { pathIdx: pick.pathIdx, t: pick.t, forward: pick.t === 0 };
    }

    function updatePedestrians(dt) {
        if (!pedestrianMesh || pedPaths.length === 0) return;

        const dummy = new THREE.Object3D();

        for (let i = 0; i < PED_COUNT; i++) {
            const st = pedestrianStates[i];
            const p = pedPaths[st.pathIdx];
            if (!p) continue;

            if (st.state === 'idle') {
                st.idleTimer -= dt;
                if (st.idleTimer <= 0) {
                    // 转到 walk，决定方向
                    if (st.t <= 0.01) st.forward = true;
                    else if (st.t >= 0.99) st.forward = false;
                    st.state = 'walk';
                }
                st.phase += dt * 1.5; // idle 时轻微呼吸
            }

            if (st.state === 'walk') {
                // 沿 sidewalk 移动
                const dp = st.speed * dt / p.len;
                if (st.forward) {
                    st.t += dp;
                    if (st.t >= 1.0) {
                        st.t = 1.0;
                        // 到达端点，选择下一段
                        const next = findNextSegment(st.pathIdx, st.t, st.forward);
                        st.pathIdx = next.pathIdx;
                        st.t = next.t;
                        st.forward = next.forward;
                        // 偶尔 idle
                        if (Math.random() < 0.3) {
                            st.state = 'idle';
                            st.idleTimer = PED_IDLE_MIN + Math.random() * (PED_IDLE_MAX - PED_IDLE_MIN);
                        }
                    }
                } else {
                    st.t -= dp;
                    if (st.t <= 0.0) {
                        st.t = 0.0;
                        const next = findNextSegment(st.pathIdx, st.t, st.forward);
                        st.pathIdx = next.pathIdx;
                        st.t = next.t;
                        st.forward = next.forward;
                        if (Math.random() < 0.3) {
                            st.state = 'idle';
                            st.idleTimer = PED_IDLE_MIN + Math.random() * (PED_IDLE_MAX - PED_IDLE_MIN);
                        }
                    }
                }
                st.phase += st.speed * dt * 8;
            }

            // 计算世界位置
            const cp = pedPaths[st.pathIdx];
            if (!cp) continue;
            const px = cp.x1 + (cp.x2 - cp.x1) * st.t;
            const pz = cp.z1 + (cp.z2 - cp.z1) * st.t;
            const ph = getTerrainH(px, pz);

            // 朝向：行走时面朝前进方向，idle时保持
            const dx = cp.x2 - cp.x1, dz = cp.z2 - cp.z1;
            const angle = Math.atan2(st.forward ? dx : -dx, st.forward ? dz : -dz);

            // 行走时 bob 动画
            const bob = (st.state === 'walk') ? Math.sin(st.phase) * 0.04 : Math.sin(st.phase * 0.5) * 0.01;

            dummy.position.set(px, ph + bob, pz);
            dummy.rotation.set(0, angle, 0);
            dummy.updateMatrix();
            pedestrianMesh.setMatrixAt(i, dummy.matrix);
        }

        pedestrianMesh.instanceMatrix.needsUpdate = true;
    }

    // 雾层设置
