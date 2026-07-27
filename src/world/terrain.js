    function getTerrainH(x, z) {
        const freq = [0.004, 0.012, 0.028, 0.064, 0.15];
        const amp  = [15, 7, 3, 1.2, 0.4];
        let h = 0;
        for (let i = 0; i < freq.length; i++) {
            h += Simplex.noise3D(x * freq[i], z * freq[i], 0.5) * amp[i];
        }
        // 大范围盆地：中间凹陷 -8m（城市选址在低洼处）
        const cx = 0, cz = 0, basinR = 180;
        const dist = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
        if (dist < basinR) {
            h -= (1 - dist / basinR) * (1 - dist / basinR) * 12;
        }
        // 右上方台地：适合上城 CBD
        if (x > 30 && z > 40 && x < 140 && z < 150) h += 5;
        // 左下方低洼：下城工业区
        if (x < -40 && z < -30 && x > -160 && z > -140) h -= 4;
        return h;
    }

