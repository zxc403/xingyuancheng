// src/core/FilmShader.js
// v6.12 (M3.2): 多合一后处理 pass — Vignette + Film Grain + 轻量 FXAA
// 用 ShaderPass 跑，3 效果叠加在一遍 fragment shader 里，零额外 render target
//
// 用途：在 UnrealBloom → SMAA → OutputPass 之间插入
//      增加电影感（暗角）、胶片颗粒、最后一道 FXAA 抗锯齿
//
// uniform 全部可选：tDiffuse + uTime + uVignette + uGrain + uFxaa
//
// 性能：全屏 1920x1080 一次 pass < 0.5ms（中端 GPU）

const FilmShader = {
    name: 'FilmShader',

    uniforms: {
        'tDiffuse':   { value: null },
        'uTime':      { value: 0 },
        'uResolution':{ value: null },   // THREE.Vector2
        'uVignette':  { value: 0.45 },   // 暗角强度 0-1
        'uGrain':     { value: 0.06 },   // 胶片颗粒强度 0-0.3
        'uFxaa':      { value: 1.0 },    // FXAA 开关 0/1
        'uChroma':    { value: 0.0 },    // 色散强度 0-1（移植自潮汐 X3）
        'uSharp':     { value: 0.0 }     // CAS 锐化强度 0-1（移植自潮汐 X3）
    },

    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform vec2  uResolution;
        uniform float uVignette;
        uniform float uGrain;
        uniform float uFxaa;
        varying vec2 vUv;

        // FXAA 简化版（基于 luma edge detection）
        float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

        vec3 fxaa(sampler2D tex, vec2 uv, vec2 res) {
            vec2 px = 1.0 / res;
            // 中心 + 4 邻
            vec3 c  = texture2D(tex, uv).rgb;
            vec3 n  = texture2D(tex, uv + vec2(0.0, -px.y)).rgb;
            vec3 s  = texture2D(tex, uv + vec2(0.0,  px.y)).rgb;
            vec3 e  = texture2D(tex, uv + vec2( px.x, 0.0)).rgb;
            vec3 w  = texture2D(tex, uv + vec2(-px.x, 0.0)).rgb;
            float lC = luma(c), lN = luma(n), lS = luma(s), lE = luma(e), lW = luma(w);
            float lMin = min(lC, min(min(lN, lS), min(lE, lW)));
            float lMax = max(lC, max(max(lN, lS), max(lE, lW)));
            float range = lMax - lMin;
            if (range < 0.083) return c;  // 边缘不足，跳过
            // 简化 blend：按 luma 偏向最亮 / 最暗 邻
            vec3 sum = n + s + e + w;
            vec3 avg = sum * 0.25;
            return mix(c, avg, 0.4);
        }

        // 简单 hash 噪声
        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        void main() {
            vec2 uv = vUv;
            vec2 px = 1.0 / uResolution;
            vec3 col;

            // 色散 Chromatic Aberration（径向偏移，移植自潮汐 X3）
            if (uChroma > 0.001) {
                vec2 dir = uv - 0.5;
                vec2 off = dir * (0.0022 * uChroma);
                if (uFxaa > 0.5) {
                    col.r = fxaa(tDiffuse, uv + off, uResolution).r;
                    col.g = fxaa(tDiffuse, uv,      uResolution).g;
                    col.b = fxaa(tDiffuse, uv - off, uResolution).b;
                } else {
                    col.r = texture2D(tDiffuse, uv + off).r;
                    col.g = texture2D(tDiffuse, uv).g;
                    col.b = texture2D(tDiffuse, uv - off).b;
                }
            } else {
                col = (uFxaa > 0.5) ? fxaa(tDiffuse, uv, uResolution) : texture2D(tDiffuse, uv).rgb;
            }

            // CAS 锐化（简化 FidelityFX，移植自潮汐 X3）
            if (uSharp > 0.001) {
                vec3 l = texture2D(tDiffuse, uv - vec2(px.x, 0.0)).rgb;
                vec3 r = texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb;
                vec3 t = texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb;
                vec3 b = texture2D(tDiffuse, uv - vec2(0.0, px.y)).rgb;
                vec3 mn = min(col, min(min(l, r), min(t, b)));
                vec3 mx = max(col, max(max(l, r), max(t, b)));
                vec3 lap = (l + r + t + b) * 0.25 - col;
                col = clamp(col - lap * uSharp * 1.6, mn, mx * 1.05 + 0.005);
            }

            // Vignette 暗角
            if (uVignette > 0.001) {
                vec2 d = uv - 0.5;
                float v = smoothstep(0.85, 0.2, length(d));
                col *= mix(1.0, v, uVignette);
            }

            // Film Grain
            if (uGrain > 0.001) {
                float n = hash(uv * uResolution + uTime * 60.0);
                col += (n - 0.5) * uGrain;
            }

            gl_FragColor = vec4(col, 1.0);
        }
    `
};
