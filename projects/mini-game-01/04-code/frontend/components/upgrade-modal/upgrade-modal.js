/**
 * upgrade-modal — 升级弹窗组件
 * UI 设计 §4.8：蒙层渐变、缩放入场、解锁内容网格
 */
const levels = require('../../config/restaurant-levels.json');
const i18n = require('../../utils/i18n');

/** 等级 → 表情映射 */
const LEVEL_EMOJI = {
  2: '🏠',
  3: '🏪',
  4: '🏛️',
  5: '👑'
};

/**
 * 根据升级信息生成解锁条目
 * @param {object} info - 下一等级配置
 * @returns {Array<{icon:string, label:string}>}
 */
function buildUnlockItems(info) {
  if (!info) return [];
  const items = [];

  // 棋盘扩展
  items.push({
    icon: '📐',
    label: `${info.boardRows}×${info.boardCols} 棋盘`
  });

  // 解锁菜系
  if (info.unlockCuisines && info.unlockCuisines.length > 0) {
    items.push({
      icon: '🍳',
      label: info.unlockCuisines.join('、')
    });
  }

  // 新菜品数量
  if (info.unlockRecipeIds && info.unlockRecipeIds.length > 0) {
    items.push({
      icon: '📜',
      label: `新菜品 +${info.unlockRecipeIds.length}`
    });
  }

  // 装饰位
  if (info.decorationSlots > 0) {
    items.push({
      icon: '🏺',
      label: `装饰位 +${info.decorationSlots}`
    });
  }

  // 最大顾客数
  if (info.customerCount) {
    items.push({
      icon: '👥',
      label: `顾客 +${info.customerCount}`
    });
  }

  return items;
}

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
    rating: 0,
    levelEmoji: '🏠',
    unlockItems: [],
    // i18n 文案
    i18nTitle: i18n.t('upgrade.congratulations') || '🎉 恭喜升级！',
    i18nGoldCondition: '',
    i18nRatingCondition: '',
    i18nUnlockTitle: i18n.t('upgrade.unlock_list') || '解锁内容',
    i18nConfirm: i18n.t('upgrade.confirm') || '确认升级',
    i18nNotReady: i18n.t('upgrade.not_ready') || '条件不满足',
    i18nCancel: i18n.t('upgrade.later') || '暂不升级'
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
          levelEmoji: LEVEL_EMOJI[nextLevel] || '🏠',
          canUpgrade: nextInfo
            ? gold >= nextInfo.goldCost && rating >= nextInfo.minRating
            : false
        });

        // 构建解锁项目
        if (nextInfo) {
          this.setData({
            unlockItems: buildUnlockItems(nextInfo),
            i18nGoldCondition: `${gold}/${nextInfo.goldCost} 金币`,
            i18nRatingCondition: `${rating}/${nextInfo.minRating}⭐ 好评度`
          });
        }
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
