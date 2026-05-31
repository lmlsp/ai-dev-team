/**
 * ad-button — 广告按钮组件
 * 统一的激励视频入口
 */
const adManager = require('../../services/ad');

Component({
  properties: {
    scene: {
      type: String,
      value: 'energy'
    },
    label: {
      type: String,
      value: '看广告'
    },
    icon: {
      type: String,
      value: '📺'
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    loading: false
  },

  methods: {
    onTap() {
      if (this.properties.disabled || this.data.loading) return;

      this.setData({ loading: true });

      const self = this;
      adManager.showRewardedVideo(this.properties.scene)
        .then(() => {
          self.setData({ loading: false });
          self.triggerEvent('rewarded', { scene: self.properties.scene });
        })
        .catch((err) => {
          self.setData({ loading: false });
          if (err.message !== 'user_cancelled') {
            self.triggerEvent('error', { scene: self.properties.scene, error: err });
          }
        });
    }
  }
});
