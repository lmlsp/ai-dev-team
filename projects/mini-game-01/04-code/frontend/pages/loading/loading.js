/**
 * loading.js — 加载页
 * 资源预加载、版本检查、静默登录、超时处理
 */
const i18n = require('../../utils/i18n');
const auth = require('../../services/auth');
const api = require('../../services/api');

const LOADING_TIMEOUT = 10000;   // 10 秒超时
const LOADING_HARD_TIMEOUT = 30000; // 30 秒硬超时

Page({
  data: {
    progress: 0,
    tip: '',
    loadingText: '',
    showRetry: false,
    showOffline: false,
    errorMessage: ''
  },

  _startTime: 0,
  _timeoutTimer: null,
  _hardTimeoutTimer: null,
  _finished: false,
  _tips: [],

  onLoad() {
    this._startTime = Date.now();
    this._tips = i18n.t('loading.tips', undefined) || ['加载中...'];
    // 如果是数组（JSON格式），直接使用；否则按逗号分割
    if (typeof this._tips === 'string') {
      this._tips = [this._tips];
    }

    this._showRandomTip();

    // 加载 i18n 文案
    this.setData({
      i18n: {
        appName: i18n.t('app.name'),
        appSlogan: i18n.t('app.slogan'),
        retry: i18n.t('loading.retry'),
        offlineMode: i18n.t('loading.offline_mode')
      }
    });

    this._startLoading();
  },

  onUnload() {
    this._clearTimers();
  },

  /**
   * 轮播加载提示
   */
  _showRandomTip() {
    const idx = Math.floor(Math.random() * this._tips.length);
    this.setData({ tip: this._tips[idx] || '加载中...' });

    // 每 2 秒切换提示
    this._tipTimer = setInterval(() => {
      const i = Math.floor(Math.random() * this._tips.length);
      this.setData({ tip: this._tips[i] });
    }, 2000);
  },

  /**
   * 主加载流程
   */
  async _startLoading() {
    // 超时保护
    this._timeoutTimer = setTimeout(() => {
      if (!this._finished) this._handleLoadError(new Error('timeout'));
    }, LOADING_TIMEOUT);

    this._hardTimeoutTimer = setTimeout(() => {
      if (!this._finished) {
        this.setData({ showOffline: true });
        this._handleLoadError(new Error('hard_timeout'));
      }
    }, LOADING_HARD_TIMEOUT);

    try {
      // 1. 版本检查
      this._setProgress(10, i18n.t('loading.checking'));
      await this._checkVersion();

      // 2. 加载资源
      this._setProgress(30, i18n.t('loading.loading_resources'));
      await this._loadResources();

      // 3. 登录
      this._setProgress(60, i18n.t('loading.logging_in'));
      await this._doLogin();

      // 4. 进入游戏
      this._setProgress(90, i18n.t('loading.entering'));
      await this._prepareGame();

      this._setProgress(100, '');
      this._enterGame();
    } catch (err) {
      console.error('[Loading] 加载失败', err);
      this._handleLoadError(err);
    }
  },

  /**
   * 版本检查
   */
  async _checkVersion() {
    try {
      // 获取服务端配置版本号，对比本地版本
      const configVersion = wx.getStorageSync('chef_config_version');
      // 简单检查：如果本地有缓存配置，直接通过
      if (configVersion) {
        console.log('[Loading] 配置版本:', configVersion);
      }
    } catch (e) {
      console.warn('[Loading] 版本检查失败', e);
    }
  },

  /**
   * 资源预加载（配置表等）
   */
  async _loadResources() {
    // 预加载配置表
    try {
      require('../../config/recipes.json');
      require('../../config/restaurant-levels.json');
      require('../../config/items.json');
    } catch (e) {
      console.warn('[Loading] 配置加载失败', e);
    }
  },

  /**
   * 执行登录
   */
  async _doLogin() {
    try {
      const result = await auth.login();
      if (result && result.user) {
        const app = getApp();
        if (app.gameStore) {
          app.gameStore.updateUser(result.user);
          if (result.user.isNewUser) {
            app.gameStore.set('isNewUser', true);
          }
        }
      }
    } catch (err) {
      console.warn('[Loading] 登录失败，使用游客模式', err);
      const app = getApp();
      if (app.gameStore) {
        app.gameStore.setGuestMode();
      }
    }
  },

  /**
   * 准备游戏数据
   */
  async _prepareGame() {
    // 初始化能量系统
    const app = getApp();
    if (app.gameStore) {
      const state = app.gameStore.getState();
      app.gameStore.initEnergy(state.energy || 100, Date.now());
    }
  },

  /**
   * 进入游戏
   */
  _enterGame() {
    this._finished = true;
    this._clearTimers();
    wx.redirectTo({
      url: '/pages/home/home'
    });
  },

  /**
   * 设置加载进度
   */
  _setProgress(progress, text) {
    this.setData({
      progress: Math.min(100, progress),
      loadingText: text || ''
    });
  },

  /**
   * 处理加载错误
   */
  _handleLoadError(err) {
    this._clearTimers();

    const elapsed = Date.now() - this._startTime;
    if (elapsed > LOADING_HARD_TIMEOUT) {
      this.setData({
        showRetry: true,
        showOffline: true,
        errorMessage: i18n.t('loading.timeout_message')
      });
    } else {
      this.setData({
        showRetry: true,
        errorMessage: err.message || i18n.t('error.network')
      });
    }
  },

  /**
   * 重试
   */
  onRetry() {
    this.setData({
      showRetry: false,
      showOffline: false,
      progress: 0
    });
    this._startTime = Date.now();
    this._startLoading();
  },

  /**
   * 离线模式进入
   */
  onSkipOffline() {
    this._clearTimers();
    console.log('[Loading] 进入离线模式');
    const app = getApp();
    if (app.gameStore) {
      // 从本地缓存加载状态
      app.gameStore.initEnergy(100, Date.now());
    }
    this._enterGame();
  },

  _clearTimers() {
    if (this._tipTimer) {
      clearInterval(this._tipTimer);
      this._tipTimer = null;
    }
    if (this._timeoutTimer) {
      clearTimeout(this._timeoutTimer);
      this._timeoutTimer = null;
    }
    if (this._hardTimeoutTimer) {
      clearTimeout(this._hardTimeoutTimer);
      this._hardTimeoutTimer = null;
    }
  }
});
