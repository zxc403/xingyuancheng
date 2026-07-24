// src/ui/AvatarPanel.js
// v6.11.0 (M2.5): 玩家 Avatar 自定义面板
//
// 5 维度调节 + 角色换皮：
//   1. 角色模型：char_xbot / char_soldier / char_robot / char_rpm / char_knight_student
//   2. 体型：slim / standard / muscular / heavy / child
//   3. 身高：0.5 - 2.5 m 滑块
//   4. 肤色：light / tan / brown / dark / pale
//   5. 服装：shirt / pants / shoes / gloves / hat  × 6 色板
//   6. 玩家名字：文本输入（最长 16 字符）
//
// 用法：
//   import { AvatarPanel } from './AvatarPanel.js';
//   const panel = new AvatarPanel();
//   panel.bindPlayer(playerModule);  // 注入 player 实例
//   panel.toggle();                  // 打开 / 关闭
//
// 持久化：M2.5 用 localStorage 'avatar_v6_11'，由 AvatarCustomization 自己管理
//         额外加 'avatar_char_v6_11' 记录当前角色 GLB key
//
// 触发：U 键（index.html 监听），再次按关闭，ESC 也关闭

const THREE = window.THREE;

const HTML = `
<div id="avatarPanel" class="avp hidden">
    <div class="avp-header">
        <span>🧍 Avatar 自定义</span>
        <button class="avp-close" type="button">×</button>
    </div>
    <div class="avp-body">
        <!-- 1. 角色选择 -->
        <div class="avp-section">
            <div class="avp-label">角色模型</div>
            <div class="avp-row" data-row="char">
                <!-- 动态填充 -->
            </div>
        </div>

        <!-- 2. 体型 -->
        <div class="avp-section">
            <div class="avp-label">体型</div>
            <div class="avp-row" data-row="body">
                <!-- 动态填充 -->
            </div>
        </div>

        <!-- 3. 身高 -->
        <div class="avp-section">
            <div class="avp-label">身高 <span class="avp-val" data-val="height">1.70 m</span></div>
            <input type="range" min="0.5" max="2.5" step="0.05" class="avp-slider" data-input="height" />
        </div>

        <!-- 4. 肤色 -->
        <div class="avp-section">
            <div class="avp-label">肤色</div>
            <div class="avp-row" data-row="skin">
                <!-- 动态填充 -->
            </div>
        </div>

        <!-- 5. 服装 -->
        <div class="avp-section">
            <div class="avp-label">服装</div>
            <div class="avp-outfit">
                <div class="avp-slot">
                    <div class="avp-slot-name">上衣</div>
                    <div class="avp-row" data-row="shirt"></div>
                </div>
                <div class="avp-slot">
                    <div class="avp-slot-name">裤子</div>
                    <div class="avp-row" data-row="pants"></div>
                </div>
                <div class="avp-slot">
                    <div class="avp-slot-name">鞋子</div>
                    <div class="avp-row" data-row="shoes"></div>
                </div>
                <div class="avp-slot">
                    <div class="avp-slot-name">手套</div>
                    <div class="avp-row" data-row="gloves"></div>
                </div>
                <div class="avp-slot">
                    <div class="avp-slot-name">帽子</div>
                    <div class="avp-row" data-row="hat"></div>
                </div>
            </div>
        </div>

        <!-- 6. 名字 -->
        <div class="avp-section">
            <div class="avp-label">玩家名字</div>
            <input type="text" maxlength="16" class="avp-text" data-input="name" placeholder="Player" />
        </div>

        <div class="avp-actions">
            <button class="avp-btn" data-action="save">💾 保存</button>
            <button class="avp-btn" data-action="reset">↻ 重置默认</button>
        </div>

        <div class="avp-tip">提示：U 键打开 / 关闭 · ESC 关闭</div>
    </div>
</div>
`;

