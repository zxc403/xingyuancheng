// src/main.js
// v6.10.0 主入口 - boot 顺序：core → assets → entities → physics → ai → ui → gameLoop

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

    // Phase 4: 实体（依赖 core + physics）
    const player = new Player();
    const npcs = [];
    const vehicles = [];

    // Phase 5: UI
    const hud = new HUD();
    const menu = new Menu();

    // TODO v6.10.1+: 逐步从 index.html 迁移实际逻辑

    console.log('[v6.10.0] boot complete (骨架已就位)');
    console.log('  下一阶段：v6.10.1 - 抽离 Renderer 真实逻辑');

    // 暴露到 window 方便调试
    window.__game = { renderer, input, audio, gameLoop, loader, collision, pathfinder, player, npcs, vehicles, hud, menu };
}

// 等待 DOM ready 再启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
