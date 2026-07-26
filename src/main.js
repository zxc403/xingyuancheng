// src/main.js
// v6.10.0 主入口 - boot 顺序：core → assets → entities → physics → ai → ui → gameLoop
// v6.12.0: 接入 ECS 层（World + 组件查询），渐进替代手动数组管理

import { Renderer } from './core/Renderer.js';
import { Input } from './core/Input.js';
import { Audio } from './core/Audio.js';
import { GameLoop } from './core/GameLoop.js';
import { Loader } from './assets/Loader.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import { Vehicle } from './entities/Vehicle.js';
import { Collision } from './physics/Collision.js';
import { Pathfinder } from './ai/Pathfinder.js';
import { HUD } from './ui/HUD.js';
import { Menu } from './ui/Menu.js';
import { World } from './ecs/index.js';

// Boot 顺序（CCGS Pipeline 风格）
async function boot() {
    console.log('[v6.10.0] boot start');

    // Phase 1: 核心（无依赖）
    const renderer = new Renderer(document.getElementById('c'));
    const input = new Input();
    const audio = new Audio();
    const gameLoop = new GameLoop();

    // Phase 2: 资产
    const loader = new Loader();

    // Phase 3: 物理 + AI
    const collision = new Collision();
    const pathfinder = new Pathfinder(null);

    // Phase 4: ECS World（统一实体注册表）
    const world = new World();

    // Phase 5: 实体（依赖 core + physics + world）
    const player = new Player();
    const npcs = [];
    const vehicles = [];

    // Phase 6: UI
    const hud = new HUD();
    const menu = new Menu();

    // TODO v6.10.1+: 逐步从 index.html 迁移实际逻辑

    console.log('[v6.10.0] boot complete (骨架已就位)');
    console.log('  下一阶段：v6.10.1 - 抽离 Renderer 真实逻辑');

    // 暴露到 window 方便调试（含 ECS World）
    // 使用方式：window.__game.world.with('transform', 'player').each(...)
    window.__game = { renderer, input, audio, gameLoop, loader, collision, pathfinder, world, player, npcs, vehicles, hud, menu };
}

// 等待 DOM ready 再启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
