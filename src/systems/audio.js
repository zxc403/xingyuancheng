    // ===== P14: 3D音频系统（程序化合成，零外部文件） =====
    const CITY_AUDIO = {
        ctx: null, masterGain: null, compressor: null,
        // 各音源节点引用
        wind: { source: null, filter: null, gain: null },
        rain: { source: null, filter: null, gain: null, lfo: null, lfoGain: null },
        thunder: { buffers: null, lastTrigger: 0 },
        traffic: { source: null, filter: null, gain: null },
        birds: { osc: null, gain: null, timer: 0, nextChirp: 0 },
        // 状态
        enabled: false, initialized: false,
        thunderCooldown: 3.0, trafficGainTarget: 0.15,
        prevRainIntensity: 0, prevWindForce: 0,
        prevSeason: '', prevWeather: '', prevDayness: 1
    };

    // 共享白噪声缓冲区（4 秒，避免可闻循环感）
    function _createNoiseBuffer(ctx, duration = 4) {
        const sr = ctx.sampleRate;
        const buf = ctx.createBuffer(1, sr * duration, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        return buf;
    }

    // 棕噪声（低通积分，模拟远处城市底噪/车流）
    function _createBrownNoiseBuffer(ctx, duration = 6) {
        const sr = ctx.sampleRate;
        const len = sr * duration;
        const buf = ctx.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < len; i++) {
            brown = (brown + 0.005 * (Math.random() * 2 - 1)) / 1.005;
            data[i] = brown * 6; // 放大到可听范围
        }
        return buf;
    }

    // 创建循环噪声源 → filter → gain 链
    function _createFilteredNoise(ctx, buf, filterType, freq, Q, gainVal) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = freq;
        filter.Q.value = Q;
        const gain = ctx.createGain();
        gain.gain.value = gainVal;
        src.connect(filter);
        filter.connect(gain);
        return { source: src, filter, gain };
    }

    // 雷声缓冲区合成（5段：snap + crack + sub-bass + rumble + reverb tail）
    function _buildThunderBuffers(ctx) {
        const sr = ctx.sampleRate;
        // snap: 极短高频冲击（20ms）
        const snapLen = Math.ceil(sr * 0.02);
        const snapBuf = ctx.createBuffer(1, snapLen, sr);
        const snapD = snapBuf.getChannelData(0);
        for (let i = 0; i < snapLen; i++) {
            const t = i / sr;
            snapD[i] = (Math.random() * 2 - 1) * Math.exp(-t * 200) * 3.0;
        }
        // crack: 短电弧裂声（80ms，高频+稀疏脉冲）
        const crackLen = Math.ceil(sr * 0.08);
        const crackBuf = ctx.createBuffer(1, crackLen, sr);
        const crackD = crackBuf.getChannelData(0);
        let hp = 0, prev = 0;
        for (let i = 0; i < crackLen; i++) {
            const t = i / sr;
            const w = Math.random() * 2 - 1;
            hp = 0.985 * (hp + w - prev);
            prev = w;
            const spike = Math.random() < 0.03 ? (Math.random() * 2 - 1) * 2.5 : 0;
            crackD[i] = (hp * Math.exp(-t * 25) * 2.0 + spike * Math.exp(-t * 50)) * Math.tanh((i / crackLen) * 3);
        }
        // sub-bass: 正弦扫频 80→25Hz（2.5秒）
        const bassLen = Math.ceil(sr * 2.5);
        const bassBuf = ctx.createBuffer(1, bassLen, sr);
        const bassD = bassBuf.getChannelData(0);
        let phase = 0;
        for (let i = 0; i < bassLen; i++) {
            const t = i / sr;
            const freq = 80 * Math.exp(-t * 0.7) + 25;
            phase += (2 * Math.PI * freq) / sr;
            bassD[i] = Math.sin(phase) * Math.exp(-t * 1.2) * 1.8;
        }
        // rumble: 棕噪声长尾（5秒，带振幅调制模拟地形回声）
        const rumbleLen = Math.ceil(sr * 5.0);
        const rumbleBuf = ctx.createBuffer(2, rumbleLen, sr);
        for (let ch = 0; ch < 2; ch++) {
            const d = rumbleBuf.getChannelData(ch);
            let brown = 0;
            for (let i = 0; i < rumbleLen; i++) {
                const t = i / sr;
                brown = (brown + 0.008 * (Math.random() * 2 - 1)) / 1.008;
                const mod = (0.6 + 0.4 * Math.sin(t * 2.1 + ch)) * (0.7 + 0.3 * Math.sin(t * 0.5 + ch * 2));
                d[i] = brown * 40 * Math.pow(1 - t / 5.0, 1.8) * mod;
            }
        }
        return { snapBuf, crackBuf, bassBuf, rumbleBuf };
    }

    // P0修复：AudioContext 解锁 — 浏览器 autoplay policy 标准模式
    // 参考 Matt Montag (mattmontag.com) 和 Chrome autoplay 官方文档
    function _unlockAudioContext(ctx) {
        if (!ctx || ctx.state !== 'suspended') return;
        const events = ['touchstart', 'touchend', 'mousedown', 'keydown'];
        const body = document.body;
        function resume() {
            if (ctx.state === 'suspended') {
                ctx.resume().then(() => {
                    console.log('[P14] AudioContext 已解锁 (state=' + ctx.state + ')');
                }).catch(() => {});
            }
        }
        function clean() {
            events.forEach(e => body.removeEventListener(e, resume, false));
            events.forEach(e => body.removeEventListener(e, clean, false));
        }
        events.forEach(e => body.addEventListener(e, resume, false));
        events.forEach(e => body.addEventListener(e, clean, false));
    }

    function initCityAudio() {
        if (CITY_AUDIO.initialized) return;
        const listener = window._audioListener;
        if (!listener || !listener.context) return;
        const ctx = listener.context;
        CITY_AUDIO.ctx = ctx;

        // P0修复：AudioContext 解锁（Chrome/Safari autoplay policy要求用户手势后resume）
        // 参考 Matt Montag 博客 (mattmontag.com) 与 greywen/web-weather 实践
        _unlockAudioContext(ctx);

        // 总线：Compressor → MasterGain → Destination
        CITY_AUDIO.compressor = ctx.createDynamicsCompressor();
        CITY_AUDIO.compressor.threshold.value = -22;
        CITY_AUDIO.compressor.knee.value = 10;
        CITY_AUDIO.compressor.ratio.value = 8;
        CITY_AUDIO.compressor.attack.value = 0.003;
        CITY_AUDIO.compressor.release.value = 0.15;
        CITY_AUDIO.compressor.connect(ctx.destination);

        CITY_AUDIO.masterGain = ctx.createGain();
        CITY_AUDIO.masterGain.gain.value = 0.55;
        CITY_AUDIO.masterGain.connect(CITY_AUDIO.compressor);

        const mg = CITY_AUDIO.masterGain;

        // ---- 风声：白噪声 → lowpass(200-800Hz) → 缓慢 LFO 调制 → gain ----
        const windBuf = _createNoiseBuffer(ctx, 5);
        const wind = _createFilteredNoise(ctx, windBuf, 'lowpass', 350, 0.5, 0);
        wind.gain.connect(mg);
        wind.source.start();
        CITY_AUDIO.wind = wind;

        // ---- 雨声：白噪声 → bandpass(3000-7000Hz) → LFO 滴答感 → gain ----
        const rainBuf = _createNoiseBuffer(ctx, 4);
        const rain = _createFilteredNoise(ctx, rainBuf, 'bandpass', 5000, 0.4, 0);
        // LFO 调制 filter 频率产生雨滴不均匀感
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 1.5;
        lfoGain.gain.value = 1500;
        lfo.connect(lfoGain).connect(rain.filter.frequency);
        lfo.start();
        rain.gain.connect(mg);
        rain.source.start();
        CITY_AUDIO.rain = { ...rain, lfo, lfoGain };

        // ---- 城市交通底噪：棕噪声 → lowpass(250Hz) → gain ----
        const trafficBuf = _createBrownNoiseBuffer(ctx, 6);
        const traffic = _createFilteredNoise(ctx, trafficBuf, 'lowpass', 250, 0.3, 0);
        traffic.gain.connect(mg);
        traffic.source.start();
        CITY_AUDIO.traffic = traffic;

        // ---- 鸟鸣：OscillatorNode 频率扫描 + 随机间隔 ----
        const birdGain = ctx.createGain();
        birdGain.gain.value = 0;
        birdGain.connect(mg);
        CITY_AUDIO.birds = { osc: null, gain: birdGain, timer: 0, nextChirp: 5 + Math.random() * 10 };

        // ---- 雷声：预合成缓冲区 ----
        CITY_AUDIO.thunder.buffers = _buildThunderBuffers(ctx);
        CITY_AUDIO.thunder.lastTrigger = -10;

        CITY_AUDIO.initialized = true;
        CITY_AUDIO.enabled = true;
        console.log('[P14] 3D音频系统已就绪（程序化合成，零音频文件）');
    }

    // 播放雷声（从缓冲区合成，经 distortion + echo 网络）
    // P1修复：添加 cooldown 检查，由 triggerLightning() 统一调用，实现音画同步
    function _playThunder() {
        if (!CITY_AUDIO.enabled || !CITY_AUDIO.ctx) return;
        const ctx = CITY_AUDIO.ctx;
        const now = ctx.currentTime;
        // cooldown 防止短时间内重复触发
        if (now - CITY_AUDIO.thunder.lastTrigger < CITY_AUDIO.thunderCooldown) return;
        CITY_AUDIO.thunder.lastTrigger = now;
        const bufs = CITY_AUDIO.thunder.buffers;
        if (!bufs) return;
        const mg = CITY_AUDIO.masterGain;
        if (!mg) return;

        // 在 masterGain 前插入 thunder 子总线（distortion → echo → mg）
        const tGain = ctx.createGain();
        tGain.gain.value = 0.9;
        tGain.connect(mg);

        // echo 反馈网络
        const echoDelay = ctx.createDelay(2.0);
        echoDelay.delayTime.value = 0.16 + Math.random() * 0.14;
        const echoFilter = ctx.createBiquadFilter();
        echoFilter.type = 'lowpass'; echoFilter.frequency.value = 500;
        const echoGain = ctx.createGain();
        echoGain.gain.value = 0.3;
        echoDelay.connect(echoFilter);
        echoFilter.connect(echoGain);
        echoGain.connect(echoDelay);
        echoGain.connect(tGain);
        // fade echo
        echoGain.gain.setValueAtTime(0.3, now);
        echoGain.gain.exponentialRampToValueAtTime(0.001, now + 5);

        // 播放各层
        const playBuf = (buf, startAt, vol) => {
            const s = ctx.createBufferSource();
            s.buffer = buf;
            const g = ctx.createGain();
            g.gain.setValueAtTime(vol, startAt);
            g.gain.exponentialRampToValueAtTime(0.001, startAt + buf.duration);
            s.connect(g);
            g.connect(tGain);
            g.connect(echoDelay);
            s.start(startAt);
        };

        playBuf(bufs.snapBuf, now, 0.6 + Math.random() * 0.3);
        playBuf(bufs.crackBuf, now + 0.002, 0.7 + Math.random() * 0.4);
        playBuf(bufs.bassBuf, now + 0.005, 1.0 + Math.random() * 0.5);
        playBuf(bufs.rumbleBuf, now + 0.01, 0.8 + Math.random() * 0.4);

        // 清理子总线（延迟释放）
        setTimeout(() => { try { tGain.disconnect(); } catch(_){} }, 8000);
    }

    // 触发鸟鸣（短促振荡器频率扫描）
    function _chirpBird() {
        if (!CITY_AUDIO.enabled || !CITY_AUDIO.ctx) return;
        const ctx = CITY_AUDIO.ctx;
        const bg = CITY_AUDIO.birds.gain;
        if (!bg) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const freqBase = 2200 + Math.random() * 1800;
        osc.frequency.setValueAtTime(freqBase, now);
        osc.frequency.exponentialRampToValueAtTime(freqBase * 1.4, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(freqBase * 0.7, now + 0.16);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.04, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(g);
        g.connect(bg);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    function updateCityAudio(dt) {
        if (!CITY_AUDIO.initialized || !CITY_AUDIO.enabled) return;
        const ctx = CITY_AUDIO.ctx;
        if (!ctx || ctx.state !== 'running') return;
        const now = ctx.currentTime;
        const mg = CITY_AUDIO.masterGain;
        if (!mg) return;

        // ---- 风声：归一化风力(0-1) → 频率200-900Hz，音量0-0.25 ----
        const windForce = WEATHER.lerped.windSpeed;
        const windVol = windForce * 1.1;  // 0→0, 0.5→0.55, 1.0→1.1(由masterGain上限钳制)
        const windFreq = 200 + windForce * 700;  // 200→900Hz
        if (CITY_AUDIO.wind.filter) {
            CITY_AUDIO.wind.filter.frequency.setTargetAtTime(windFreq, now, 0.5);
            CITY_AUDIO.wind.gain.gain.setTargetAtTime(windVol * 0.25, now, 0.5);
        }

        // ---- 雨声：音量联动 rainIntensity，filter 联动雨量 ----
        const rainInt = WEATHER.lerped.rainIntensity || 0;
        const rainVol = Math.min(1, rainInt * 3.5);
        if (CITY_AUDIO.rain.filter) {
            const rainFreq = 3000 + rainInt * 5000;
            CITY_AUDIO.rain.filter.frequency.setTargetAtTime(rainFreq, now, 0.4);
            CITY_AUDIO.rain.lfoGain.gain.setTargetAtTime(500 + rainInt * 2000, now, 0.5);
            CITY_AUDIO.rain.lfo.frequency.setTargetAtTime(0.5 + rainInt * 3, now, 0.5);
            CITY_AUDIO.rain.gain.gain.setTargetAtTime(rainVol * 0.35, now, 0.3);
        }

        // ---- 城市交通底噪：日夜联动（夜晚安静些） ----
        const daytime = DAYNIGHT.dayness;
        const trafficTarget = 0.06 + daytime * 0.09;
        if (CITY_AUDIO.traffic.gain) {
            CITY_AUDIO.traffic.gain.gain.setTargetAtTime(trafficTarget, now, 0.8);
        }

        // ---- 雷声：不再独立触发，改由 triggerLightning() 统一调度（P1修复：音画同步） ----
        // CITY_AUDIO.thunder.lastTrigger 仅保留供 _playThunder() 内部 cooldown 检查

        // ---- 鸟鸣：季节联动（春/夏活跃，秋/冬静默） ----
        const season = SEASON.name;
        const birdActive = (season === 'Spring' || season === 'Summer');
        if (birdActive && daytime > 0.15 && daytime < 0.9 && rainInt < 0.05) {
            CITY_AUDIO.birds.timer += dt;
            if (CITY_AUDIO.birds.timer >= CITY_AUDIO.birds.nextChirp) {
                _chirpBird();
                CITY_AUDIO.birds.timer = 0;
                CITY_AUDIO.birds.nextChirp = 3 + Math.random() * 12;
            }
        } else {
            CITY_AUDIO.birds.timer = 0;
            CITY_AUDIO.birds.nextChirp = 8;
        }
    }

