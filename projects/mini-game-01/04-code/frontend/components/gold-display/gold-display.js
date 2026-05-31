/**
 * gold-display — 金币展示组件
 * UI 设计 §4.6：CSS 径向渐变图标、逗号格式化、增长飘字
 */
const i18n = require('../../utils/i18n');

/**
 * 逗号格式化数字
 * @param {number} n
 * @returns {string}
 */
function formatComma(n) {
  if (n === undefined || n === null) return '0';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

Component({
  properties: {
    amount: {
      type: Number,
      value: 0
    },
    animate: {
      type: Boolean,
      value: false
    }
  },

  data: {
    displayAmount: 0,
    displayAmountFormatted: '0',
    animating: false,
    earnAmount: 0
  },

  observers: {
    'amount'(newVal) {
      if (this.properties.animate && newVal !== this.data.displayAmount) {
        const diff = newVal - this.data.displayAmount;
        this._animateValue(this.data.displayAmount, newVal, diff);
      } else {
        this.setData({
          displayAmount: newVal,
          displayAmountFormatted: formatComma(newVal)
        });
      }
    }
  },

  methods: {
    _animateValue(from, to, diff) {
      const steps = 20;
      const interval = 30;
      let step = 0;

      this.setData({ animating: true });

      // 设置增长的飘字金额
      if (diff > 0) {
        this.setData({ earnAmount: diff });
        // 飘字动画结束后清除
        setTimeout(() => {
          this.setData({ earnAmount: 0 });
        }, 800);
      }

      const timer = setInterval(() => {
        step++;
        const current = Math.round(from + (diff * step) / steps);
        this.setData({
          displayAmount: current,
          displayAmountFormatted: formatComma(current)
        });

        if (step >= steps) {
          clearInterval(timer);
          this.setData({
            displayAmount: to,
            displayAmountFormatted: formatComma(to),
            animating: false
          });
        }
      }, interval);
    }
  }
});
