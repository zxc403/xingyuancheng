// src/core/RendererBackend.js
// v6.10.6: 渲染后端抽象层 - 准备 WebGPU 接入点（v6.11 实际切换）
//
// 目标：让未来切换到 WebGPU 只改这一个文件
//
// v6.10.6 阶段：
// 1. 暴露后端类型枚举（WebGL2 / WebGPU）
// 2. 提供统一接口：createScene / createCamera / createRenderer
// 3. 探测浏览器能力，决定走哪条路
// 4. 保持和原代码 100% 兼容（仍返回 WebGLRenderer）
//
// v6.11 阶段：
// 1. 探测 navigator.gpu → 优先 WebGPURenderer
// 2. 失败 → 降级 WebGLRenderer
// 3. 所有 src/ 模块只通过此接口拿 renderer

const THREE = window.THREE;

export const Backend = {
    WEBGL2: 'webgl2',
    WEBGPU: 'webgpu',
    UNKNOWN: 'unknown'
};

export class RendererBackend {
    constructor() {
        this.current = Backend.WEBGL2;
        this.capabilities = {
            webgpu: false,
            webgl2: false,
            extensions: {}
        };
        console.log('[RendererBackend] 构造完成');
    }

    /**
     * 探测浏览器能力
     */
    async detectCapabilities() {
        // WebGL2
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2');
            this.capabilities.webgl2 = !!gl;
            if (gl) {
                // 收集扩展
                this.capabilities.extensions = {
                    EXT_color_buffer_float: !!gl.getExtension('EXT_color_buffer_float'),
                    OES_texture_float_linear: !!gl.getExtension('OES_texture_float_linear'),
                    EXT_texture_filter_anisotropic: !!gl.getExtension('EXT_texture_filter_anisotropic'),
                    WEBGL_depth_texture: !!gl.getExtension('WEBGL_depth_texture')
                };
            }
        } catch (e) {
            console.warn('[RendererBackend] WebGL2 探测失败', e);
        }

        // WebGPU
        try {
            if (navigator.gpu) {
                const adapter = await navigator.gpu.requestAdapter();
                this.capabilities.webgpu = !!adapter;
            }
        } catch (e) {
            console.warn('[RendererBackend] WebGPU 探测失败', e);
        }

        // 决定主后端：v6.12 (M3.3) 默认走 WebGL2（WebGPU 仍是 alpha，需 ?webgpu=1 显式开）
        const explicitWebGPU = (typeof location !== 'undefined' &&
            /[?&]webgpu=1\b/.test(location.search));
        if (this.capabilities.webgpu && explicitWebGPU) {
            this.current = Backend.WEBGPU;
        } else if (this.capabilities.webgpu) {
            // 有能力但不显式开启 → 默认 WebGL2（避免 r160 alpha 期黑屏）
            this.current = Backend.WEBGL2;
            this._webgpuAvailable = true;
        } else if (this.capabilities.webgl2) {
            this.current = Backend.WEBGL2;
        } else {
            this.current = Backend.UNKNOWN;
        }

        console.log('[RendererBackend] 能力探测', this.capabilities);
        console.log('[RendererBackend] 主后端', this.current);
        return this.capabilities;
    }

    /**
     * v6.12 (M3.3): 创建 renderer — 优先 WebGPU，降级 WebGL2
     * WebGPU 在 r160 是独立子模块 three/addons/renderers/webgpu/WebGPURenderer.js
     * 需要 dynamic import 拿到（同步 import 会拖累首屏）
     * @param {Object} opts
     * @returns {Promise<THREE.WebGLRenderer | null>}
     */
    async createRenderer(opts = {}) {
        if (this.current === Backend.WEBGPU) {
            try {
                const mod = await import('three/addons/renderers/webgpu/WebGPURenderer.js');
                const WGPU = mod.WebGPURenderer || (mod.default && mod.default.WebGPURenderer);
                if (WGPU) {
                    console.log('[RendererBackend] 使用 WebGPURenderer');
                    // WebGPU 在 r160 是 alpha：forceWebGL=false 让它回退 WebGL2 路径如果不支持
                    return new WGPU({ ...opts, forceWebGL: false });
                }
                console.warn('[RendererBackend] WebGPURenderer 模块未找到，降级 WebGL2');
            } catch (e) {
                console.warn('[RendererBackend] WebGPU 加载失败，降级 WebGL2', e);
            }
        }
        try {
            return new THREE.WebGLRenderer(opts);
        } catch (e) {
            console.error('[RendererBackend] WebGLRenderer 创建失败', e);
            return null;
        }
    }

    /**
     * v6.12 (M3.3): 同步版 createRenderer（兼容老调用，v6.13 改 async）
     * @deprecated 用 await createRenderer(opts)
     */
    createRendererSync(opts = {}) {
        return new THREE.WebGLRenderer(opts);
    }

    /**
     * 推荐像素比
     */
    recommendPixelRatio() {
        if (this.current === Backend.WEBGPU) return Math.min(window.devicePixelRatio, 2);
        // WebGL2 移动端限制 1.5
        if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
            return Math.min(window.devicePixelRatio, 1.5);
        }
        return Math.min(window.devicePixelRatio, 2);
    }
}
