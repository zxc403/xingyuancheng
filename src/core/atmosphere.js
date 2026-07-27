    function createAtmosphere() {
        // ===== P18: 体积大气系统 =====

        // --- P18A: 大气透视雾（注入到建筑材质） ---
        const fogColor = new THREE.Color(0.85, 0.82, 0.78);
        const fogShaderPatch = (shader) => {
            shader.vertexShader = shader.vertexShader.replace(
                'void main() {',
                `varying vec3 vFogWorldPos;\n    void main() {\n        vec4 wp = modelMatrix * vec4(position, 1.0);\n        vFogWorldPos = wp.xyz;`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                'void main() {',
                `uniform float uFogNear;\n    uniform float uFogFar;\n    uniform float uFogHeightMin;\n    uniform float uFogHeightMax;\n    uniform vec3 uFogColor;\n    varying vec3 vFogWorldPos;\n    void main() {`
            );
            // Inject fog mix before gl_FragColor
            const patterns = [
                'gl_FragColor = vec4(outgoingLight, diffuseColor.a);',
                'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
                'gl_FragColor = vec4( outgoingLight, 1.0 );',
                'gl_FragColor = vec4(outgoingLight, 1.0);'
            ];
            for (const p of patterns) {
                if (shader.fragmentShader.includes(p)) {
                    shader.fragmentShader = shader.fragmentShader.replace(
                        p,
                        `float fogDist = length(vFogWorldPos.xz - cameraPosition.xz);\n    float distFog = smoothstep(uFogNear, uFogFar, fogDist);\n    float heightFog = 1.0 - smoothstep(uFogHeightMin, uFogHeightMax, vFogWorldPos.y);\n    float totalFog = max(distFog, heightFog * 0.6);\n    outgoingLight = mix(outgoingLight, uFogColor, totalFog * 0.55);\n    ` + p
                    );
                    break;
                }
            }
            shader.uniforms = shader.uniforms || {};
            shader.uniforms.uFogNear = { value: 120 };
            shader.uniforms.uFogFar = { value: 500 };
            shader.uniforms.uFogHeightMin = { value: -20 };
            shader.uniforms.uFogHeightMax = { value: 40 };
            shader.uniforms.uFogColor = { value: new THREE.Color(0.82, 0.84, 0.86) };
        };

        let fogInjected = 0;
        scene.traverse((obj) => {
            if (obj.isMesh && obj.material && obj.material.isMeshStandardMaterial) {
                // 只给建筑和较大物体注入雾效（跳过水面、植被、地面）
                const name = (obj.name || '').toLowerCase();
                const skip = ['water', 'tree', 'leaf', 'pedestrian', 'road', 'grass', 'plant', 'flower', 'bush'];
                if (skip.some(s => name.includes(s))) return;
                // 跳过高物体（比如天空、穹顶）
                if (obj.position.y > 80) return;
                if (obj.geometry && obj.geometry.type === 'PlaneGeometry') return; // 跳过地面
                try {
                    if (!obj.material._fogPatched) {
                        obj.material.onBeforeCompile = fogShaderPatch;
                        obj.material._fogPatched = true;
                        fogInjected++;
                    }
                } catch(e) {}
            }
        });

        // --- P18B: 动态雾色 uniform 存储 ---
        window._atmosphere = {
            fogMaterials: [],
            fogColor: new THREE.Color(0.82, 0.84, 0.86),
            update: function(dt) {
                // 根据时间/天气动态调整雾色
                const d = DAYNIGHT.dayness;
                const sunDir = window._skyDome ? window._skyDome.material.uniforms.uSunDirection.value : new THREE.Vector3(0.5, 0.8, 0.4);
                const sunY = sunDir.y;
                const sunset = 1.0 - smoothstep(-0.15, 0.25, sunY);

                // 白天：微蓝白，日落：暖橙，夜间：深蓝灰
                const dayFog = new THREE.Color(0.82, 0.84, 0.88);
                const sunsetFog = new THREE.Color(0.9, 0.7, 0.55);
                const nightFog = new THREE.Color(0.15, 0.18, 0.3);

                this.fogColor.copy(dayFog).lerp(sunsetFog, sunset * 0.6);
                this.fogColor.lerp(nightFog, (1.0 - d) * 0.7);

                // 更新天空穹顶 turbidity（夕阳时浑浊度增加）
                if (window._skyDome) {
                    window._skyDome.material.uniforms.uTurbidity.value = 2.5 + sunset * 2.0;
                    window._skyDome.material.uniforms.uExposure.value = 0.8 + sunset * 0.4 + d * 0.2;
                }
            }
        };

        console.log(`[P18] 体积大气系统已创建 (大气散射天空 + ${fogInjected} 个材质雾效注入)`);
    }


    // ===== P18: 更新大气系统 =====
    function updateAtmosphere(dt) {
        if (window._atmosphere && window._atmosphere.update) {
            window._atmosphere.update(dt);
        }
    }

