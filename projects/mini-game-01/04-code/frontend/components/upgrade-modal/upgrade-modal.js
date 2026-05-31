/**
 * upgrade-modal — 升级弹窗组件
 */
const levels = require('../../config/restaurant-levels.json');

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    currentLevel: {
      type: Number,
      value: 1
    },
    nextLevel: {
      type: Number,
      value: 2
    }
  },

  data: {
    nextInfo: null,
    canUpgrade: false,
    gold: 0,
    rating: 0
  },

  observers: {
    'visible, nextLevel'(visible, nextLevel) {
      if (visible && nextLevel) {
        const nextInfo = levels.find(l => l.level === nextLevel);
        const app = getApp();
        const state = app.gameStore ? app.gameStore.getState() : {};
        const gold = state.gold || 0;
        const rating = state.rating || 0;

        this.setData({
          nextInfo: nextInfo || null,
          gold: gold,
          rating: rating,
          canUpgrade: nextInfo
            ? gold >= nextInfo.goldCost && rating >= nextInfo.minRating
            : false
        });
      }
    }
  },

  methods: {
    onConfirm() {
      this.triggerEvent('confirm', { level: this.properties.nextLevel });
    },
    onCancel() {
      this.triggerEvent('cancel');
    }
  }
});
