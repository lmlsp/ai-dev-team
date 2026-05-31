/**
 * tutorial.js — 新手引导（蒙层 + 高亮 + 6步引导）
 * 使用 box-shadow 模拟遮罩开孔效果
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
    highlight: 'friends',
    btnText: 'tutorial.done'
  }
];

Page({
  data: {
    currentStep: 0,
    step: null,
    isLast: false,
    highlightStyle: '',
    tipStyle: '',
    visible: true,
    fadeAnim: ''
  },

  onLoad() {
    this._showStep(0);
  },

  /**
   * 显示指定步骤
   */
  _showStep(index) {
    if (index >= STEPS.length) {
      this._finish();
      return;
    }

    const stepDef = STEPS[index];

    // 淡出淡入过渡
    this.setData({ fadeAnim: 'fade-out' });
    setTimeout(() => {
      this.setData({
        currentStep: index,
        step: {
          title: i18n.t(stepDef.title),
          desc: i18n.t(stepDef.desc),
          btnText: i18n.t(stepDef.btnText)
        },
        isLast: index === STEPS.length - 1,
        highlightStyle: this._getHighlightStyle(stepDef.highlight),
        tipStyle: this._getTipStyle(stepDef.highlight),
        fadeAnim: 'fade-in'
      });
    }, 200);
  },

  /**
   * 计算高亮区域样式
   * 使用 box-shadow 制造开孔效果
   */
  _getHighlightStyle(highlight) {
    const sysInfo = wx.getSystemInfoSync();
    const w = sysInfo.windowWidth;
    const h = sysInfo.windowHeight;

    let x, y, width, height;
    // 各高亮区域位置（rpx → px）
    const rpx = sysInfo.windowWidth / 750;

    switch (highlight) {
      case 'board':
        x = 30 * rpx;
        y = h * 0.28;
        width = (w - 60 * rpx);
        height = h * 0.3;
        break;
      case 'order':
        x = 30 * rpx;
        y = 140 * rpx;
        width = (w - 60 * rpx);
        height = 120 * rpx;
        break;
      case 'upgrade':
        x = 20 * rpx;
        y = h - 200 * rpx;
        width = 200 * rpx;
        height = 120 * rpx;
        break;
      case 'cookbook':
        x = w / 2 - 100 * rpx;
        y = h - 200 * rpx;
        width = 200 * rpx;
        height = 120 * rpx;
        break;
      case 'friends':
        x = w - 220 * rpx;
        y = h - 200 * rpx;
        width = 200 * rpx;
        height = 120 * rpx;
        break;
      default:
        x = 40 * rpx;
        y = h * 0.3;
        width = w - 80 * rpx;
        height = h * 0.25;
    }

    return `left:${x}px; top:${y}px; width:${width}px; height:${height}px;`;
  },

  /**
   * 计算提示气泡位置
   */
  _getTipStyle(highlight) {
    const sysInfo = wx.getSystemInfoSync();
    const w = sysInfo.windowWidth;
    const h = sysInfo.windowHeight;

    let x, y, width;

    switch (highlight) {
      case 'board':
        x = w * 0.08;
        y = h * 0.62;
        width = w * 0.84;
        break;
      case 'order':
        x = w * 0.08;
        y = h * 0.5;
        width = w * 0.84;
        break;
      case 'upgrade':
      case 'cookbook':
      case 'friends':
        x = w * 0.08;
        y = h * 0.55;
        width = w * 0.84;
        break;
      default:
        x = w * 0.08;
        y = h * 0.6;
        width = w * 0.84;
    }

    return `left:${x}px; top:${y}px; width:${width}px;`;
  },

  /**
   * 下一步
   */
  onNext() {
    const next = this.data.currentStep + 1;
    this._showStep(next);
  },

  /**
   * 跳过引导
   */
  onSkip() {
    wx.showModal({
      title: i18n.t('tutorial.skip_confirm_title'),
      content: i18n.t('tutorial.skip_confirm_desc'),
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
    storage.save('tutorial_done', true);
    const app = getApp();
    if (app.gameStore) {
      app.gameStore.set('tutorialCompleted', true);
    }
    console.log('[Tutorial] 引导完成');

    wx.redirectTo({
      url: '/pages/home/home'
    });
  }
});
