/**
 * api.js — HTTP 请求封装
 * wx.request 封装为 Promise、统一错误处理、超时重试、自动附带 JWT
 */
const storage = require('../utils/storage');

// 配置
const CONFIG = {
  baseURL: 'https://api.chefgame.cn',
  timeout: 15000,        // 15 秒超时
  maxRetries: 3,         // 最多重试 3 次
  retryDelays: [1000, 3000, 5000], // 重试间隔：1s, 3s, 5s
  maxConcurrent: 5       // 小程序最多 5 个并发请求
};

// 并发控制
let _pendingCount = 0;
const _pendingQueue = [];

function _releaseSlot() {
  _pendingCount--;
  if (_pendingQueue.length > 0 && _pendingCount < CONFIG.maxConcurrent) {
    const next = _pendingQueue.shift();
    _pendingCount++;
    next();
  }
}

function _waitSlot() {
  return new Promise(resolve => {
    if (_pendingCount < CONFIG.maxConcurrent) {
      _pendingCount++;
      resolve();
    } else {
      _pendingQueue.push(() => {
        _pendingCount++;
        resolve();
      });
    }
  });
}

/**
 * 发起 HTTP 请求
 * @param {string} method - GET/POST/PUT/DELETE
 * @param {string} url - 接口路径（不含 baseURL）
 * @param {object} data - 请求体
 * @param {object} options - { noAuth, skipRetry, timeout }
 * @returns {Promise<any>}
 */
function request(method, url, data, options = {}) {
  const fullUrl = /^https?:\/\//.test(url) ? url : CONFIG.baseURL + url;
  const token = options.noAuth ? null : storage.get('token');

  const doRequest = (attempt = 0) => {
    return new Promise((resolve, reject) => {
      const header = {
        'Content-Type': 'application/json'
      };
      if (token) {
        header['Authorization'] = `Bearer ${token}`;
      }

      const timeout = options.timeout || CONFIG.timeout;

      wx.request({
        url: fullUrl,
        method: method,
        data: data,
        header: header,
        timeout: timeout,
        success(res) {
          if (res.statusCode === 200) {
            const body = res.data;
            // 统一响应格式: { code, message, data }
            if (body && body.code === 0) {
              resolve(body.data);
            } else if (body && body.code === 401) {
              // Token 过期，清除并提示重新登录
              storage.remove('token');
              storage.remove('game_state');
              wx.reLaunch({ url: '/pages/loading/loading' });
              reject(new Error('登录已过期，请重新进入'));
            } else {
              reject(new Error(body?.message || `请求失败(${body?.code || res.statusCode})`));
            }
          } else if (res.statusCode === 401) {
            storage.remove('token');
            storage.remove('game_state');
            wx.reLaunch({ url: '/pages/loading/loading' });
            reject(new Error('登录已过期'));
          } else if (res.statusCode === 409) {
            // 版本冲突，返回完整响应体供上层处理
            resolve(res.data);
          } else {
            reject(new Error(`服务器错误(${res.statusCode})`));
          }
        },
        fail(err) {
          // 网络异常，自动重试
          if (!options.skipRetry && attempt < CONFIG.maxRetries) {
            const delay = CONFIG.retryDelays[attempt] || 5000;
            console.warn(`[API] 请求失败，${delay}ms 后重试 (${attempt + 1}/${CONFIG.maxRetries})`, url);
            setTimeout(() => {
              doRequest(attempt + 1).then(resolve).catch(reject);
            }, delay);
          } else {
            reject(new Error(err.errMsg || '网络异常，请检查网络连接'));
          }
        }
      });
    });
  };

  return _waitSlot().then(() => {
    return doRequest().finally(() => {
      _releaseSlot();
    });
  });
}

/**
 * API 方法
 */
const api = {
  get(url, data, options) {
    return request('GET', url, data, options);
  },
  post(url, data, options) {
    return request('POST', url, data, options);
  },
  put(url, data, options) {
    return request('PUT', url, data, options);
  },
  delete(url, data, options) {
    return request('DELETE', url, data, options);
  },

  // ========== 业务接口快捷方法 ==========

  // 用户
  login(code, nickName, avatarUrl) {
    return api.post('/api/v1/auth/login', { code, nickName, avatarUrl }, { noAuth: true });
  },

  getUserInfo() {
    return api.get('/api/v1/users/me');
  },

  updateUserInfo(info) {
    return api.put('/api/v1/users/me', info);
  },

  // 棋盘
  getBoard() {
    return api.get('/api/v1/board');
  },

  syncBoard(version, operations, currentGold, currentEnergy, currentRating) {
    return api.post('/api/v1/board/sync', {
      version,
      operations,
      currentGold,
      currentEnergy,
      currentRating
    });
  },

  // 合成
  submitMerge(mergeData) {
    return api.post('/api/v1/merges', mergeData);
  },

  // 订单
  getOrders() {
    return api.get('/api/v1/orders');
  },

  serveOrder(orderId, servedItem, boardIdx, customerId) {
    return api.post(`/api/v1/orders/${orderId}/serve`, {
      timestamp: Date.now(),
      servedItem,
      boardIdx,
      customerId
    });
  },

  // 餐厅
  getRestaurant() {
    return api.get('/api/v1/restaurant');
  },

  upgradeRestaurant() {
    return api.post('/api/v1/restaurant/upgrade');
  },

  // 排行榜
  getLeaderboard(type, page, size) {
    return api.get(`/api/v1/leaderboard/${type}`, { page, size });
  },

  getMyRank(type) {
    return api.get('/api/v1/leaderboard/me/rank', { type });
  },

  // 社交
  getFriends() {
    return api.get('/api/v1/friends');
  },

  getFriendRestaurant(uid) {
    return api.get(`/api/v1/friends/${uid}/restaurant`);
  },

  visitFriend(uid) {
    return api.post(`/api/v1/friends/${uid}/visit`);
  },

  likeFriend(uid) {
    return api.post(`/api/v1/friends/${uid}/like`);
  },

  giftEnergy(uid) {
    return api.post('/api/v1/friends/gift-energy', { toUid: uid });
  },

  getEnergyGifts() {
    return api.get('/api/v1/friends/energy-gifts');
  },

  // 广告
  reportAdWatch(scene, adPlatform, adToken) {
    return api.post('/api/v1/ad/watch', {
      scene,
      adPlatform,
      adToken,
      timestamp: Date.now()
    });
  }
};

module.exports = api;
