/**
 * friends.js — 好友列表
 */
const api = require('../../services/api');

Page({
  data: {
    friends: [],
    loading: true,
    empty: false,
    visitCount: 0,
    maxVisit: 10
  },

  onLoad() {
    this._loadFriends();
  },

  onShow() {
    this._loadFriends();
  },

  async _loadFriends() {
    this.setData({ loading: true });

    try {
      const data = await api.getFriends();
      const list = (data && data.list) || [];
      this.setData({
        friends: list,
        loading: false,
        empty: list.length === 0
      });
    } catch (err) {
      console.warn('[Friends] 加载失败', err);
      // 离线/开发模式模拟数据
      this.setData({
        friends: this._getMockFriends(),
        loading: false,
        empty: false
      });
    }
  },

  _getMockFriends() {
    const names = ['厨神阿芳', '大厨老张', '小厨娘悦悦', '吃货达人小明', '烹饪大师李'];
    return names.map((name, i) => ({
      uid: 'friend_' + (100 + i),
      nickName: name,
      avatarUrl: '',
      restaurantName: name + '的餐厅',
      restaurantLevel: Math.max(1, 5 - i),
      rating: (4.5 - i * 0.3).toFixed(1),
      canVisit: true
    }));
  },

  /**
   * 拜访好友
   */
  onVisitFriend(e) {
    const uid = e.currentTarget.dataset.uid;
    wx.navigateTo({
      url: `/pages-sub/friend-restaurant/friend-restaurant?uid=${uid}`
    });
  },

  /**
   * 赠送能量
   */
  onSendEnergy(e) {
    const uid = e.currentTarget.dataset.uid;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: '赠送能量',
      content: `确定赠送 10 点能量给 ${name} 吗？`,
      success: (res) => {
        if (res.confirm) {
          api.giftEnergy(uid).then(() => {
            wx.showToast({ title: '已赠送 10 点能量！', icon: 'success' });
          }).catch(() => {
            wx.showToast({ title: '赠送失败，请稍后再试', icon: 'none' });
          });
        }
      }
    });
  },

  onBack() {
    wx.navigateBack();
  }
});