const CSS = `
#avatarPanel.avp {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 460px;
    max-width: 92vw;
    max-height: 90vh;
    overflow-y: auto;
    background: rgba(20, 24, 30, 0.96);
    color: #e8eef4;
    border: 1px solid rgba(120, 180, 255, 0.35);
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(120, 180, 255, 0.18) inset;
    z-index: 15000;
    font-family: 'Segoe UI', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
    user-select: none;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}
#avatarPanel.avp.hidden { display: none; }

#avatarPanel .avp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(120, 180, 255, 0.2);
    background: linear-gradient(180deg, rgba(60, 100, 180, 0.18), transparent);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.04em;
}
#avatarPanel .avp-close {
    background: transparent;
    color: #e8eef4;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    width: 28px;
    height: 28px;
    font-size: 18px;
    cursor: pointer;
    line-height: 1;
}
#avatarPanel .avp-close:hover { background: rgba(255, 80, 80, 0.2); }

#avatarPanel .avp-body { padding: 12px 16px 16px; }

#avatarPanel .avp-section { margin-bottom: 14px; }
#avatarPanel .avp-label {
    font-size: 12px;
    text-transform: uppercase;
    color: #88aacc;
    margin-bottom: 6px;
    letter-spacing: 0.06em;
}
#avatarPanel .avp-val { color: #ffd97a; font-weight: 600; }

#avatarPanel .avp-row { display: flex; flex-wrap: wrap; gap: 6px; }

#avatarPanel .avp-chip {
    background: rgba(40, 50, 65, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #d8e4f0;
    padding: 6px 10px;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 5px;
}
#avatarPanel .avp-chip:hover {
    background: rgba(80, 110, 150, 0.9);
    transform: translateY(-1px);
}
#avatarPanel .avp-chip.active {
    background: linear-gradient(180deg, #4a90e2, #2a6fbe);
    border-color: #6cb0ff;
    color: #fff;
    box-shadow: 0 2px 8px rgba(80, 140, 220, 0.45);
}
#avatarPanel .avp-chip .avp-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3) inset;
}

#avatarPanel .avp-slider {
    width: 100%;
    accent-color: #4a90e2;
    margin: 4px 0 0;
}

#avatarPanel .avp-text {
    width: 100%;
    padding: 6px 8px;
    background: rgba(40, 50, 65, 0.85);
    color: #e8eef4;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    font-size: 13px;
    box-sizing: border-box;
}
#avatarPanel .avp-text:focus { outline: 1px solid #4a90e2; }

#avatarPanel .avp-outfit { display: flex; flex-direction: column; gap: 8px; }
#avatarPanel .avp-slot { display: flex; align-items: center; gap: 10px; }
#avatarPanel .avp-slot-name { width: 38px; font-size: 12px; color: #a8b8c8; }

#avatarPanel .avp-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(120, 180, 255, 0.18);
}
#avatarPanel .avp-btn {
    flex: 1;
    padding: 8px 12px;
    background: rgba(60, 100, 160, 0.6);
    color: #fff;
    border: 1px solid rgba(120, 180, 255, 0.4);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s ease;
}
#avatarPanel .avp-btn:hover { background: rgba(80, 120, 180, 0.85); }
#avatarPanel .avp-btn[data-action="reset"] { background: rgba(120, 60, 60, 0.5); }
#avatarPanel .avp-btn[data-action="reset"]:hover { background: rgba(150, 70, 70, 0.7); }

#avatarPanel .avp-tip {
    margin-top: 10px;
    font-size: 11px;
    color: #6a7a8a;
    text-align: center;
}
`;

const STORAGE_CHAR_KEY = 'avatar_char_v6_11';

export class AvatarPanel {
    constructor() {
        this.player = null;
        this.isOpen = false;
        this._ensureDom();
        this._wire();
    }

    _ensureDom() {
        if (document.getElementById('avatarPanel')) return;
        // 注入 CSS
        if (!document.getElementById('avpStyle')) {
            const s = document.createElement('style');
            s.id = 'avpStyle';
            s.textContent = CSS;
            document.head.appendChild(s);
        }
        // 注入 HTML
        const wrap = document.createElement('div');
        wrap.innerHTML = HTML;
        while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    }

    _wire() {
        const panel = document.getElementById('avatarPanel');
        // 关闭按钮
        panel.querySelector('.avp-close').addEventListener('click', () => this.hide());
        // 行动按钮
        panel.querySelectorAll('.avp-btn').forEach(b => {
            b.addEventListener('click', () => {
                const act = b.getAttribute('data-action');
                if (act === 'save') this.save();
                if (act === 'reset') this.reset();
            });
        });
        // 滑块
        const heightInput = panel.querySelector('[data-input="height"]');
        heightInput.addEventListener('input', () => {
            const v = parseFloat(heightInput.value);
            panel.querySelector('[data-val="height"]').textContent = v.toFixed(2) + ' m';
            if (this.player && this.player.avatar) this.player.avatar.setHeight(v);
        });
        // 名字
        const nameInput = panel.querySelector('[data-input="name"]');
        nameInput.addEventListener('input', () => {
            if (this.player && this.player.avatar) this.player.avatar.setName(nameInput.value);
        });
        // ESC 关闭
        document.addEventListener('keydown', (e) => {
            if (this.isOpen && e.key === 'Escape') this.hide();
        });
    }

    /**
     * 注入 player 实例 + 渲染所有 chip
     */
    bindPlayer(player) {
        this.player = player;
        this._render();
    }

