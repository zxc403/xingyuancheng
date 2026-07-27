    // ===== P2: 路网生成 (Parish & Müller 风格) =====
    // 全局道路段存储：{x1,z1,x2,z2,w} 每条为一段
    const roadSegments = [];

    // 四区关键节点（城市骨架点）
    const NODES = [
        {id:'A_center', x:90, z:100, label:'上城CBD'},
        {id:'A_east',   x:140, z:90},
        {id:'A_north',  x:80, z:150},
        {id:'B_center', x:0, z:50, label:'中城商住'},
        {id:'B_west',   x:-60, z:40},
        {id:'B_south',  x:10, z:-20},
        {id:'C_center', x:-100, z:-90, label:'下城工业'},
        {id:'C_north',  x:-80, z:-40},
        {id:'D_center', x:-30, z:-120, label:'河岸'},
        {id:'D_ridge',  x:50, z:-130, label:'山脊线'},
        {id:'center_hub', x:20, z:20, label:'中央枢纽'},
    ];

    // 主干道规划（节点对连接）
    const ARTERIAL_PAIRS = [
        ['A_center','center_hub'], ['B_center','center_hub'],
        ['C_center','B_west'], ['C_center','D_center'],
        ['A_center','A_east'], ['A_center','A_north'],
        ['B_center','B_south'], ['B_center','B_west'],
        ['C_center','C_north'], ['D_center','D_ridge'],
        ['center_hub','B_south'], ['B_south','D_ridge'],
    ];

    function dist2D(x1,z1,x2,z2) { return Math.sqrt((x1-x2)**2+(z1-z2)**2); }

    // 生成带微弯的道路折线（CDPR 规则：每 200m 至少偏转 5°）
    function genRoadPath(x1, z1, x2, z2, displace=0.15) {
        const points = [{x:x1, z:z1}];
        const totalDist = dist2D(x1,z1,x2,z2);
        const steps = Math.max(2, Math.floor(totalDist / 40));
        for (let i=1; i<steps; i++) {
            const t = i/steps;
            const bx = x1 + (x2-x1)*t, bz = z1 + (z2-z1)*t;
            // 每点偏转距离的 displace 倍，方向垂直于道路
            const dx = -(z2-z1)/totalDist, dz = (x2-x1)/totalDist;
            const offset = (Math.sin(i*1.7+0.5)*0.7 + Math.sin(i*4.1)*0.3) * totalDist * displace;
            points.push({x: bx + dx*offset, z: bz + dz*offset});
        }
        points.push({x:x2, z:z2});
        return points;
    }

    // 从折线生成路段数组
    function pointsToSegments(points, width) {
        const segs = [];
        for (let i=0; i<points.length-1; i++) {
            segs.push({x1:points[i].x, z1:points[i].z, x2:points[i+1].x, z2:points[i+1].z, w:width});
        }
        return segs;
    }

    // 判断点是否在任意道路附近（用于支路避免重叠）
    function nearRoad(x, z, minDist=12) {
        for (const s of roadSegments) {
            const dx = s.x2-s.x1, dz = s.z2-s.z1;
            const len2 = dx*dx+dz*dz;
            if (len2<0.01) continue;
            let t = ((x-s.x1)*dx + (z-s.z1)*dz)/len2;
            t = Math.max(0, Math.min(1, t));
            const cx = s.x1+t*dx, cz = s.z1+t*dz;
            if (dist2D(x,z,cx,cz) < minDist + s.w*0.5) return true;
        }
        return false;
    }

    function buildRoadNetwork() {
        roadSegments.length = 0;

        // 1. 主干道（8m 宽）
        for (const [a,b] of ARTERIAL_PAIRS) {
            const na = NODES.find(n=>n.id===a), nb = NODES.find(n=>n.id===b);
            if (!na || !nb) continue;
            const path = genRoadPath(na.x, na.z, nb.x, nb.z, 0.18);
            const segs = pointsToSegments(path, 8);
            roadSegments.push(...segs);
        }

        // 2. 支路（5m 宽）：在主干道围合区域内填充
        // 用网格采样，在远离主干道且地形平坦处生成支路
        const branchSegs = [];
        const gridStep = 55;
        for (let x=-180; x<=180; x+=gridStep) {
            for (let z=-180; z<=180; z+=gridStep) {
                if (nearRoad(x, z, 8)) continue; // 远离主干道
                // 只在盆地核心区域生成支路
                const distC = dist2D(x,z,0,0);
                if (distC > 200) continue;
                // 检查地形坡度
                const hCenter = getTerrainH(x,z);
                const hRight  = getTerrainH(x+gridStep,z);
                const hDown   = getTerrainH(x,z+gridStep);
                if (Math.abs(hRight-hCenter)>6 || Math.abs(hDown-hCenter)>6) continue;
                // 横/竖支路
                for (const dir of [[gridStep,0],[0,gridStep]]) {
                    const ex=x+dir[0], ez=z+dir[1];
                    if (nearRoad(ex, ez, 8)) continue;
                    const he = getTerrainH(ex,ez);
                    if (Math.abs(he-hCenter)>4) continue;
                    branchSegs.push({x1:x, z1:z, x2:ex, z2:ez, w:5});
                }
            }
        }
        roadSegments.push(...branchSegs);

        return roadSegments.length;
    }

    // 渲染道路到场景
    function renderRoads() {
        const roadTex = window._realTex && window._realTex['asphalt'];
        let roadMat;
        if (roadTex && roadTex.map) {
            roadMat = new THREE.MeshStandardMaterial({
                map: roadTex.map, roughnessMap: roadTex.roughnessMap,
                normalMap: roadTex.normalMap, aoMap: roadTex.aoMap,
                normalScale: new THREE.Vector2(0.8,0.8),
                roughness: 0.85, metalness: 0.05, envMapIntensity: 0.8
            });
        } else {
            roadMat = new THREE.MeshStandardMaterial({color:0x383838, roughness:0.85, metalness:0.05});
        }

        const roadGroup = new THREE.Group();
        roadGroup.name = 'roadNetwork';

        // 发光道路中线（线框调试）
        const lineMat = new THREE.LineBasicMaterial({color:0xffaa00, transparent:true, opacity:0.35, depthTest:true});
        const lineGroup = new THREE.Group();
        lineGroup.name = 'roadLines';
        lineGroup.renderOrder = 2;

        for (const s of roadSegments) {
            const dx = s.x2-s.x1, dz = s.z2-s.z1;
            const len = Math.sqrt(dx*dx+dz*dz);
            if (len<0.5) continue;
            const angle = Math.atan2(dx, dz);

            // 路面
            const geo = new THREE.PlaneGeometry(s.w, len);
            geo.rotateX(-Math.PI/2);
            const m = new THREE.Mesh(geo, roadMat);
            const cx = (s.x1+s.x2)/2, cz = (s.z1+s.z2)/2;
            const hAvg = (getTerrainH(s.x1,s.z1)+getTerrainH(s.x2,s.z2))/2 + 0.08;
            m.position.set(cx, hAvg, cz);
            m.rotation.y = angle;
            m.receiveShadow = true;
            roadGroup.add(m);

            // 中线
            const pts = [
                new THREE.Vector3(s.x1, getTerrainH(s.x1,s.z1)+0.1, s.z1),
                new THREE.Vector3(s.x2, getTerrainH(s.x2,s.z2)+0.1, s.z2)
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
            lineGroup.add(new THREE.Line(lineGeo, lineMat));
        }

        scene.add(roadGroup);
        scene.add(lineGroup);
        window._roadGroup = roadGroup;
        window._roadLines = lineGroup;
    }

