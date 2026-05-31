/**
 * gameStore.js — 全局游戏状态管理
 * 发布订阅模式，管理用户信息、金币、能量、棋盘等全局状态
 */
const storage = require('../utils/storage');
const EnergyManager = require('../engine/EnergyManager');

class GameStore {
  constructor() {
    this._state = {
      // 用户信息
      user: {
        uid: null,
        nickName: '',
        avatarUrl: '',
        isGuest: true
      },
      // 游戏资源
      gold: 100,
      rating: 3.0,
      restaurantLevel: 1,

      // 棋盘数据（由 Board 实例管理，此处缓存序列化数据）
      board: {
        cells: [],
        rows: 6,
        cols: 5,
        version: 0,
        idc: 0
      },

      // 能量管理器
      energy: 100,

      // 已解锁的菜谱 ID 列表
      unlockedRecipes: [],

      // 订单数据
      orders: [],

      // 道具
      items: {},

      // 社交
      inspiration: 0,

      // 标记
      isNewUser: false,
      tutorialCompleted: false,
      lastSyncAt: null
    };

    this._listeners = {};
    this._energyManager = null;
  }

  /**
   * 获取单个状态值
   */
  get(key) {
    return this._state[key];
  }

  /**
   * 设置单个状态值，并通知订阅者
   */
  set(key, value) {
    const old = this._state[key];
    this._state[key] = value;
    if (old !== value) {
      this._notify(key, value, old);
    }
  }

  /**
   * 获取完整状态快照
   */
  getState() {
    return { ...this._state };
  }

  /**
   * 更新用户信息
   */
  updateUser(userData) {
    if (!userData) return;
    this._state.user = {
      ...this._state.user,
      ...userData,
      isGuest: false
    };
    this._notify('user', this._state.user);
    // 持久化
    this._saveToStorage();
  }

  /**
   * 设为游客模式
   */
  setGuestMode() {
    this._state.user.isGuest = true;
    this._state.user.nickName = '小厨神' + Math.floor(Math.random() * 1000);
  }

  /**
   * 更新棋盘数据
   */
  updateBoard(boardData) {
    if (!boardData) return;
    this._state.board = {
      ...this._state.board,
      ...boardData
    };
    this._notify('board', this._state.board);
  }

  /**
   * 增加金币
   */
  addGold(amount) {
    this._state.gold += amount;
    this._notify('gold', this._state.gold);
  }

  /**
   * 消耗金币
   */
  spendGold(amount) {
    if (this._state.gold < amount) return false;
    this._state.gold -= amount;
    this._notify('gold', this._state.gold);
    return true;
  }

  /**
   * 更新好评度
   */
  updateRating(delta) {
    this._state.rating = Math.max(1.0, Math.min(5.0,
      Math.round((this._state.rating + delta) * 10) / 10
    ));
    this._notify('rating', this._state.rating);
  }

  /**
   * 解锁菜谱
   */
  unlockRecipe(recipeId) {
    if (!this._state.unlockedRecipes.includes(recipeId)) {
      this._state.unlockedRecipes.push(recipeId);
      this._notify('unlockedRecipes', this._state.unlockedRecipes);
    }
  }

  /**
   * 批量解锁菜谱
   */
  unlockRecipes(recipeIds) {
    let changed = false;
    for (const id of recipeIds) {
      if (!this._state.unlockedRecipes.includes(id)) {
        this._state.unlockedRecipes.push(id);
        changed = true;
      }
    }
    if (changed) {
      this._notify('unlockedRecipes', this._state.unlockedRecipes);
    }
  }

  /**
   * 初始化能量管理器
   */
  initEnergy(energyValue, lastTs) {
    if (!this._energyManager) {
      this._energyManager = new EnergyManager();
    }
    this._energyManager.init(energyValue, lastTs);
    this._state.energy = this._energyManager.getCurrent();
  }

  /**
   * 获取能量管理器
   */
  getEnergyManager() {
    return this._energyManager;
  }

  /**
   * 刷新能量（从后台恢复时调用）
   */
  refreshEnergy() {
    if (this._energyManager) {
      this._state.energy = this._energyManager.getCurrent();
      this._notify('energy', this._state.energy);
    }
  }

  /**
   * 消耗能量
   */
  consumeEnergy(amount) {
    if (this._energyManager) {
      const ok = this._energyManager.consume(amount || 1);
      if (ok) {
        this._state.energy = this._energyManager.getCurrent();
        this._notify('energy', this._state.energy);
      }
      return ok;
    }
    // 无能量管理器时的简单处理
    if (this._state.energy >= (amount || 1)) {
      this._state.energy -= (amount || 1);
      this._notify('energy', this._state.energy);
      return true;
    }
    return false;
  }

  /**
   * 从存档加载状态
   */
  loadState(savedState) {
    if (!savedState) return;
    if (savedState.user) {
      this._state.user = { ...this._state.user, ...savedState.user };
    }
    if (savedState.gold !== undefined) this._state.gold = savedState.gold;
    if (savedState.rating !== undefined) this._state.rating = savedState.rating;
    if (savedState.restaurantLevel !== undefined) this._state.restaurantLevel = savedState.restaurantLevel;
    if (savedState.board) this._state.board = savedState.board;
    if (savedState.unlockedRecipes) this._state.unlockedRecipes = savedState.unlockedRecipes;
    if (savedState.items) this._state.items = savedState.items;
    if (savedState.inspiration !== undefined) this._state.inspiration = savedState.inspiration;
    if (savedState.isNewUser !== undefined) this._state.isNewUser = savedState.isNewUser;
    if (savedState.tutorialCompleted !== undefined) this._state.tutorialCompleted = savedState.tutorialCompleted;

    // 初始化能量（支持从 EnergyManager 格式恢复）
    if (savedState.energyData) {
      this.initEnergy(savedState.energyData.energy, savedState.energyData.lastTs);
    } else if (savedState.energy !== undefined) {
      this.initEnergy(savedState.energy, Date.now());
    }
  }

  /**
   * 订阅状态变化
   * @param {string} key - 状态键
   * @param {function} fn - 回调函数 (newVal, oldVal)
   */
  on(key, fn) {
    if (!this._listeners[key]) {
      this._listeners[key] = [];
    }
    this._listeners[key].push(fn);

    // 返回取消订阅函数
    return () => {
      this._listeners[key] = (this._listeners[key] || []).filter(f => f !== fn);
    };
  }

  /**
   * 取消所有订阅
   */
  offAll() {
    this._listeners = {};
  }

  /**
   * 通知订阅者
   */
  _notify(key, newVal, oldVal) {
    const fns = this._listeners[key] || [];
    for (const fn of fns) {
      try {
        fn(newVal, oldVal);
      } catch (e) {
        console.error('[GameStore] 通知订阅者出错', key, e);
      }
    }
  }

  /**
   * 保存到本地存储
   */
  _saveToStorage() {
    try {
      const data = {
        user: this._state.user,
        gold: this._state.gold,
        rating: this._state.rating,
        restaurantLevel: this._state.restaurantLevel,
        board: this._state.board,
        unlockedRecipes: this._state.unlockedRecipes,
        items: this._state.items,
        inspiration: this._state.inspiration,
        isNewUser: this._state.isNewUser,
        tutorialCompleted: this._state.tutorialCompleted,
        energyData: this._energyManager ? this._energyManager.toJSON() : null
      };
      storage.save('game_state', data);
    } catch (e) {
      console.warn('[GameStore] 保存失败', e);
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this._saveToStorage();
    this.offAll();
    if (this._energyManager) {
      this._energyManager.destroy();
    }
  }
}

module.exports = GameStore;
