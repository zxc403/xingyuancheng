    // ===== P13: 季节系统 =====
    const SEASON = {
        names: ['Spring','Summer','Autumn','Winter'],
        name: 'Spring',
        seasonality: 0.0,      // 0=mid-spring, 0.25=mid-summer, 0.5=mid-autumn, 0.75=mid-winter
        cycleDays: 300.0,      // 完整一年 = 300 秒（~5分钟）
        transitionSpeed: 0.8,  // 颜色/效果 lerp 速度
        lerpedSeasonality: 0.0,
        profiles: {
            Spring: { groundTint:0x5a6e3a, skySaturation:0.85, fogHue:0x8a9e7a, leafColor:0x7eb546, tempBias:0.0, snowAmount:0, leafAmount:0.1 },
            Summer: { groundTint:0x4a6e2a, skySaturation:1.00, fogHue:0x9ab888, leafColor:0x3d6b20, tempBias:+0.15, snowAmount:0, leafAmount:0 },
            Autumn: { groundTint:0x6e5a2a, skySaturation:0.65, fogHue:0xb89a6a, leafColor:0xd4902a, tempBias:-0.05, snowAmount:0, leafAmount:0.4 },
            Winter:  { groundTint:0x7a8a9a, skySaturation:0.40, fogHue:0x8899aa, leafColor:0x6a6a6a, tempBias:-0.30, snowAmount:0.6, leafAmount:0 }
        },
        lerped: { groundTint:0x5a6e3a, skySaturation:0.85, fogHue:0x8a9e7a, leafColor:0x7eb546, tempBias:0.0, snowAmount:0, leafAmount:0.1 }
    };

    function updateSeasons(dt) {
        // seasonality 正弦波形
        SEASON.seasonality = (DAYNIGHT.elapsed % SEASON.cycleDays) / SEASON.cycleDays;
        SEASON.lerpedSeasonality += (SEASON.seasonality - SEASON.lerpedSeasonality) * Math.min(1, dt * SEASON.transitionSpeed);

        // 确定当前季名
        const s = SEASON.seasonality;
        let idx = Math.floor(s * 4) % 4;
        SEASON.name = SEASON.names[idx];

        // lerp 季节效果
        const keys = ['groundTint','skySaturation','fogHue','leafColor','tempBias','snowAmount','leafAmount'];
        // 用正弦插值平滑跨季节过渡
        const phase = s * 4; // 0-4 映射到四季段
        const seg = phase % 1;
        const smooth = seg < 0.5 ? 2*seg*seg : 1 - Math.pow(-2*seg + 2, 2)/2; // ease-in-out

        const from = SEASON.profiles[SEASON.names[Math.floor(phase) % 4]];
        const to = SEASON.profiles[SEASON.names[(Math.floor(phase) + 1) % 4]];
        for (const k of keys) {
            SEASON.lerped[k] = from[k] + (to[k] - from[k]) * smooth;
        }
    }

