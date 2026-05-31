/**
 * gold-display — 金币展示组件
 */
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
    animating: false
  },

  observers: {
    'amount'(newVal) {
      if (this.properties.animate && newVal !== this.data.displayAmount) {
        this._animateValue(this.data.displayAmount, newVal);
      } else {
        this.setData({ displayAmount: newVal });
      }
    }
  },

  methods: {
    _animateValue(from, to) {
      const diff = to - from;
      const steps = 20;
      const interval = 30;
      let step = 0;

      this.setData({ animating: true });

      const timer = setInterval(() => {
        step++;
        const current = Math.round(from + (diff * step) / steps);
        this.setData({ displayAmount: current });

        if (step >= steps) {
          clearInterval(timer);
          this.setData({ displayAmount: to, animating: false });
        }
      }, interval);
    }
  }
});
