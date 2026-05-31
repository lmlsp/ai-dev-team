/**
 * energy-bar — 能量条组件
 * 当前值/最大值 + 恢复倒计时 + "看广告"按钮
 */
const adManager = require('../../services/ad');
const i18n = require('../../utils/i18n');

Component({
  properties: {
    current: {
      type: Number,
      value: 100
    },
    max: {
      type: Number,
      value: 100
    },
    countdown: {
      type: Number,
      value: 0
    },
    dailyAdRemaining: {
      type: Number,
      value: 10
    }
  },

  data: {
    percentage: 100,
    countdownText: '',
    isFull: true
  },

  observers: {
    'current, max'(current, max) {
      const pct = max > 0 ? Math.round((current / max) * 100) : 0;
      this.setData({
        percentage: pct,
        isFull: current >= max
      });
    },
    'countdown'(countdown) {
      if (countdown > 0) {
        const min = Math.floor(countdown / 60);
        const sec = countdown % 60;
        this.setData({
          countdownText: `${min}:${sec.toString().padStart(2, '0')}后恢复1点`
        });
      } else {
        this.setData({ countdownText: '' });
      }
    }
  },

  methods: {
    onWatchAd() {
      const self = this;
      adManager.showRewardedVideo('energy')
        .then(() => {
          self.triggerEvent('energygained', { amount: 30 });
        })
        .catch(() => {});
    }
  }
});
