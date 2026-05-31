/**
 * share.js — 分享结果页（分享卡片落地页）
 */
const MergeEngine = require('../../engine/MergeEngine');

Page({
  data: {
    type: '',
    recipeName: '',
    recipeEmoji: '',
    level: 0,
    levelName: ''
  },

  onLoad(options) {
    const type = options.type || 'recipe';

    if (type === 'recipe') {
      const recipeId = options.id || '';
      const info = MergeEngine.getItemInfo(recipeId);
      this.setData({
        type: 'recipe',
        recipeName: info ? info.display : '菜品',
        recipeEmoji: info ? info.emoji : '🍳'
      });
    } else if (type === 'restaurant') {
      const level = parseInt(options.level) || 1;
      const levelNames = ['', '街边小摊', '小饭馆', '人气餐厅', '知名酒楼', '米其林星级'];
      this.setData({
        type: 'restaurant',
        level: level,
        levelName: levelNames[level] || '餐厅'
      });
    }

    // 如果是通过分享进入，先检查登录状态
    const app = getApp();
    if (!app.gameStore || app.gameStore.get('user').isGuest) {
      // 游客模式，提示登录
      setTimeout(() => {
        wx.showModal({
          title: '欢迎来到合合小厨神！',
          content: '登录后可以查看完整内容和进行游戏哦~',
          confirmText: '开始游戏',
          cancelText: '稍后再说',
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({ url: '/pages/loading/loading' });
            }
          }
        });
      }, 500);
    }
  },

  /**
   * 进入游戏
   */
  onEnterGame() {
    wx.redirectTo({ url: '/pages/loading/loading' });
  },

  /**
   * 查看分享内容对应的页面
   */
  onViewDetail() {
    const type = this.data.type;
    if (type === 'recipe') {
      wx.redirectTo({ url: '/pages/loading/loading' });
    } else if (type === 'restaurant') {
      wx.redirectTo({ url: '/pages/loading/loading' });
    }
  }
});
