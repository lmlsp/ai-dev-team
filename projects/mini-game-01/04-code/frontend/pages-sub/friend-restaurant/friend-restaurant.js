/**
 * friend-restaurant.js — 好友餐厅（拜访、点赞、查看棋盘）
 * 包含：好友信息栏、只读棋盘预览、点赞动画、灵感获取
 */
const api = require('../../services/api');
const i18n = require('../../utils/i18n');

/** 6×7 网格模拟数据 */
const MOCK_BOARD_ITEMS = [
  { emoji: '🍅', name: '番茄' }, { emoji: '🥚', name: '鸡蛋' }, null,
  { emoji: '🥬', name: '白菜' }, { emoji: '🧅', name: '洋葱' }, { emoji: '🥩', name: '五花肉' },
  { emoji: '🧄', name: '大蒜' }, { emoji: '🌶️', name: '辣椒' }, null,
  null, { emoji: '🥕', name: '胡萝卜' }, { emoji: '🍄', name: '蘑菇' },
  { emoji: '🫚', name: '生姜' }, null, { emoji: '🥒', name: '黄瓜' },
  { emoji: '🌽', name: '玉米' }, { emoji: '🍤', name: '虾仁' }, { emoji: '🍚', name: '米饭' },
  null, { emoji: '🫘', name: '豆腐' }, null,
  { emoji: '🥦', name: '西兰花' }, { emoji: '🧂', name: '调料' }, { emoji: '🍖', name: '排骨' },
  null, { emoji: '🥟', name: '饺子' }, null,
  { emoji: '🐟', name: '鲈鱼' }, { emoji: '🦐', name: '大虾' }, null,
  null, null, { emoji: '🍜', name: '面条' },
  { emoji: '🥗', name: '沙拉' }, { emoji: '🧁', name: '甜品' }, null,
  { emoji: '🍲', name: '炖菜' }, null, { emoji: '🥘', name: '炒菜' },
  null, null, null,
];

Page({
  data: {
    friendUid: '',
    friendInfo: null,
    loading: true,
    liked: false,
    likeCount: 128,
    likeAnimating: false,
    inspiration: 0,
    inspirationGot: false,
    boardItems: [],
    boardCols: 7,
    boardRows: 6
  },

  onLoad(options) {
    const uid = options.uid || '';
    this.setData({ friendUid: uid });
    this._loadFriendRestaurant(uid);
  },

  async _loadFriendRestaurant(uid) {
    this.setData({ loading: true });
    try {
      const data = await api.getFriendRestaurant(uid);
      this.setData({
        friendInfo: data || this._getMockInfo(),
        boardItems: this._buildBoardGrid(data && data.boardPreview ? data.boardPreview : MOCK_BOARD_ITEMS),
        likeCount: data ? (data.likeCount || 128) : 128,
        loading: false
      });
    } catch (err) {
      console.warn('[FriendRestaurant] 加载失败', err);
      this.setData({
        friendInfo: this._getMockInfo(),
        boardItems: this._buildBoardGrid(MOCK_BOARD_ITEMS),
        loading: false
      });
    }
  },

  _getMockInfo() {
    return {
      uid: this.data.friendUid,
      nickName: '好友的餐厅',
      restaurantName: '美食小馆',
      restaurantLevel: 3,
      rating: 4.2,
      likeCount: 128,
      visitCount: 356,
      boardPreview: []
    };
  },

  /**
   * 构建棋盘网格数据
   */
  _buildBoardGrid(items) {
    const grid = [];
    const flatItems = Array.isArray(items) ? items : MOCK_BOARD_ITEMS;
    for (let r = 0; r < this.data.boardRows; r++) {
      const row = [];
      for (let c = 0; c < this.data.boardCols; c++) {
        const idx = r * this.data.boardCols + c;
        const raw = idx < flatItems.length ? flatItems[idx] : null;
        if (raw && raw.emoji) {
          row.push({
            id: `cell-${r}-${c}`,
            emoji: raw.emoji,
            name: raw.name,
            filled: true
          });
        } else if (raw && typeof raw === 'object' && raw.icon) {
          // 兼容 boardPreview 不同数据结构
          row.push({
            id: `cell-${r}-${c}`,
            emoji: raw.icon || raw.emoji,
            name: raw.name || raw.label || '',
            filled: true
          });
        } else {
          row.push({
            id: `cell-${r}-${c}`,
            emoji: '',
            name: '',
            filled: false
          });
        }
      }
      grid.push(row);
    }
    return grid;
  },

  /**
   * ❤️ 点赞按钮
   */
  onLike() {
    if (this.data.liked) return;

    const uid = this.data.friendUid;
    api.likeFriend(uid).then(() => {
      this.setData({
        liked: true,
        likeAnimating: true,
        likeCount: this.data.likeCount + 1
      });
      wx.showToast({ title: i18n.t('friend_restaurant.like_success') || '点赞成功', icon: 'success' });

      // 动画结束后重置
      setTimeout(() => {
        this.setData({ likeAnimating: false });
      }, 600);
    }).catch(() => {
      wx.showToast({ title: i18n.t('friend_restaurant.like_failed') || '点赞失败', icon: 'none' });
    });
  },

  /**
   * 获取灵感值
   */
  onGetInspiration() {
    if (this.data.inspirationGot) return;

    const uid = this.data.friendUid;
    api.visitFriend(uid).then((data) => {
      const inspiration = (data && data.inspiration) || 5;
      this.setData({
        inspirationGot: true,
        inspiration: inspiration
      });
      wx.showToast({
        title: i18n.t('friend_restaurant.inspiration_received', { count: inspiration }),
        icon: 'success'
      });

      const app = getApp();
      if (app.gameStore) {
        const current = app.gameStore.get('inspiration') || 0;
        app.gameStore.set('inspiration', current + inspiration);
      }
    }).catch(() => {
      wx.showToast({ title: i18n.t('common.network_error'), icon: 'none' });
    });
  },

  onBack() {
    wx.navigateBack();
  }
});
