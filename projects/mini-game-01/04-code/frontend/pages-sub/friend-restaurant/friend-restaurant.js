/**
 * friend-restaurant.js — 好友餐厅（拜访、点赞）
 */
const api = require('../../services/api');

Page({
  data: {
    friendUid: '',
    friendInfo: null,
    loading: true,
    visited: false,
    liked: false,
    inspiration: 0
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
        loading: false
      });
    } catch (err) {
      console.warn('[FriendRestaurant] 加载失败', err);
      this.setData({
        friendInfo: this._getMockInfo(),
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
   * 拜访好友
   */
  onVisit() {
    if (this.data.visited) return;
    const uid = this.data.friendUid;

    api.visitFriend(uid).then((data) => {
      const inspiration = (data && data.inspiration) || 5;
      this.setData({
        visited: true,
        inspiration: inspiration
      });
      wx.showToast({
        title: `获得 ${inspiration} 灵感值！`,
        icon: 'success'
      });

      // 更新 gameStore
      const app = getApp();
      if (app.gameStore) {
        const current = app.gameStore.get('inspiration') || 0;
        app.gameStore.set('inspiration', current + inspiration);
      }
    }).catch(() => {
      wx.showToast({ title: '拜访失败', icon: 'none' });
    });
  },

  /**
   * 点赞
   */
  onLike() {
    if (this.data.liked) return;
    const uid = this.data.friendUid;

    api.likeFriend(uid).then(() => {
      this.setData({ liked: true });
      wx.showToast({ title: '点赞成功！', icon: 'success' });
    }).catch(() => {
      wx.showToast({ title: '点赞失败', icon: 'none' });
    });
  },

  onBack() {
    wx.navigateBack();
  }
});
