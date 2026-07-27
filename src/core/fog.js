    function setupFog() {
        // 场景全局雾
        scene.fog = new THREE.Fog(0x8899aa, 120, 450);

        // P20B-III: Ground Fog (height-attenuated + FBM noise + wind drift)
        const fogGeo = new THREE.PlaneGeometry(500, 500);
        fogGeo.rotateX(-Math.PI / 2);
        const fogMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0x8899bb) },
                uFogColor: { value: new THREE.Color(0x8899aa) },
                uMaxHeight: { value: 18 },
                uDensity: { value: 0.35 },
                uWind: { value: new THREE.Vector2(0, 0) },
            },
            vertexShader: `
                varying vec3 vWorldPos;
                varying vec2 vUv;
                void main() {
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vWorldPos;
                varying vec2 vUv;
                uniform float uTime;
                uniform vec3 uColor, uFogColor;
                uniform float uMaxHeight, uDensity;
                uniform vec2 uWind;

                float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float noise(vec2 p) {
                    vec2 i = floor(p); vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
                }
                float fbm(vec2 p) {
                    float sum = 0.0, amp = 1.0;
                    for (int i = 0; i < 4; i++) {
                        sum += noise(p) * amp;
                        p *= 2.0; amp *= 0.5;
                    }
                    return sum / 1.875;
                }

                void main() {
                    // wind-driven noise offset
                    vec2 noiseUv = vUv * 5.0 + uWind * uTime * 0.004;
                    float n = fbm(noiseUv);
                    n = smoothstep(0.3, 0.7, n);

                    // height attenuation (quadratic: densest at ground, gone at maxHeight)
                    float h = 1.0 - smoothstep(0.0, uMaxHeight, vWorldPos.y);
                    h *= h;

                    // spatial edge fade
                    float dist = length(vWorldPos.xz) * 0.004;
                    float edge = smoothstep(0.0, 0.35, dist) * smoothstep(1.2, 0.25, dist);
                    float rim = smoothstep(230.0, 250.0, length(vWorldPos.xz))
                              * (1.0 - smoothstep(0.0, 30.0, length(vWorldPos.xz)));

                    float alpha = n * h * uDensity * edge * rim;
                    gl_FragColor = vec4(mix(uFogColor, uColor, 0.5), alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            depthTest: true,
        });
        const fogPlane = new THREE.Mesh(fogGeo, fogMat);
        fogPlane.position.y = 1.5;
        fogPlane.renderOrder = 10;
        fogPlane.name = 'groundFog';
        scene.add(fogPlane);
        window._fogPlane = fogPlane;
    }

    // ---- P12: 种子化 RNG + 存档系统 ----
