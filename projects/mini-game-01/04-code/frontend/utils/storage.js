/**
 * storage.js — 本地存储封装
 * wx.getStorageSync/setStorageSync + JSON 序列化 + 异常降级
 * 存储预算：棋盘 ~2KB、用户 ~1KB、配置 ~50KB、广告 ~100KB → 总计 < 200KB
 */

/** 存储键前缀，避免与其他小程序数据冲突 */
const PREFIX = 'chef_';

/** 已知的存储键 */
const STORAGE_KEYS = {
  BOARD: 'board_v1',
  USER: 'user_v1',
  CONFIG: 'config_v1',
  LAST_SYNC: 'last_sync',
  TUTORIAL_DONE: 'tutorial_done',
  GAME_STATE: 'game_state',
  TOKEN: 'token'
};

const storage = {
  KEYS: STORAGE_KEYS,

  /**
   * get 是 load 的别名（业界习惯命名）
   */
  get(key, defaultValue) {
    return this.load(key, defaultValue);
  },

  /**
   * set 是 save 的别名
   */
  set(key, value) {
    this.save(key, value);
  },

  /**
   * 保存数据
   * @param {string} key - 键名
   * @param {any} value - 值（会被 JSON.stringify）
   */
  save(key, value) {
    try {
      const data = JSON.stringify(value);
      wx.setStorageSync(PREFIX + key, data);
    } catch (e) {
      console.warn('[Storage] 保存失败:', key, e.message);
      // 存储空间不足时尝试清理旧数据
      if (e.errMsg && e.errMsg.includes('limit')) {
        this._cleanup();
        try {
          wx.setStorageSync(PREFIX + key, JSON.stringify(value));
        } catch (e2) {
          console.error('[Storage] 清理后仍保存失败:', key, e2);
        }
      }
    }
  },

  /**
   * 读取数据
   * @param {string} key
   * @param {any} defaultValue - 默认值
   * @returns {any}
   */
  load(key, defaultValue) {
    try {
      const raw = wx.getStorageSync(PREFIX + key);
      if (!raw) return defaultValue !== undefined ? defaultValue : null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[Storage] 读取失败:', key, e.message);
      // 数据损坏，清除之
      this.remove(key);
      return defaultValue !== undefined ? defaultValue : null;
    }
  },

  /**
   * 获取原始字符串（不解析 JSON）
   */
  getRaw(key) {
    try {
      return wx.getStorageSync(PREFIX + key);
    } catch (e) {
      return null;
    }
  },

  /**
   * 保存原始字符串
   */
  setRaw(key, value) {
    try {
      wx.setStorageSync(PREFIX + key, value);
    } catch (e) {
      console.warn('[Storage] setRaw 失败:', key, e.message);
    }
  },

  /**
   * 获取存储信息（使用情况）
   */
  getInfo() {
    try {
      return wx.getStorageInfoSync();
    } catch (e) {
      return { currentSize: 0, limitSize: 10240, keys: [] };
    }
  },

  /**
   * 删除指定键
   */
  remove(key) {
    try {
      wx.removeStorageSync(PREFIX + key);
    } catch (e) {
      console.warn('[Storage] 删除失败:', key, e.message);
    }
  },

  /**
   * 清除所有本游戏的数据
   */
  clearAll() {
    try {
      const info = wx.getStorageInfoSync();
      for (const key of info.keys) {
        if (key.startsWith(PREFIX)) {
          wx.removeStorageSync(key);
        }
      }
    } catch (e) {
      console.warn('[Storage] 清除失败', e);
    }
  },

  /**
   * 获取缓存大小（KB）
   */
  getCacheSize() {
    try {
      const info = wx.getStorageInfoSync();
      let size = 0;
      for (const key of info.keys) {
        if (key.startsWith(PREFIX)) {
          size += (wx.getStorageSync(key) || '').length;
        }
      }
      return Math.ceil(size / 1024);
    } catch (e) {
      return 0;
    }
  },

  /**
   * 清理旧版本数据（保留最新的）
   */
  _cleanup() {
    // 保留核心数据，清理其他
    const keepKeys = [STORAGE_KEYS.GAME_STATE, STORAGE_KEYS.TOKEN, STORAGE_KEYS.CONFIG];
    try {
      const info = wx.getStorageInfoSync();
      for (const key of info.keys) {
        if (key.startsWith(PREFIX) && !keepKeys.some(k => key === PREFIX + k)) {
          wx.removeStorageSync(key);
        }
      }
    } catch (e) {
      // ignore
    }
  }
};

module.exports = storage;
