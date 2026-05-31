/**
 * share.js — 分享逻辑
 * 菜品分享卡片、餐厅升级分享、排行榜分享
 * 使用 wx.shareAppMessage（页面内通过 button open-type="share" 触发）
 */
const share = {
  /**
   * 分享菜品图鉴
   * @param {string} recipeName - 菜品名称
   * @param {string} recipeId - 菜品 ID
   */
  shareRecipe(recipeName, recipeId) {
    return {
      title: `我在《合合小厨神》做出了【${recipeName}】！`,
      path: `/pages-sub/share/share?type=recipe&id=${recipeId}`,
      imageUrl: '', // 可替换为分享图片 URL
    };
  },

  /**
   * 分享餐厅升级
   * @param {number} level - 新等级
   * @param {string} restaurantName - 餐厅名称
   */
  shareUpgrade(level, restaurantName) {
    const levelNames = ['', '街边小摊', '小饭馆', '人气餐厅', '知名酒楼', '米其林星级'];
    return {
      title: `我的餐厅升级为【${restaurantName || levelNames[level] || '新餐厅'}】了！快来尝尝！`,
      path: `/pages-sub/share/share?type=restaurant&level=${level}`,
      imageUrl: '',
    };
  },

  /**
   * 分享排行榜
   * @param {number} rank - 排名
   * @param {number} rating - 好评度
   */
  shareLeaderboard(rank, rating) {
    return {
      title: `我在《合合小厨神》排第 ${rank} 名（${rating}⭐），来挑战我吧！`,
      path: '/pages-sub/leaderboard/leaderboard',
      imageUrl: '',
    };
  },

  /**
   * 通用分享（默认文案）
   */
  defaultShare() {
    return {
      title: '合合小厨神 — 合成食材，烹饪中华美食！来我的餐厅看看吧~',
      path: '/pages/loading/loading',
      imageUrl: '',
    };
  }
};

module.exports = share;
