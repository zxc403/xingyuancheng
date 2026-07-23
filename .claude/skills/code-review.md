# /code-review — 审查一段 index.html 改动

检查清单：
- [ ] 没有新增 console.error / 抛 Promise 异常
- [ ] 玩家 / NPC 切换动画走 fadeIn/fadeOut
- [ ] 材质染色前 .clone()，不污染共享 Mesh
- [ ] 资源路径用相对 `assets/...`
- [ ] 移动端路径有降级（if isMobile）
- [ ] 改动处有 `// v6.x: ...` 注释
