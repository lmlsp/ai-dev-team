/**
 * settings.js — 设置页面
 * 包含：音效/震动/通知开关、清除缓存、意见反馈、隐私政策、用户协议、退出登录、版本号
 */
const storage = require('../../utils/storage');
const i18n = require('../../utils/i18n');

Page({
  data: {
    soundOn: true,
    vibrationOn: true,
    notificationOn: true,
    cacheSize: 0,
    version: '1.0.0'
  },

  onLoad() {
    this._loadSettings();
  },

  onShow() {
    // 每次显示时刷新缓存大小
    this._refreshCacheSize();
  },

  _loadSettings() {
    const soundOn = storage.load('sound_on', true);
    const vibrationOn = storage.load('vibration_on', true);
    const notificationOn = storage.load('notification_on', true);

    this.setData({
      soundOn,
      vibrationOn,
      notificationOn
    });
    this._refreshCacheSize();
  },

  _refreshCacheSize() {
    const cacheSize = storage.getCacheSize();
    this.setData({ cacheSize });
  },

  /**
   * 音效开关
   */
  onToggleSound(e) {
    const value = e.detail.value;
    this.setData({ soundOn: value });
    storage.save('sound_on', value);
  },

  /**
   * 震动开关
   */
  onToggleVibration(e) {
    const value = e.detail.value;
    this.setData({ vibrationOn: value });
    storage.save('vibration_on', value);

    // 开启时测试震动
    if (value) {
      wx.vibrateShort({ type: 'medium' }).catch(() => {});
    }
  },

  /**
   * 活动通知开关
   */
  onToggleNotification(e) {
    const value = e.detail.value;
    this.setData({ notificationOn: value });
    storage.save('notification_on', value);

    if (value) {
      // 请求订阅消息权限（微信小程序）
      wx.requestSubscribeMessage({
        tmplIds: [],
        fail: () => {}
      });
    }
  },

  /**
   * 清除缓存
   */
  onClearCache() {
    wx.showModal({
      title: i18n.t('settings.clear_cache'),
      content: i18n.t('settings.clear_cache_confirm'),
      success: (res) => {
        if (res.confirm) {
          storage.clearAll();
          this.setData({ cacheSize: 0 });
          wx.showToast({ title: i18n.t('settings.cleared'), icon: 'success' });
        }
      }
    });
  },

  /**
   * 意见反馈
   */
  onFeedback() {
    // 尝试打开反馈页面，降级为弹窗
    if (wx.openFeedback) {
      wx.openFeedback({
        fail: () => {
          this._feedbackFallback();
        }
      });
    } else {
      this._feedbackFallback();
    }
  },

  _feedbackFallback() {
    wx.showModal({
      title: i18n.t('settings.feedback'),
      content: '请通过客服邮箱 feedback@hehechef.com 反馈您的意见和建议',
      showCancel: false,
      confirmText: i18n.t('common.ok')
    });
  },

  /**
   * 隐私政策
   */
  onPrivacyPolicy() {
    wx.showModal({
      title: i18n.t('settings.privacy_policy'),
      content: '合合小厨神尊重并保护您的隐私。我们仅收集必要的游戏数据以改善体验，不会将您的个人信息用于其他用途。详细政策请访问官网。',
      showCancel: false,
      confirmText: i18n.t('common.ok')
    });
  },

  /**
   * 用户协议
   */
  onUserAgreement() {
    wx.showModal({
      title: i18n.t('settings.user_agreement'),
      content: '使用合合小厨神即表示您同意以下条款：1. 本游戏仅供娱乐；2. 禁止使用外挂或恶意刷分行为；3. 我们保留更新协议的权利。',
      showCancel: false,
      confirmText: i18n.t('common.ok')
    });
  },

  /**
   * 退出登录
   */
  onLogout() {
    wx.showModal({
      title: i18n.t('common.confirm'),
      content: i18n.t('settings.logout_confirm'),
      success: (res) => {
        if (res.confirm) {
          storage.remove('token');
          storage.remove('user_v1');
          wx.reLaunch({
            url: '/pages/loading/loading'
          });
        }
      }
    });
  },

  onBack() {
    wx.navigateBack();
  }
});
