/**
 * cookbook.js — 菜谱图鉴
 * 已解锁/未解锁菜品网格展示
 */
const MergeEngine = require('../../engine/MergeEngine');
const i18n = require('../../utils/i18n');
const recipes = require('../../config/recipes.json');

Page({
  data: {
    recipes: [],
    unlockedCount: 0,
    totalCount: 34,
    selectedRecipe: null,
    showDetail: false,
    filterCuisine: ''
  },

  onLoad() {
    this._loadRecipes();
  },

  onShow() {
    this._loadRecipes();
  },

  _loadRecipes() {
    const app = getApp();
    const unlockedIds = app.gameStore ? app.gameStore.get('unlockedRecipes') : [];

    // 收集所有菜谱（包括合成链的终端和跨品类的结果）
    const displayRecipes = [];
    const seen = new Set();

    for (const r of recipes) {
      // 线性合成链的终端
      if (r.steps) {
        const last = r.steps[r.steps.length - 1];
        if (last && last.isTerminal) {
          const key = last.itemType;
          if (!seen.has(key)) {
            seen.add(key);
            displayRecipes.push({
              chainId: r.chainId,
              name: last.display || r.name,
              itemType: last.itemType,
              cuisine: r.cuisine || '其他',
              emoji: last.emoji || '🍽️',
              story: last.story || '',
              goldValue: r.goldValue || 0,
              unlockLevel: r.unlockLevel || 1,
              unlocked: unlockedIds.includes(r.chainId)
            });
          }
        }
      }
      // 跨品类合成结果
      if (r.result && r.result.isTerminal) {
        const key = r.result.itemType;
        if (!seen.has(key)) {
          seen.add(key);
          displayRecipes.push({
            chainId: r.chainId,
            name: r.result.display || r.name,
            itemType: r.result.itemType,
            cuisine: r.cuisine || '其他',
            emoji: r.result.emoji || '🍽️',
            story: r.result.story || '',
            goldValue: r.goldValue || 0,
            unlockLevel: r.unlockLevel || 1,
            unlocked: unlockedIds.includes(r.chainId)
          });
        }
      }
    }

    const unlockedCount = displayRecipes.filter(r => r.unlocked).length;
    this.setData({
      recipes: displayRecipes,
      unlockedCount: unlockedCount,
      totalCount: displayRecipes.length
    });
  },

  /**
   * 点击菜谱查看详情
   */
  onTapRecipe(e) {
    const idx = e.currentTarget.dataset.index;
    const recipe = this.data.recipes[idx];
    if (!recipe) return;

    if (recipe.unlocked) {
      this.setData({
        selectedRecipe: recipe,
        showDetail: true
      });
    } else {
      // 未解锁显示提示
      wx.showToast({
        title: '继续合成探索吧！',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 关闭详情
   */
  onCloseDetail() {
    this.setData({ showDetail: false, selectedRecipe: null });
  },

  /**
   * 按菜系筛选
   */
  onFilterCuisine(e) {
    const cuisine = e.currentTarget.dataset.cuisine;
    this.setData({ filterCuisine: cuisine || '' });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: i18n.t('cookbook.title') + ' - ' + this.data.unlockedCount + '/' + this.data.totalCount,
      path: '/pages-sub/cookbook/cookbook'
    };
  }
});
