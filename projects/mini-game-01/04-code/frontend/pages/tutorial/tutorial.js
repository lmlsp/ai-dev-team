/**
 * tutorial.js — 新手引导（蒙层 + 高亮 + 步骤式 6 步）
 */
const i18n = require('../../utils/i18n');
const storage = require('../../utils/storage');

const STEPS = [
  {
    title: 'tutorial.step1_title',
    desc: 'tutorial.step1_desc',
    highlight: 'board',
    btnText: 'tutorial.next'
  },
  {
    title: 'tutorial.step2_title',
    desc: 'tutorial.step2_desc',
    highlight: 'board',
    btnText: 'tutorial.next'
  },
  {
    title: 'tutorial.step3_title',
    desc: 'tutorial.step3_desc',
    highlight: 'order',
    btnText: 'tutorial.next'
  },
  {
    title: 'tutorial.step4_title',
    desc: 'tutorial.step4_desc',
    highlight: 'upgrade',
    btnText: 'tutorial.next'
  },
  {
    title: 'tutorial.step5_title',
    desc: 'tutorial.step5_desc',
    highlight: 'cookbook',
    btnText: 'tutorial.next'
  },
  {
    title: 'tutorial.step6_title',
    desc: 'tutorial.step6_desc',
    highlight: 'share',
    btnText: 'tutorial.done'
  }
];

Page({
  data: {
    currentStep: 0,
    step: null,
    isLast: false,
    tipStyle: ''
  },

  onLoad() {
    this._showStep(0);
  },

  _showStep(index) {
    if (index >= STEPS.length) {
      this._finish();
      return;
    }

    const step = STEPS[index];
    this.setData({
      currentStep: index,
      step: {
        title: i18n.t(step.title),
        desc: i18n.t(step.desc),
        btnText: i18n.t(step.btnText)
      },
      isLast: index === STEPS.length - 1,
      tipStyle: this._getTipStyle(step.highlight)
    });
  },

  /**
   * 计算提示框位置
   */
  _getTipStyle(highlight) {
    const sysInfo = wx.getSystemInfoSync();
    const w = sysInfo.windowWidth;
    const h = sysInfo.windowHeight;

    switch (highlight) {
      case 'board':
        // 棋盘区域中央
        return `top: ${h * 0.35}px; left: ${w * 0.1}px; width: ${w * 0.8}px;`;
      case 'order':
        // 订单区
        return `top: 120px; left: ${w * 0.1}px; width: ${w * 0.8}px;`;
      case 'upgrade':
        // 底部操作栏
        return `bottom: 180px; left: ${w * 0.1}px; width: ${w * 0.8}px;`;
      case 'cookbook':
        // 底部操作栏中间
        return `bottom: 180px; left: ${w * 0.2}px; width: ${w * 0.6}px;`;
      case 'share':
        // 屏幕中央
        return `top: ${h * 0.3}px; left: ${w * 0.1}px; width: ${w * 0.8}px;`;
      default:
        return `top: ${h * 0.35}px; left: ${w * 0.1}px; width: ${w * 0.8}px;`;
    }
  },

  /**
   * 下一步
   */
  onNext() {
    const next = this.data.currentStep + 1;
    if (next >= STEPS.length) {
      this._finish();
    } else {
      this._showStep(next);
    }
  },

  /**
   * 跳过引导
   */
  onSkip() {
    wx.showModal({
      title: '跳过引导',
      content: '确定跳过新手引导吗？之后可以在设置中重新开始。',
      success: (res) => {
        if (res.confirm) {
          this._finish();
        }
      }
    });
  },

  /**
   * 完成引导
   */
  _finish() {
    // 标记引导完成
    storage.save('tutorial_done', true);
    const app = getApp();
    if (app.gameStore) {
      app.gameStore.set('tutorialCompleted', true);
    }

    console.log('[Tutorial] 引导完成');
    // 返回上一页（通常是 home）
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({ url: '/pages/home/home' });
      }
    });
  }
});