    _render() {
        if (!this.player || !this.player.avatar) return;
        const av = this.player.avatar;
        const cfg = av.getConfig();
        const panel = document.getElementById('avatarPanel');

        // 1. 角色 chip（可换皮的角色）
        const PLAYER_CHARS = ['char_xbot', 'char_soldier', 'char_robot', 'char_rpm', 'char_knight_student'];
        const charRow = panel.querySelector('[data-row="char"]');
        charRow.innerHTML = '';
        const currentChar = this.player.getCharacterKey ? this.player.getCharacterKey() : 'char_xbot';
        for (const k of PLAYER_CHARS) {
            const def = window.getCharReg ? window.getCharReg(k) : null;
            if (!def) continue;
            const chip = document.createElement('div');
            chip.className = 'avp-chip' + (k === currentChar ? ' active' : '');
            chip.textContent = def.source ? `${k.split('_').pop()}` : k;
            chip.title = `${k} (${def.source || ''})`;
            chip.addEventListener('click', () => {
                if (this.player.setCharacterKey) {
                    if (this.player.setCharacterKey(k)) {
                        // 切完后 chip 高亮需要重画
                        this._render();
                    }
                }
            });
            charRow.appendChild(chip);
        }

        // 2. 体型
        const bodyRow = panel.querySelector('[data-row="body"]');
        bodyRow.innerHTML = '';
        for (const { key, name } of av.listBodies()) {
            const chip = document.createElement('div');
            chip.className = 'avp-chip' + (cfg.body === key ? ' active' : '');
            chip.textContent = name;
            chip.addEventListener('click', () => {
                av.setBody(key);
                this._render();
            });
            bodyRow.appendChild(chip);
        }

        // 3. 身高
        const h = panel.querySelector('[data-input="height"]');
        h.value = cfg.height;
        panel.querySelector('[data-val="height"]').textContent = cfg.height.toFixed(2) + ' m';

        // 4. 肤色
        const skinRow = panel.querySelector('[data-row="skin"]');
        skinRow.innerHTML = '';
        for (const { key, name, color } of av.listSkins()) {
            const chip = document.createElement('div');
            chip.className = 'avp-chip' + (cfg.skin === key ? ' active' : '');
            const dotHex = '#' + color.toString(16).padStart(6, '0');
            chip.innerHTML = `<span class="avp-dot" style="background:${dotHex}"></span>${name}`;
            chip.addEventListener('click', () => {
                av.setSkin(key);
                this._render();
            });
            skinRow.appendChild(chip);
        }

        // 5. 服装（每个槽 6 色）
        const outfit = cfg.outfit || {};
        for (const slot of Object.keys(outfit)) {
            const slotRow = panel.querySelector(`[data-row="${slot}"]`);
            if (!slotRow) continue;
            slotRow.innerHTML = '';
            for (const { key, color } of av.listOutfitColors()) {
                const chip = document.createElement('div');
                chip.className = 'avp-chip' + (outfit[slot] === key ? ' active' : '');
                const dotHex = '#' + color.toString(16).padStart(6, '0');
                chip.innerHTML = `<span class="avp-dot" style="background:${dotHex}"></span>${key}`;
                chip.addEventListener('click', () => {
                    av.setOutfit(slot, key);
                    this._render();
                });
                slotRow.appendChild(chip);
            }
        }

        // 6. 名字
        const n = panel.querySelector('[data-input="name"]');
        if (document.activeElement !== n) n.value = cfg.name || '';
    }

    show() {
        if (!this.player) {
            // 尝试自动从 window.__game 取
            if (window.__game && window.__game.player) this.player = window.__game.player;
        }
        if (!this.player) {
            console.warn('[AvatarPanel] 玩家尚未就绪');
            return;
        }
        this._render();
        document.getElementById('avatarPanel').classList.remove('hidden');
        this.isOpen = true;
    }

    hide() {
        document.getElementById('avatarPanel').classList.add('hidden');
        this.isOpen = false;
    }

    toggle() {
        this.isOpen ? this.hide() : this.show();
    }

    save() {
        if (!this.player || !this.player.avatar) return;
        this.player.avatar.saveToStorage();
        // 额外存当前角色 GLB
        try {
            const cur = this.player.getCharacterKey ? this.player.getCharacterKey() : 'char_xbot';
            localStorage.setItem(STORAGE_CHAR_KEY, cur);
            console.log('[AvatarPanel] saved charKey=', cur);
        } catch (e) {}
        // UI 反馈
        const tip = document.querySelector('#avatarPanel .avp-tip');
        if (tip) {
            const old = tip.textContent;
            tip.textContent = '✓ 已保存到 localStorage';
            setTimeout(() => { tip.textContent = old; }, 1200);
        }
    }

    reset() {
        if (!window.AvatarCustomization) return;
        const def = window.AvatarCustomization.DEFAULT_CONFIG || (this.player.avatar && this.player.avatar.config);
        if (!def) return;
        // 重新生成默认 cfg
        const fresh = {
            body: 'standard',
            height: 1.7,
            skin: 'tan',
            name: 'Player',
            outfit: { shirt: 'blue', pants: 'black', shoes: 'black', gloves: 'black', hat: 'red' }
        };
        this.player.avatar.apply(fresh);
        // 角色也回退到 xbot
        if (this.player.setCharacterKey) this.player.setCharacterKey('char_xbot');
        this._render();
    }
}
