    // ===== P3: 地块划分 (BSP 沿路网切割) =====
    const plots = []; // {cx, cz, w, d} 地块中心与半宽

    function buildPlots() {
        plots.length = 0;
        const CELL = 3;           // 网格精度 3m
        const X0 = -200, Z0 = -200, X1 = 200, Z1 = 200;
        const cols = Math.floor((X1-X0)/CELL), rows = Math.floor((Z1-Z0)/CELL);

        // 1. 标记道路网格
        const roadGrid = new Uint8Array(cols * rows);
        for (const s of roadSegments) {
            const dx=s.x2-s.x1, dz=s.z2-s.z1, len=Math.sqrt(dx*dx+dz*dz);
            if (len<0.5) continue;
            const hw = s.w*0.5 + 2; // 道路半宽 + 2m 路缘
            const nx=-dz/len, nz=dx/len;
            // 对路段沿途采样
            const steps=Math.ceil(len/CELL);
            for (let i=0;i<=steps;i++) {
                const t=i/steps;
                const cx=s.x1+dx*t, cz=s.z1+dz*t;
                // 在路宽范围内标记
                for (let w=-hw; w<=hw; w+=CELL) {
                    const wx=cx+nx*w, wz=cz+nz*w;
                    const ci=Math.floor((wx-X0)/CELL), ri=Math.floor((wz-Z0)/CELL);
                    if (ci>=0&&ci<cols&&ri>=0&&ri<rows) roadGrid[ri*cols+ci]=1;
                }
            }
        }

        // 2. BFS 找非道路连通区域
        const visited = new Uint8Array(cols*rows);
        const regions = [];

        for (let ri=0; ri<rows; ri++) {
            for (let ci=0; ci<cols; ci++) {
                const idx=ri*cols+ci;
                if (roadGrid[idx]||visited[idx]) continue;
                // BFS 收集该区域所有格子
                const queue=[[ci,ri]];
                visited[idx]=1;
                const cells=[];
                let minC=ci, maxC=ci, minR=ri, maxR=ri;
                while (queue.length) {
                    const [c,r]=queue.pop();
                    cells.push([c,r]);
                    if (c<minC) minC=c; if (c>maxC) maxC=c;
                    if (r<minR) minR=r; if (r>maxR) maxR=r;
                    for (const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                        const nc=c+dc, nr=r+dr;
                        if (nc<0||nc>=cols||nr<0||nr>=rows) continue;
                        const ni=nr*cols+nc;
                        if (!roadGrid[ni]&&!visited[ni]) { visited[ni]=1; queue.push([nc,nr]); }
                    }
                }
                // 最小面积过滤（至少能放一栋小建筑）
                if (cells.length < 6) continue;
                const wx0=X0+minC*CELL, wz0=Z0+minR*CELL;
                const wx1=X0+(maxC+1)*CELL, wz1=Z0+(maxR+1)*CELL;
                regions.push({cells, minC,maxC,minR,maxR, wx0,wz0,wx1,wz1, w:(maxC-minC+1)*CELL, d:(maxR-minR+1)*CELL});
            }
        }

        // 3. 对每个区域做 BSP 递归分割
        function bspSplit(rx0, rz0, rw, rd, depth, roadCheck) {
            const minPlot = 8, maxPlot = 35;
            if (rw<minPlot*2 && rd<minPlot*2) {
                // 叶片：记录地块
                if (rw>=minPlot && rd>=minPlot) {
                    const cx=rx0+rw/2, cz=rz0+rd/2;
                    // 检查中心不在道路上
                    const ci=Math.floor((cx-X0)/CELL), ri=Math.floor((cz-Z0)/CELL);
                    if (ci>=0&&ci<cols&&ri>=0&&ri<rows && !roadGrid[ri*cols+ci]) {
                        // 裁剪到 maxPlot
                        const pw=Math.min(rw, maxPlot), pd=Math.min(rd, maxPlot);
                        plots.push({cx:cx, cz:cz, w:pw/2, d:pd/2});
                    }
                }
                return;
            }
            if (depth>7) {
                const cx=rx0+rw/2, cz=rz0+rd/2;
                const ci=Math.floor((cx-X0)/CELL), ri=Math.floor((cz-Z0)/CELL);
                if (ci>=0&&ci<cols&&ri>=0&&ri<rows && !roadGrid[ri*cols+ci]) {
                    const pw=Math.min(rw,maxPlot), pd=Math.min(rd,maxPlot);
                    plots.push({cx:cx, cz:cz, w:pw/2, d:pd/2});
                }
                return;
            }
            // 沿长轴分割
            const splitH = (rw > rd);
            if (splitH) {
                const ratio=rng.range(0.45, 0.55);
                const s=rw*ratio;
                bspSplit(rx0, rz0, s, rd, depth+1, roadCheck);
                bspSplit(rx0+s, rz0, rw-s, rd, depth+1, roadCheck);
            } else {
                const ratio=rng.range(0.45, 0.55);
                const s=rd*ratio;
                bspSplit(rx0, rz0, rw, s, depth+1, roadCheck);
                bspSplit(rx0, rz0+s, rw, rd-s, depth+1, roadCheck);
            }
        }

        for (const reg of regions) {
            bspSplit(reg.wx0, reg.wz0, reg.w, reg.d, 0, null);
        }

        // 4. 后处理：地块间最小间距去重
        const filtered=[];
        for (let i=0;i<plots.length;i++) {
            const p=plots[i];
            let tooClose=false;
            for (let j=0;j<filtered.length;j++) {
                const q=filtered[j];
                const dx=p.cx-q.cx, dz=p.cz-q.cz;
                if (Math.abs(dx)<(p.w+q.w+1) && Math.abs(dz)<(p.d+q.d+1)) {
                    tooClose=true; break;
                }
            }
            if (!tooClose) filtered.push(p);
        }
        plots.length=0;
        plots.push(...filtered);

        return plots.length;
    }

    // 渲染地块轮廓
    function renderPlots() {
        const plotGroup = new THREE.Group();
        plotGroup.name = 'plots';
        plotGroup.renderOrder = 1;

        const palette = [0x44aaff, 0xff8844, 0x44ff88, 0xff44aa, 0xaaff44, 0x8844ff, 0xffaa44, 0x44ffaa];
        const lineMat = new THREE.LineBasicMaterial({color:0xffffff, transparent:true, opacity:0.6, depthTest:true});

        plots.forEach((p, i) => {
            const h = (getTerrainH(p.cx-p.w, p.cz-p.d)+getTerrainH(p.cx+p.w, p.cz+p.d))/2 + 0.15;

            // 半透明填充面
            const fillGeo = new THREE.PlaneGeometry(p.w*2, p.d*2);
            fillGeo.rotateX(-Math.PI/2);
            const fillMat = new THREE.MeshBasicMaterial({
                color: palette[i%palette.length], transparent:true, opacity:0.18,
                side: THREE.DoubleSide, depthTest:true
            });
            const fillMesh = new THREE.Mesh(fillGeo, fillMat);
            fillMesh.position.set(p.cx, h, p.cz);
            fillMesh.renderOrder = 1;
            plotGroup.add(fillMesh);

            // 白色轮廓
            const pts = [
                new THREE.Vector3(p.cx-p.w, h+0.02, p.cz-p.d),
                new THREE.Vector3(p.cx+p.w, h+0.02, p.cz-p.d),
                new THREE.Vector3(p.cx+p.w, h+0.02, p.cz+p.d),
                new THREE.Vector3(p.cx-p.w, h+0.02, p.cz+p.d),
                new THREE.Vector3(p.cx-p.w, h+0.02, p.cz-p.d),
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
            plotGroup.add(new THREE.Line(lineGeo, lineMat));
        });

        scene.add(plotGroup);
        window._plotGroup = plotGroup;
    }

