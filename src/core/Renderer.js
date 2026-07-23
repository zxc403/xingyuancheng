// src/core/Renderer.js
// v6.10.1: 抽离 Renderer 模块 - 状态容器 + 增强器
//
// 设计思路：index.html 仍负责 Three.js 对象的创建（兼容老代码）
// Renderer 类是"增强器"，负责：
// 1. 接收已经创建好的 scene/camera/renderer/composer
// 2. 暴露统一接口给其他模块（Player/NPC/Vehicle 使用 scene.add / camera.position 等）
// 3. 封装 animate 循环的渲染部分（避免每个模块各自 requestAnimationFrame）
// 4. 提供 Resize 监听、像素比调整、性能统计
//
// 注意：v6.10.1 阶段不删 index.html 任何代码 - 是"加挂"模式
// v6.10.7 阶段（升级 Three.js r166 时）才把 initEngine 整段迁过来

export class Renderer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.clock = null;

        // 后处理 pass 引用
        this.ssaoPass = null;
        this.bloomPass = null;
        this.smaaPass = null;
        this.outputPass = null;

        // 性能 / 状态
        this.isMobile = false;
        this.pixelRatio = 1;
        this.lastResize = 0;
        this.fps = 60;
        this.fpsAccum = 0;
        this.fpsFrames = 0;

        // 暴露给全局（兼容 index.html 老代码）
        this._global = window;
    }

    /**
     * 接收 index.html 已经创建好的 scene/camera/renderer/composer
     * 这样不需要删除老代码，平滑过渡
     */
    attach({ scene, camera, renderer, composer, clock, isMobile }) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.composer = composer || null;
        this.clock = clock || new (window.THREE || {}).Clock?.() || { getDelta: ()=>1/60 };
        this.isMobile = !!isMobile;
        this.pixelRatio = renderer.getPixelRatio();

        console.log('[Renderer] attached', {
            scene: !!scene,
            camera: !!camera,
            renderer: !!renderer,
            composer: !!composer,
            isMobile: this.isMobile,
            pixelRatio: this.pixelRatio
        });
    }

    /**
     * 主循环 - 渲染部分
     * 调用方式：animate() 末尾调用 renderer.tick(needsPostProcessing)
     */
    tick(useComposer) {
        if (!this.renderer || !this.scene || !this.camera) {
            console.warn('[Renderer] tick called before attach');
            return;
        }

        if (useComposer && this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Resize 处理
     * 调用方式：window.addEventListener('resize', () => renderer.onResize())
     */
    onResize() {
        if (!this.renderer || !this.camera) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        if (this.composer) this.composer.setSize(w, h);
    }

    /**
     * FPS 统计
     * 调用方式：每帧调用 renderer.updateFPS(dt)
     */
    updateFPS(dt) {
        this.fpsAccum += dt;
        this.fpsFrames++;
        if (this.fpsAccum >= 0.5) {
            this.fps = Math.round(this.fpsFrames / this.fpsAccum);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }
    }

    /**
     * 暴露给 index.html 老代码的全局访问
     * 这样 window.scene / window.camera / window.renderer 仍能工作
     */
    syncGlobals() {
        this._global.scene = this.scene;
        this._global.camera = this.camera;
        this._global.renderer = this.renderer;
        this._global.composer = this.composer;
        this._global.clock = this.clock;
    }
}
