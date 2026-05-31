/**
 * settings.js — 设置页
 */
const storage = require('../../utils/storage');
const i18n = require('../../utils/i18n');

Page({
  data: {
    soundOn: true,
    vibrationOn: true,
    cacheSize: 0
  },

  onLoad() {
    this._loadSettings();
  },

  _loadSettings() {
    const soundOn = storage.load('sound_on', true);
    const vibrationOn = storage.load('vibration_on', true);
    const cacheSize = storage.getCacheSize();

    this.setData({
      soundOn: soundOn,
      vibrationOn: vibrationOn,
      cacheSize: cacheSize
    });
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
  },

  /**
   * 清除缓存
   */
  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定清除缓存吗？本地数据不会丢失。',
      success: (res) => {
        if (res.confirm) {
          storage.clearAll();
          this.setData({ cacheSize: 0 });
          wx.showToast({ title: '缓存已清除', icon: 'success' });
        }
      }
    });
  },

  /**
   * 意见反馈
   */
  onFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '请通过客服渠道反馈您的意见和建议，我们会认真倾听！',
      showCancel: false,
      confirmText: '好的'
    });
  },

  onBack() {
    wx.navigateBack();
  }
});
