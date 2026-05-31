/**
 * upgrade.js — 餐厅升级页
 */
const levels = require('../../config/restaurant-levels.json');
const i18n = require('../../utils/i18n');

Page({
  data: {
    currentLevel: 1,
    currentName: '',
    currentDesc: '',
    nextLevel: null,
    canUpgrade: false,
    gold: 0,
    rating: 3.0,
    upgrading: false
  },

  onLoad() {
    this._refresh();
  },

  onShow() {
    this._refresh();
  },

  _refresh() {
    const app = getApp();
    const state = app.gameStore ? app.gameStore.getState() : {};
    const currentLevel = state.restaurantLevel || 1;
    const gold = state.gold || 0;
    const rating = state.rating || 3.0;

    const currentInfo = levels.find(l => l.level === currentLevel) || levels[0];
    const nextInfo = levels.find(l => l.level === currentLevel + 1) || null;

    const canUpgrade = nextInfo
      ? gold >= nextInfo.goldCost && rating >= nextInfo.minRating
      : false;

    this.setData({
      currentLevel: currentLevel,
      currentName: currentInfo.name,
      currentDesc: currentInfo.description,
      nextLevel: nextInfo,
      canUpgrade: canUpgrade,
      gold: gold,
      rating: rating
    });
  },

  /**
   * 执行升级
   */
  onUpgrade() {
    if (!this.data.canUpgrade || !this.data.nextLevel) return;
    if (this.data.upgrading) return;

    const next = this.data.nextLevel;
    const app = getApp();

    // 校验
    if (!app.gameStore.spendGold(next.goldCost)) {
      wx.showToast({ title: '金币不足', icon: 'none' });
      return;
    }

    this.setData({ upgrading: true });

    // 执行升级
    app.gameStore.set('restaurantLevel', next.level);
    app.gameStore.unlockRecipes(next.unlockRecipeIds || []);

    // 动画延迟
    setTimeout(() => {
      this.setData({ upgrading: false });
      this._refresh();

      // 升级成功弹窗
      wx.showModal({
        title: '🎉 恭喜升级！',
        content: `你的餐厅升级为【${next.name}】！\n${next.description}\n\n解锁内容：${(next.unlockCuisines || []).join('、')}`,
        showCancel: false,
        confirmText: '太好了！',
        success: () => {
          // 回首页
          wx.navigateBack();
        }
      });

      // 尝试同步到服务端
      try {
        const api = require('../../services/api');
        api.upgradeRestaurant().catch(() => {});
      } catch (e) { /* ignore */ }

      console.log('[Upgrade] 升级成功:', next.name);
    }, 800);
  },

  onBack() {
    wx.navigateBack();
  }
});
