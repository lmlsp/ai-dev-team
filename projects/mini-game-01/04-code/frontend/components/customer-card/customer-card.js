/**
 * customer-card — 顾客卡片组件
 * UI 设计 §4.3：圆形 conic-gradient 计时环、抖动动画
 * 头像、所需菜品、等待倒计时
 */
const i18n = require('../../utils/i18n');

/**
 * 根据剩余秒数返回环形颜色
 * > 20s: 绿色 | 10-20s: 金色 | < 10s: 红色
 */
function getRingColor(remaining) {
  if (remaining > 20) return '#4CAF50';
  if (remaining > 10) return '#FFB347';
  return '#FF5252';
}

/**
 * 构建 conic-gradient 环形进度渐变
 * @param {number} deg - 进度角度 0~360
 * @param {string} color - 进度颜色
 * @returns {string} CSS conic-gradient 值
 */
function buildRingGradient(deg, color) {
  const trackColor = '#EDE4DA';
  const clampedDeg = Math.max(0, Math.min(360, deg));
  // 处理极端值：0deg 和 360deg 时 conic-gradient 可能不渲染环形
  if (clampedDeg <= 0) {
    return `conic-gradient(${trackColor} 0deg 360deg)`;
  }
  if (clampedDeg >= 360) {
    return `conic-gradient(${color} 0deg 360deg)`;
  }
  return `conic-gradient(${color} 0deg ${clampedDeg}deg, ${trackColor} ${clampedDeg}deg 360deg)`;
}

Component({
  properties: {
    customerName: {
      type: String,
      value: '顾客'
    },
    customerAvatar: {
      type: String,
      value: i18n.t('customer.avatar_placeholder') || '👤'
    },
    recipeName: {
      type: String,
      value: ''
    },
    recipeEmoji: {
      type: String,
      value: '🍽️'
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
    // 旧: progressPercent — 已移除，改用圆形计时环
    progressDeg: 360,
    ringColor: '#4CAF50',
    ringGradient: '',
    showShake: false,
    roundedRemaining: 0,
    statusText: '',
    statusClass: ''
  },

  observers: {
    'remaining, timeLimit, completed, timedOut, urgent'(
      remaining, timeLimit, completed, timedOut, urgent
    ) {
      if (completed) {
        this.setData({
          statusText: i18n.t('customer.status_completed') || '✓ 完成',
          statusClass: 'completed',
          showShake: false
        });
      } else if (timedOut) {
        this.setData({
          statusText: i18n.t('customer.status_timeout') || '✗ 超时',
          statusClass: 'timeout',
          showShake: false
        });
      } else {
        const pct = timeLimit > 0 ? remaining / timeLimit : 0;
        const deg = Math.round(pct * 360);
        const secs = Math.ceil(remaining);
        const color = getRingColor(remaining);

        this.setData({
          progressDeg: deg,
          ringColor: color,
          ringGradient: buildRingGradient(deg, color),
          showShake: remaining < 10,
          roundedRemaining: secs,
          statusText: secs + 's',
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
