/**
 * inventory.js — 道具背包（2列网格布局）
 * 数据来源：config/items.json + gameStore
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
      title: i18n.t('inventory.confirm_use', { name: item.name }),
      content: item.description,
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
      wx.showToast({ title: i18n.t('inventory.no_items'), icon: 'none' });
      return;
    }

    // 减少数量
    ownedItems[item.id]--;
    app.gameStore.set('items', { ...ownedItems });

    // 应用效果
    switch (item.effect.type) {
      case 'speed_boost':
        wx.showToast({ title: i18n.t('inventory.effect_speed_boost'), icon: 'success' });
        break;
      case 'instant_generate':
        wx.showToast({ title: i18n.t('inventory.effect_generate', { count: item.effect.count }), icon: 'success' });
        break;
      case 'time_freeze':
        wx.showToast({ title: i18n.t('inventory.effect_time_freeze'), icon: 'success' });
        break;
      case 'gold_boost':
        wx.showToast({ title: i18n.t('inventory.effect_gold_boost'), icon: 'success' });
        break;
      case 'double_luck':
        wx.showToast({ title: i18n.t('inventory.effect_double_luck'), icon: 'success' });
        break;
      default:
        wx.showToast({ title: i18n.t('inventory.use_success'), icon: 'success' });
    }

    console.log('[Inventory] 使用道具:', item.id);
    this._loadItems();
  },

  onBack() {
    wx.navigateBack();
  }
});
