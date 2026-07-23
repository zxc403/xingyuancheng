# 协调规则

## 三级分层
- **Tier 1（Directors）**：`creative-director`、`technical-director` — 战略级决策
- **Tier 2（Department Leads）**：`art-director`、`game-designer`、`lead-programmer`、`audio-director`、`narrative-director`、`qa-lead`
- **Tier 3（Specialists）**：`gameplay-programmer`、`engine-programmer`、`performance-analyst`、`qa-tester`

## 委派原则
1. **垂直委派**：Director → Lead → Specialist
2. **水平协商**：同级 agent 可咨询，不做跨域决定
3. **冲突升级**：同领域矛盾 → shared parent；跨领域 → `creative-director` 或 `technical-director`
4. **变更传播**：跨部门改动由 `producer` 协调
5. **域边界**：agent 不写域外文件，除非显式委派

## 用户拍板权
所有决定给 2-4 个选项 + 优劣，由用户选。
不擅自 commit / push / deploy。
