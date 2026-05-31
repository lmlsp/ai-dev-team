/**
 * ad.js — 广告管理
 * 激励视频、Banner、插屏广告的创建与管理
 * 支持优量汇 + 穿山甲瀑布流
 */
const api = require('./api');

// 广告位 ID（实际发布时替换为真实 ID）
const AD_UNIT_IDS = {
  rewarded: {
    ylh: 'adunit-xxxxxxxx',  // 优量汇激励视频
    csj: 'adunit-yyyyyyyy'   // 穿山甲激励视频（备选）
  },
  banner: {
    ylh: 'adunit-banner001'
  },
  interstitial: {
    ylh: 'adunit-inter001'
  }
};

class AdManager {
  constructor() {
    this._rewardedVideoAd = null;
    this._bannerAd = null;
    this._interstitialAd = null;
    this._rewardedCallback = null;
    this._isNewUser = true;
    this._newUserStartTime = Date.now();
    this._newUserGracePeriod = 5 * 60 * 1000; // 5 分钟保护期

    this._dailyCounts = {
      energy: 0,
      speedup: 0,
      double_gold: 0,
      extend_time: 0
    };

    this._dailyLimits = {
      energy: 10,
      speedup: 8,
      double_gold: 99,
      extend_time: 99
    };

    this._init();
  }

  _init() {
    // 实际发布时取消注释以下代码
    // this._createRewardedVideoAd();
    // this._createBannerAd();
    // this._createInterstitialAd();
    console.log('[Ad] 广告模块已初始化（开发模式，广告接口未启用）');
  }

  /**
   * 设置新用户状态
   */
  setNewUser(isNew) {
    this._isNewUser = isNew;
    if (isNew) {
      this._newUserStartTime = Date.now();
    }
  }

  /**
   * 是否在新用户保护期
   */
  _isInGracePeriod() {
    if (!this._isNewUser) return false;
    return (Date.now() - this._newUserStartTime) < this._newUserGracePeriod;
  }

  // ========== 激励视频广告 ==========

  _createRewardedVideoAd() {
    try {
      this._rewardedVideoAd = wx.createRewardedVideoAd({
        adUnitId: AD_UNIT_IDS.rewarded.ylh
      });

      this._rewardedVideoAd.onLoad(() => {
        console.log('[Ad] 激励视频加载成功');
      });

      this._rewardedVideoAd.onError(err => {
        console.warn('[Ad] 激励视频加载失败，尝试备选平台', err);
        this._fallbackToCsj();
      });

      this._rewardedVideoAd.onClose(res => {
        if (res && res.isEnded) {
          console.log('[Ad] 用户看完激励视频');
          if (this._rewardedCallback) {
            this._rewardedCallback(true);
            this._rewardedCallback = null;
          }
        } else {
          console.log('[Ad] 用户未看完激励视频');
          // 非阻断式提示
          if (res && res.isEnded === false) {
            wx.showToast({ title: '完整观看才能获得奖励哦', icon: 'none', duration: 2000 });
          }
          if (this._rewardedCallback) {
            this._rewardedCallback(false);
            this._rewardedCallback = null;
          }
        }
      });
    } catch (e) {
      console.warn('[Ad] 创建激励视频失败', e);
    }
  }

  /**
   * 优量汇失败 → 穿山甲备选
   */
  _fallbackToCsj() {
    try {
      this._rewardedVideoAd = wx.createRewardedVideoAd({
        adUnitId: AD_UNIT_IDS.rewarded.csj
      });
      console.log('[Ad] 切换到穿山甲激励视频');
    } catch (e) {
      console.warn('[Ad] 穿山甲激励视频创建也失败', e);
    }
  }

