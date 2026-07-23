---
paths:
  - "index.html"
---

# 编码标准：index.html

## 版本号
所有改动必须含 `// v6.x: <一句话>` 注释。

## 资源加载
- 相对路径 `assets/...`，不写绝对 URL
- 任何 `fetch().then()` 必须 `.catch()` 并静默降级
- 任何 GLB / HDRI 加载必须有 8s 超时，失败用 `CanvasTexture` 占位

## 错误处理
- 全局 `window.addEventListener('unhandledrejection', e => e.preventDefault())` 已设
- 关键 Promise 用 `try { await ... } catch(e) { /* 降级 */ }`

## 移动端降级
```js
if (window._isMobile) {
  // 纹理集 4 套而非 8 套
  // ShadowMap 2048 而非 4096
  // PixelRatio 上限 1.5
}
```

## 渲染
- 玩家 / NPC 切换动画走 `AnimationMixer.fadeIn/fadeOut(0.2)`
- 染色前 `c.material = c.material.clone()`
- 不要每帧 new Geometry / Material
