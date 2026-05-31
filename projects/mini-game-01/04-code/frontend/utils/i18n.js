/**
 * i18n.js — 国际化
 * 所有可见文案通过 t(key) 调用，当前语言 zh-CN
 * 后续添加语言只需新增 locales/xx-XX.json 文件即可
 */
const zhCN = require('../locales/zh-CN.json');

/** 当前语言 */
let _lang = 'zh-CN';

/** 文案映射表 */
const _messages = {
  'zh-CN': zhCN
};

const i18n = {
  /**
   * 获取翻译文案
   * @param {string} key - 文案键，支持点分隔的嵌套路径，如 "home.title"
   * @param {object} params - 插值参数，如 { count: 3 }
   * @returns {string} 翻译后的文案
   */
  t(key, params) {
    const keys = key.split('.');
    let value = _messages[_lang];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`[i18n] 缺少翻译: ${key}`);
        return key; // fallback: 返回 key 本身
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // 参数插值：t('home.welcome', { name: '小明' }) → "欢迎，小明！"
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? String(params[paramKey]) : match;
      });
    }

    return value;
  },

  /**
   * 设置语言
   * @param {string} lang - 语言代码
   */
  setLang(lang) {
    if (_messages[lang]) {
      _lang = lang;
      console.log('[i18n] 语言切换:', lang);
    } else {
      console.warn('[i18n] 不支持的语言:', lang);
    }
  },

  /**
   * 获取当前语言
   */
  getLang() {
    return _lang;
  },

  /**
   * 注册语言包（动态加载）
   */
  register(lang, messages) {
    _messages[lang] = messages;
  }
};

module.exports = i18n;
