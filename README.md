# 星渊城 v6.7

> 升级日志 v6.7

## 主要改动

### v6.6 角色系统
- 用 Three.js 官方 Xbot + Soldier 替换程序化几何体
- 材质按 glbKey + 材质名精确染色（保留贴图原细节）
- Soldier: VanguardBodyMat 染色（衣服），Vanguard_VisorMat 保留（护目镜）
- Xbot: Beta_HighLimbsGeoSG2 染色（衣服），Beta_Joints_MAT 保留（皮肤）
- NPC 状态机驱动的动画切换：idle / walk / run
- 0.2s 平滑 cross-fade 过渡

### v6.7 昼夜系统
- 6 个 HDRI：day_quarry (1K), kloppenheim_06 (4K), qwantani_night, moonless_golf, neon_photostudio, the_sky_is_on_fire
- setTimeOfDay('day' | 'dusk' | 'night') 切换
- 同步雾色、阳光强度、tone mapping 曝光
- HUD 右上角"☀️ 日 / 🌇 黄昏 / 🌃 夜"按钮循环切换

## 启动

直接打开 index.html，或用 Python http server 启动：
```bash
python3 -m http.server 8000
# 浏览器访问 http://127.0.0.1:8000/
```
