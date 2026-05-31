/**
 * EnergyManager.js — 能量管理
 * 本地能量计数、自动恢复计时（1点/3分钟）、服务端校验同步
 */
class EnergyManager {
  constructor() {
    this.maxEnergy = 100;
    this.currentEnergy = 100;
    this.lastRecoveryTime = Date.now(); // 上次恢复计算的时间戳（ms）
    this._timerId = null;
    this._recoveryInterval = 3 * 60 * 1000; // 3 分钟 = 180000ms
    this._tickInterval = 1000; // 每秒检查一次
    this.dailyAdWatchCount = 0;  // 今日看广告恢复次数
    this.maxDailyAdWatch = 10;   // 每日看广告上限
  }

  /**
   * 初始化
   * @param {number} energy - 当前能量
   * @param {number} lastTs - 上次能量变更时间戳
   */
  init(energy, lastTs) {
    this.currentEnergy = typeof energy === 'number' ? energy : 100;
    this.lastRecoveryTime = typeof lastTs === 'number' ? lastTs : Date.now();
    // 计算离线期间恢复的能量
    this._applyOfflineRecovery();
    this._startAutoRecovery();
  }

  /**
   * 应用离线期间的能量恢复
   */
  _applyOfflineRecovery() {
    const now = Date.now();
    const elapsed = now - this.lastRecoveryTime;
    const recovered = Math.floor(elapsed / this._recoveryInterval);
    if (recovered > 0 && this.currentEnergy < this.maxEnergy) {
      this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + recovered);
      this.lastRecoveryTime = now;
      console.log('[EnergyManager] 离线恢复', recovered, '点能量，当前:', this.currentEnergy);
    }
  }

  /**
   * 启动自动恢复计时
   */
  _startAutoRecovery() {
    this._stopAutoRecovery();
    this._timerId = setInterval(() => {
      if (this.currentEnergy >= this.maxEnergy) return;
      const now = Date.now();
      const elapsed = now - this.lastRecoveryTime;
      if (elapsed >= this._recoveryInterval) {
        const recovered = Math.floor(elapsed / this._recoveryInterval);
        this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + recovered);
        this.lastRecoveryTime = now;
        console.log('[EnergyManager] 自动恢复', recovered, '点，当前:', this.currentEnergy);
      }
    }, this._tickInterval);
  }

  _stopAutoRecovery() {
    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  }

  /**
   * 消耗能量
   * @param {number} amount
   * @returns {boolean} 是否消耗成功
   */
  consume(amount) {
    if (this.currentEnergy < amount) return false;
    this.currentEnergy -= amount;
    if (this.currentEnergy === this.maxEnergy - 1) {
      this.lastRecoveryTime = Date.now();
    }
    return true;
  }

  /**
   * 恢复能量（看广告、好友赠送）
   * @param {number} amount
   */
  recover(amount) {
    this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + amount);
    // 满能量时重置计时器
    if (this.currentEnergy >= this.maxEnergy) {
      this.lastRecoveryTime = Date.now();
    }
  }

  /**
   * 获取当前能量
   */
  getCurrent() {
    return this.currentEnergy;
  }

  /**
   * 是否可消耗
   */
  canConsume(amount) {
    return this.currentEnergy >= (amount || 1);
  }

  /**
   * 获取恢复到满能量所需的剩余时间（秒）
   */
  getTimeToFull() {
    if (this.currentEnergy >= this.maxEnergy) return 0;
    const needed = this.maxEnergy - this.currentEnergy;
    const now = Date.now();
    const elapsedSinceLast = now - this.lastRecoveryTime;
    const nextRecoveryIn = this._recoveryInterval - (elapsedSinceLast % this._recoveryInterval);
    // 下一个恢复点 + 还需要多少轮
    const total = nextRecoveryIn + (needed - 1) * this._recoveryInterval;
    return Math.ceil(total / 1000);
  }

  /**
   * 获取下次恢复的倒计时（秒）
   */
  getNextRecoveryCountdown() {
    if (this.currentEnergy >= this.maxEnergy) return 0;
    const now = Date.now();
    const elapsed = now - this.lastRecoveryTime;
    const remaining = this._recoveryInterval - (elapsed % this._recoveryInterval);
    return Math.ceil(remaining / 1000);
  }

  /**
   * 检查今日看广告恢复是否达上限
   */
  canWatchAdForEnergy() {
    return this.dailyAdWatchCount < this.maxDailyAdWatch;
  }

  /**
   * 看广告恢复能量
   */
  watchAdForEnergy() {
    if (!this.canWatchAdForEnergy()) return false;
    this.dailyAdWatchCount++;
    this.recover(30);
    return true;
  }

  /**
   * 序列化
   */
  toJSON() {
    return {
      energy: this.currentEnergy,
      lastTs: this.lastRecoveryTime,
      dailyAdCount: this.dailyAdWatchCount
    };
  }

  /**
   * 销毁（清除定时器）
   */
  destroy() {
    this._stopAutoRecovery();
  }
}

module.exports = EnergyManager;
