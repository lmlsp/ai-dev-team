/**
 * customer-card — 顾客卡片组件
 * 头像、所需菜品、等待倒计时
 */
Component({
  properties: {
    customerName: {
      type: String,
      value: '顾客'
    },
    customerAvatar: {
      type: String,
      value: '👤'
    },
    recipeName: {
      type: String,
      value: ''
    },
    remaining: {
      type: Number,
      value: 60
    },
    timeLimit: {
      type: Number,
      value: 60
    },
    completed: {
      type: Boolean,
      value: false
    },
    timedOut: {
      type: Boolean,
      value: false
    },
    urgent: {
      type: Boolean,
      value: false
    }
  },

  data: {
    progressPercent: 100,
    statusText: '',
    statusClass: ''
  },

  observers: {
    'remaining, timeLimit, completed, timedOut, urgent'(remaining, timeLimit, completed, timedOut, urgent) {
      if (completed) {
        this.setData({
          progressPercent: 100,
          statusText: '✓ 完成',
          statusClass: 'completed'
        });
      } else if (timedOut) {
        this.setData({
          progressPercent: 0,
          statusText: '✗ 超时',
          statusClass: 'timeout'
        });
      } else {
        const pct = timeLimit > 0 ? Math.round((remaining / timeLimit) * 100) : 0;
        this.setData({
          progressPercent: pct,
          statusText: '⏱' + Math.ceil(remaining) + 's',
          statusClass: urgent ? 'urgent' : ''
        });
      }
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', {
        recipeName: this.properties.recipeName,
        completed: this.properties.completed,
        timedOut: this.properties.timedOut
      });
    }
  }
});
