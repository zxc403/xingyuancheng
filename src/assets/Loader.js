// src/assets/Loader.js
// v6.10.0 占位文件 - 统一资产加载器（GLB / HDRI / 贴图）

export class Loader {
    constructor() {
        this.cache = new Map();
        this.loading = new Map();
        console.log('[Loader] 占位构造完成');
    }

    async glb(path) {
        // TODO v6.10.6: GLTFLoader + 缓存
    }

    async hdri(path) {
        // TODO v6.10.6: RGBELoader + 缓存
    }

    async texture(path) {
        // TODO v6.10.6: TextureLoader + 缓存
    }
}
