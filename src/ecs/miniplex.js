// src/ecs/miniplex.js
// 星渊城 ECS 核心 — 基于 hmans/miniplex 思路的独立实现
// 零外部依赖，纯 ES Module，直接兼容 Three.js r160
//
// 架构：
//   Bucket  → 实体容器 + 增删事件
//   World   → 扩展 Bucket，支持 .with()/.without() 组件查询 + entity ID
//   Query   → 懒连接查询结果集，自动跟踪增删变化
//
// 用法：
//   import { World } from './ecs/miniplex.js';
//   const world = new World();
//   const player = world.add({ transform: mesh, health: 100, player: true });
//   const npcs = world.with('transform', 'npc');
//   for (const npc of npcs) { npc.transform.rotation.y += 0.01; }

// ============ Event (micro event emitter) ============
class Event {
    constructor() {
        this._listeners = [];
        this._onSubscribe = [];
    }

    subscribe(fn) {
        this._listeners.push(fn);
        // 触发 onSubscribe 回调（用于 Query 自动连接）
        for (const cb of this._onSubscribe) cb(fn);
        return () => { this._listeners = this._listeners.filter(l => l !== fn); };
    }

    emit(...args) {
        for (const fn of this._listeners) fn(...args);
    }

    get onSubscribe() {
        return {
            subscribe: (fn) => { this._onSubscribe.push(fn); }
        };
    }
}

// ============ Bucket (entity container) ============
export class Bucket {
    constructor(entities = []) {
        this._entities = entities;
        this._version = 0;
        this._positions = new Map();

        this.onEntityAdded = new Event();
        this.onEntityRemoved = new Event();

        for (let i = 0; i < entities.length; i++) {
            this._positions.set(entities[i], i);
        }
    }

    get version() { return this._version; }
    get entities() { return this._entities; }
    get size() { return this._entities.length; }
    get first() { return this._entities[0]; }

    [Symbol.iterator]() {
        let index = this._entities.length;
        return {
            next: () => {
                index--;
                return { value: this._entities[index], done: index < 0 };
            }
        };
    }

    has(entity) {
        return this._positions.has(entity);
    }

    add(entity) {
        if (entity && !this.has(entity)) {
            this._entities.push(entity);
            this._positions.set(entity, this._entities.length - 1);
            this._version++;
            this.onEntityAdded.emit(entity);
        }
        return entity;
    }

    remove(entity) {
        if (this.has(entity)) {
            this.onEntityRemoved.emit(entity);

            const index = this._positions.get(entity);
            this._positions.delete(entity);

            const other = this._entities[this._entities.length - 1];
            if (other !== entity) {
                this._entities[index] = other;
                this._positions.set(other, index);
            }

            this._entities.pop();
            this._version++;
        }
        return entity;
    }

    clear() {
        for (const entity of [...this]) {
            this.remove(entity);
        }
    }
}

// ============ Query ============
class Query extends Bucket {
    constructor(world, config) {
        super();
        this.world = world;
        this.config = config;
        this._isConnected = false;
        this.key = _configKey(config);

        // 自动连接：首次迭代或访问 entities 时触发
        this.onEntityAdded.onSubscribe.subscribe(() => this.connect());
        this.onEntityRemoved.onSubscribe.subscribe(() => this.connect());
    }

    get isConnected() { return this._isConnected; }

    get entities() {
        if (!this._isConnected) this.connect();
        return super.entities;
    }

    [Symbol.iterator]() {
        if (!this._isConnected) this.connect();
        return super[Symbol.iterator]();
    }

    connect() {
        if (!this._isConnected) {
            this._isConnected = true;
            for (const entity of this.world) {
                this._evaluate(entity);
            }
        }
        return this;
    }

    disconnect() {
        this._isConnected = false;
        return this;
    }

    with(...components) {
        return this.world._query({
            with: [...this.config.with, ...components],
            without: this.config.without,
            predicates: this.config.predicates
        });
    }

    without(...components) {
        return this.world._query({
            with: this.config.with,
            without: [...this.config.without, ...components],
            predicates: this.config.predicates
        });
    }

    where(predicate) {
        return this.world._query({
            with: this.config.with,
            without: this.config.without,
            predicates: [...this.config.predicates, predicate]
        });
    }

    _want(entity) {
        const { with: w, without: wo, predicates } = this.config;
        return (
            w.every(c => entity[c] !== undefined) &&
            wo.every(c => entity[c] === undefined) &&
            predicates.every(p => p(entity))
        );
    }

    _evaluate(entity) {
        if (!this._isConnected) return;
        const wanted = this._want(entity);
        const has = this.has(entity);
        if (wanted && !has) this.add(entity);
        else if (!wanted && has) this.remove(entity);
    }
}

// ============ World ============
export class World extends Bucket {
    constructor(entities = []) {
        super(entities);

        this._queries = new Set();
        this._entityToId = new Map();
        this._idToEntity = new Map();
        this._nextId = 0;

        // 实体增删时自动 reindex
        this.onEntityAdded.subscribe(e => this._reindex(e));
        this.onEntityRemoved.subscribe(e => {
            for (const q of this._queries) q.remove(e);
            if (this._entityToId.has(e)) {
                const id = this._entityToId.get(e);
                this._idToEntity.delete(id);
                this._entityToId.delete(e);
            }
        });
    }

    // --- 查询 API ---
    with(...components) {
        return this._query({ with: components, without: [], predicates: [] });
    }

    without(...components) {
        return this._query({ with: [], without: components, predicates: [] });
    }

    where(predicate) {
        return this._query({ with: [], without: [], predicates: [predicate] });
    }

    _query(config) {
        const normalized = _normalizeConfig(config);
        const key = _configKey(normalized);
        for (const q of this._queries) {
            if (q.key === key) return q;
        }
        const query = new Query(this, normalized);
        this._queries.add(query);
        return query;
    }

    _reindex(entity) {
        if (!this.has(entity)) return;
        for (const q of this._queries) {
            q._evaluate(entity);
        }
    }

    // --- 实体修改后通知 ---
    changed(entity) {
        this._reindex(entity);
        return entity;
    }

    // --- Entity ID ---
    id(entity) {
        if (!this.has(entity)) return undefined;
        if (!this._entityToId.has(entity)) {
            const id = this._nextId++;
            this._entityToId.set(entity, id);
            this._idToEntity.set(id, entity);
        }
        return this._entityToId.get(entity);
    }

    entity(id) {
        return this._idToEntity.get(id);
    }

    // --- 组件级操作 ---
    addComponent(entity, component, value) {
        if (entity[component] !== undefined) return;
        entity[component] = value;
        this._reindex(entity);
    }

    removeComponent(entity, component) {
        if (entity[component] === undefined) return;
        delete entity[component];
        this._reindex(entity);
    }
}

// ============ 内部工具 ============
function _normalizeConfig(config) {
    return {
        with: [...new Set(config.with.filter(c => c))].sort(),
        without: [...new Set(config.without.filter(c => c))].sort(),
        predicates: [...new Set(config.predicates)]
    };
}

let _idCounter = 0;
function _configKey(config) {
    const predKeys = config.predicates.map(() => 'p' + (_idCounter++));
    return `${config.with.join(',')}|${config.without.join(',')}|${predKeys.join(',')}`;
}
