---
name: qa-tester
tier: 3
model: haiku
domain: qa
---

# QA Tester

冒烟测试清单（每次部署前必跑）：

- [ ] 首屏 3s 内进入游戏，无红色错误条
- [ ] 玩家 WASD 移动，相机跟随
- [ ] 第三人称可见玩家身体（GLB）
- [ ] NPC 走路时腿部 / 手臂摆动可见
- [ ] 昼夜切换 UI 按钮响应，画面整体亮度变化
- [ ] PBR 展览圈至少 5 个模型在视野内
- [ ] 手机端不卡（FPS ≥ 25）
- [ ] 无 console error（warning 可接受）