  /**
   * 展示激励视频
   * @param {string} scene - 'energy' | 'speedup' | 'double_gold' | 'extend_time'
   * @returns {Promise<boolean>} 是否完整观看
   */
  showRewardedVideo(scene) {
    return new Promise((resolve, reject) => {
      // 新用户保护期内直接给奖励
      if (this._isInGracePeriod()) {
        console.log('[Ad] 新用户保护期，直接发放奖励:', scene);
        resolve(true);
        return;
      }

      // 检查每日上限
      const limit = this._dailyLimits[scene] || 99;
      const count = this._dailyCounts[scene] || 0;
      if (count >= limit) {
        wx.showToast({ title: '今日次数已用完，明天再来吧', icon: 'none' });
        reject(new Error('daily_limit_reached'));
        return;
      }

      // 开发模式模拟
      if (!this._rewardedVideoAd) {
        console.log('[Ad] 开发模式模拟广告:', scene);
        wx.showModal({
          title: '模拟广告',
          content: `场景：${scene}\n点击"确认"模拟看完广告`,
          success: (res) => {
            if (res.confirm) {
              this._dailyCounts[scene] = (this._dailyCounts[scene] || 0) + 1;
              api.reportAdWatch(scene, 'dev', 'mock_token').catch(() => {});
              resolve(true);
            } else {
              reject(new Error('user_cancelled'));
            }
          }
        });
        return;
      }

      // 真实广告
      this._rewardedCallback = (completed) => {
        if (completed) {
          this._dailyCounts[scene] = (this._dailyCounts[scene] || 0) + 1;
          api.reportAdWatch(scene, 'ylh', 'real_token').catch(() => {});
          resolve(true);
        } else {
          reject(new Error('ad_not_completed'));
        }
      };

      this._rewardedVideoAd.show().catch(err => {
        console.warn('[Ad] 激励视频展示失败', err);
        // 广告加载中
        wx.showToast({ title: '广告加载中，请稍后再试', icon: 'none' });
        reject(err);
      });
    });
  }

  // ========== Banner 广告 ==========

  _createBannerAd() {
    try {
      const sysInfo = wx.getSystemInfoSync();
      this._bannerAd = wx.createBannerAd({
        adUnitId: AD_UNIT_IDS.banner.ylh,
        adIntervals: 30, // 30 秒自动刷新
        style: {
          left: 0,
          top: sysInfo.windowHeight - 100,
          width: sysInfo.windowWidth
        }
      });

      this._bannerAd.onError(err => {
        console.warn('[Ad] Banner 加载失败', err);
      });

      this._bannerAd.onResize(res => {
        // 调整 Banner 位置
        this._bannerAd.style.top = sysInfo.windowHeight - this._bannerAd.style.realHeight;
      });
    } catch (e) {
      console.warn('[Ad] 创建 Banner 失败', e);
    }
  }

  /**
   * 显示 Banner
   */
  showBanner() {
    if (this._bannerAd && !this._isInGracePeriod()) {
      this._bannerAd.show().catch(err => {
        console.warn('[Ad] Banner 展示失败', err);
      });
    }
  }

  /**
   * 隐藏 Banner
   */
  hideBanner() {
    if (this._bannerAd) {
      this._bannerAd.hide();
    }
  }

  // ========== 插屏广告 ==========

  _createInterstitialAd() {
    try {
      this._interstitialAd = wx.createInterstitialAd({
        adUnitId: AD_UNIT_IDS.interstitial.ylh
      });

      this._interstitialAd.onError(err => {
        console.warn('[Ad] 插屏加载失败', err);
      });
    } catch (e) {
      console.warn('[Ad] 创建插屏失败', e);
    }
  }

  /**
   * 展示插屏广告（场景过渡时）
   */
  showInterstitial() {
    if (this._isInGracePeriod()) return;
    if (this._interstitialAd) {
      this._interstitialAd.show().catch(err => {
        console.warn('[Ad] 插屏展示失败', err);
      });
    }
  }

  /**
   * 检查场景是否达每日上限
   */
  canShowRewarded(scene) {
    const limit = this._dailyLimits[scene] || 99;
    const count = this._dailyCounts[scene] || 0;
    return count < limit;
  }

  /**
   * 获取场景剩余次数
   */
  getRemainingCount(scene) {
    const limit = this._dailyLimits[scene] || 99;
    const count = this._dailyCounts[scene] || 0;
    return Math.max(0, limit - count);
  }
}

// 单例
const adManager = new AdManager();
module.exports = adManager;
