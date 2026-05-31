/**
 * sync.js — 数据同步服务
 * 棋盘数据 30 秒增量同步、关键操作即时同步、网络恢复后批量同步
 * 本地乐观更新 + 服务端校正
 */
const api = require('./api');
const storage = require('../utils/storage');

const SYNC_INTERVAL = 30000; // 30 秒批量同步
const CRITICAL_OPS = ['merge', 'serve', 'sell', 'upgrade']; // 即时同步的操作

class SyncService {
  constructor(gameStore) {
    this.gameStore = gameStore;
    this._pendingOps = [];       // 待同步的操作队列
    this._syncTimer = null;
    this._isSyncing = false;
    this._isOnline = true;
    this._dirtyOps = [];        // 离线期间累积的操作

    this._bindNetworkEvents();
  }

  /**
   * 启动定时同步
   */
  start() {
    this._syncTimer = setInterval(() => {
      this._batchSync();
    }, SYNC_INTERVAL);
    console.log('[Sync] 定时同步已启动，间隔', SYNC_INTERVAL / 1000, '秒');
  }

  /**
   * 停止定时同步
   */
  stop() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  }

  /**
   * 记录操作并决定同步策略
   * @param {string} op - 操作类型
   * @param {object} data - 操作数据
   */
  recordOperation(op, data) {
    const operation = {
      op: op,
      timestamp: Date.now(),
      ...data
    };
    this._pendingOps.push(operation);

    // 关键操作即时同步
    if (CRITICAL_OPS.includes(op) && this._isOnline) {
      this._instantSync(operation);
    }
  }

  /**
   * 即时同步（关键操作）
   */
  async _instantSync(operation) {
    try {
      const state = this.gameStore.getState();
      const result = await api.syncBoard(
        state.board.version || 0,
        [operation],
        state.gold,
        state.energy,
        state.rating
      );

      if (result && result.accepted) {
        // 从 pending 中移除已同步的操作
        this._pendingOps = this._pendingOps.filter(
          op => op.timestamp !== operation.timestamp
        );
        this.gameStore.set('board.version', result.newVersion || 0);

        // 服务端校正
        if (result.serverGold !== undefined) {
          this.gameStore.set('gold', result.serverGold);
        }
        if (result.serverEnergy !== undefined) {
          this.gameStore.set('energy', result.serverEnergy);
        }
        if (result.serverRating !== undefined) {
          this.gameStore.set('rating', result.serverRating);
        }
      }
    } catch (err) {
      console.warn('[Sync] 即时同步失败，加入待同步队列', err.message);
      // 标记为脏数据，下次批量同步时重试
      operation._dirty = true;
      this._dirtyOps.push(operation);
    }
  }

  /**
   * 批量同步（30 秒定时触发）
   */
  async _batchSync() {
    if (this._isSyncing) return;
    if (this._pendingOps.length === 0 && this._dirtyOps.length === 0) return;

    this._isSyncing = true;
    try {
      const allOps = [...this._dirtyOps, ...this._pendingOps];
      if (allOps.length === 0) { this._isSyncing = false; return; }

      const state = this.gameStore.getState();
      const result = await api.syncBoard(
        state.board.version || 0,
        allOps,
        state.gold,
        state.energy,
        state.rating
      );

      if (result && result.accepted) {
        this._pendingOps = [];
        this._dirtyOps = [];
        this.gameStore.set('board.version', result.newVersion || 0);

        if (result.serverGold !== undefined) {
          this.gameStore.set('gold', result.serverGold);
        }
        if (result.serverEnergy !== undefined) {
          this.gameStore.set('energy', result.serverEnergy);
        }
        if (result.serverRating !== undefined) {
          this.gameStore.set('rating', result.serverRating);
        }

        console.log('[Sync] 批量同步成功，版本:', result.newVersion);
      } else if (result && result.code === 10001) {
        // 版本冲突，以服务端为准
        console.warn('[Sync] 版本冲突，以服务端为准');
        if (result.data && result.data.serverBoard) {
          this.gameStore.set('board', result.data.serverBoard);
          this._pendingOps = [];
          this._dirtyOps = [];
        }
      }
    } catch (err) {
      console.warn('[Sync] 批量同步失败', err.message);
      // 保存到本地，下次重试
      if (this._pendingOps.length > 0) {
        this._dirtyOps.push(...this._pendingOps);
        this._pendingOps = [];
      }
    } finally {
      this._isSyncing = false;
    }
  }

  /**
   * 网络恢复后的全量同步
   */
  async syncAfterReconnect() {
    console.log('[Sync] 网络恢复，执行全量同步');
    try {
      // 先拉取服务端最新状态
      const serverBoard = await api.getBoard();
      if (serverBoard) {
        this.gameStore.set('board', serverBoard);
        this._pendingOps = [];
        this._dirtyOps = [];
        console.log('[Sync] 全量同步完成');
      }
    } catch (err) {
      console.warn('[Sync] 全量同步失败', err.message);
    }
  }

  /**
   * 绑定网络状态事件
   */
  _bindNetworkEvents() {
    wx.onNetworkStatusChange((res) => {
      const wasOffline = !this._isOnline;
      this._isOnline = res.isConnected;
      if (wasOffline && res.isConnected) {
        // 网络恢复
        this.syncAfterReconnect();
      }
    });

    // 初始化网络状态
    wx.getNetworkType({
      success: (res) => {
        this._isOnline = res.networkType !== 'none';
      }
    });
  }

  /**
   * 销毁
   */
  destroy() {
    this.stop();
  }
}

module.exports = SyncService;
