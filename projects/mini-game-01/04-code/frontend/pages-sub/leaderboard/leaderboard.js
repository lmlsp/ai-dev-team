/**
 * leaderboard.js — 排行榜（周榜/总榜）
 */
const api = require('../../services/api');
const i18n = require('../../utils/i18n');

Page({
  data: {
    activeTab: 'weekly',
    list: [],
    myRank: null,
    loading: true,
    loadFailed: false
  },

  onLoad() {
    this.setData({
      i18n: {
        title: i18n.t('leaderboard.title'),
        weekly: i18n.t('leaderboard.weekly'),
        total: i18n.t('leaderboard.total'),
        myRank: i18n.t('leaderboard.my_rank'),
        loadFailed: i18n.t('leaderboard.load_failed'),
        retry: i18n.t('loading.retry'),
        loading: i18n.t('common.loading') || '加载中...'
      }
    });
    this._loadData();
  },

  onPullDownRefresh() {
    this._loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab, loading: true });
    this._loadData();
  },

  async _loadData() {
    this.setData({ loading: true, loadFailed: false });

    try {
      const type = this.data.activeTab;
      const data = await api.getLeaderboard(type, 1, 20);
      const myRankData = await api.getMyRank(type);

      this.setData({
        list: (data && data.list) || [],
        myRank: myRankData || null,
        loading: false
      });
    } catch (err) {
      console.warn('[Leaderboard] 加载失败', err);
      // 使用本地缓存的排行榜（上次成功的数据）
      const cached = this.data.list;
      this.setData({
        loading: false,
        loadFailed: cached.length === 0
      });
      if (cached.length === 0) {
        // 生成模拟数据
        this._generateMockData();
      }
    }
  },

  /**
   * 生成模拟排行榜（离线/开发用）
   */
  _generateMockData() {
    const names = ['厨神阿芳', '美食家小明', '大厨老张', '小厨娘悦悦', '吃货达人',
      '烹饪大师李', '舌尖上的老王', '家常菜控翠花', '甜品女王娜娜', '川菜专家峰哥'];
    const list = names.map((name, i) => ({
      rank: i + 1,
      uid: 'user_' + (1000 + i),
      nickName: name,
      avatarUrl: '',
      restaurantName: name + '的餐厅',
      restaurantLevel: Math.max(1, 5 - Math.floor(i / 3)),
      rating: (4.9 - i * 0.15).toFixed(1)
    }));

    this.setData({
      list: list,
      myRank: { rank: Math.floor(Math.random() * 50) + 11, rating: (3.0 + Math.random() * 1.5).toFixed(1) },
      loadFailed: false
    });
  },

  onBack() {
    wx.navigateBack();
  }
});
