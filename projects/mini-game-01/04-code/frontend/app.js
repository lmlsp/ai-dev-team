/**
 * 合合小厨神 — 小程序入口
 * 职责：微信登录、全局数据初始化、游戏状态管理
 */
const GameStore = require('./store/gameStore');
const auth = require('./services/auth');
const storage = require('./utils/storage');
const i18n = require('./utils/i18n');

App({
  onLaunch(options) {
    console.log('[App] 小程序启动', options);

    // 初始化全局游戏状态
    this.gameStore = new GameStore();

    // 加载本地缓存数据
    this._loadLocalCache();

    // 静默登录
    this._silentLogin();

    // 监听切后台/前台（能量恢复计时）
    this._bindLifecycle();
  },

  onShow(options) {
    console.log('[App] 小程序显示', options.scene);
    // 从后台恢复时，通知 gameStore 刷新能量
    if (this.gameStore) {
      this.gameStore.refreshEnergy();
    }
  },

  onHide() {
    console.log('[App] 小程序隐藏');
    // 保存当前状态到本地
    if (this.gameStore) {
      const state = this.gameStore.getState();
      storage.save('game_state', state);
    }
  },

  onError(err) {
    console.error('[App] 全局错误', err);
  },

  // ========== 私有方法 ==========

  /**
   * 加载本地缓存数据到 gameStore
   */
  _loadLocalCache() {
    try {
      const cached = storage.load('game_state');
      if (cached && cached.user) {
        this.gameStore.loadState(cached);
        console.log('[App] 本地缓存加载成功');
      }
    } catch (e) {
      console.warn('[App] 本地缓存加载失败，使用默认状态', e);
    }
  },

  /**
   * 静默微信登录
   */
  async _silentLogin() {
    try {
      const userData = await auth.login();
      if (userData) {
        this.gameStore.updateUser(userData.user);
        this.gameStore.set('isNewUser', userData.user.isNewUser);
        console.log('[App] 登录成功', userData.user.uid);
      }
    } catch (err) {
      console.warn('[App] 登录失败，使用游客模式', err);
      this.gameStore.setGuestMode();
    }
  },

  /**
   * 绑定前后台切换生命周期
   */
  _bindLifecycle() {
    const self = this;
    wx.onAppShow(() => {
      if (self.gameStore) {
        self.gameStore.refreshEnergy();
      }
    });
  }
});
