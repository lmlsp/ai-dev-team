/**
 * inventory.js — 背包/道具
 */
const items = require('../../config/items.json');
const i18n = require('../../utils/i18n');

Page({
  data: {
    items: [],
    empty: true
  },

  onLoad() {
    this._loadItems();
  },

  onShow() {
    this._loadItems();
  },

  _loadItems() {
    const app = getApp();
    const ownedItems = app.gameStore ? (app.gameStore.get('items') || {}) : {};

    const displayItems = items.map(item => ({
      ...item,
      count: ownedItems[item.id] || 0
    })).filter(item => item.count > 0);

    this.setData({
      items: displayItems,
      empty: displayItems.length === 0
    });
  },

  /**
   * 使用道具
   */
  onUseItem(e) {
    const itemId = e.currentTarget.dataset.id;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    wx.showModal({
      title: '使用道具',
      content: `确定使用 ${item.name} 吗？\n${item.description}`,
      success: (res) => {
        if (res.confirm) {
          this._applyItem(item);
        }
      }
    });
  },

  _applyItem(item) {
    const app = getApp();
    const ownedItems = app.gameStore ? (app.gameStore.get('items') || {}) : {};
    const count = ownedItems[item.id] || 0;

    if (count <= 0) {
      wx.showToast({ title: '道具数量不足', icon: 'none' });
      return;
    }

    // 减少数量
    ownedItems[item.id]--;
    app.gameStore.set('items', { ...ownedItems });

    // 应用效果
    switch (item.effect.type) {
      case 'speed_boost':
        wx.showToast({ title: '食材生成速度翻倍！持续30分钟', icon: 'success' });
        break;
      case 'instant_generate':
        wx.showToast({ title: `生成了 ${item.effect.count} 个食材！`, icon: 'success' });
        break;
      case 'time_freeze':
        wx.showToast({ title: '顾客等待时间冻结30秒！', icon: 'success' });
        break;
      case 'gold_boost':
        wx.showToast({ title: '金币获取增加50%！持续10分钟', icon: 'success' });
        break;
      case 'double_luck':
        wx.showToast({ title: '幸运加倍已激活！', icon: 'success' });
        break;
      default:
        wx.showToast({ title: '道具已使用', icon: 'success' });
    }

    console.log('[Inventory] 使用道具:', item.id);
    this._loadItems();
  },

  onBack() {
    wx.navigateBack();
  }
});
