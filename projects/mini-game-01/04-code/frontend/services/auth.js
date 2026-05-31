/**
 * auth.js — 微信登录
 * wx.login() 获取 code，调用后端换取 token，本地存储
 */
const api = require('./api');
const storage = require('../utils/storage');

const auth = {
  /**
   * 微信静默登录
   * @returns {Promise<object>} 用户数据
   */
  login() {
    return new Promise((resolve, reject) => {
      // 先检查本地是否有 token
      const cachedToken = storage.get('token');
      if (cachedToken) {
        // 有 token，尝试获取用户信息验证有效性
        api.getUserInfo()
          .then(user => {
            console.log('[Auth] Token 有效，直接登录');
            resolve({ user });
          })
          .catch(() => {
            // token 过期，清除后重新登录
            console.log('[Auth] Token 过期，重新登录');
            storage.remove('token');
            this._doWxLogin().then(resolve).catch(reject);
          });
      } else {
        // 无 token，首次登录
        this._doWxLogin().then(resolve).catch(reject);
      }
    });
  },

  /**
   * 执行微信登录流程
   */
  _doWxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (loginRes) => {
          if (!loginRes.code) {
            reject(new Error('wx.login 失败：未获取到 code'));
            return;
          }

          // 获取用户信息（需要用户授权）
          this._getUserProfile()
            .then(profile => {
              return api.login(
                loginRes.code,
                profile.nickName,
                profile.avatarUrl
              );
            })
            .then(data => {
              // 保存 token
              if (data && data.token) {
                storage.save('token', data.token);
              }
              console.log('[Auth] 登录成功');
              resolve(data);
            })
            .catch(err => {
              // 登录失败，尝试无用户信息的登录
              console.warn('[Auth] 带用户信息登录失败，尝试基础登录', err);
              api.login(loginRes.code)
                .then(data => {
                  if (data && data.token) {
                    storage.save('token', data.token);
                  }
                  resolve(data);
                })
                .catch(reject);
            });
        },
        fail: (err) => {
          console.error('[Auth] wx.login 失败', err);
          reject(new Error('微信登录失败：' + (err.errMsg || '未知错误')));
        }
      });
    });
  },

  /**
   * 获取用户头像和昵称（微信新版隐私协议）
   */
  _getUserProfile() {
    return new Promise((resolve, reject) => {
      // 检查是否支持 getUserProfile（新版基础库）
      if (wx.getUserProfile) {
        wx.getUserProfile({
          desc: '用于展示你的游戏形象',
          success: (res) => {
            resolve({
              nickName: res.userInfo.nickName || '小厨神',
              avatarUrl: res.userInfo.avatarUrl || ''
            });
          },
          fail: () => {
            // 用户拒绝授权，使用默认值
            resolve({
              nickName: '小厨神' + Math.floor(Math.random() * 1000),
              avatarUrl: ''
            });
          }
        });
      } else {
        // 旧版基础库，使用 getUserInfo
        wx.getUserInfo({
          success: (res) => {
            resolve({
              nickName: res.userInfo.nickName || '小厨神',
              avatarUrl: res.userInfo.avatarUrl || ''
            });
          },
          fail: () => {
            resolve({
              nickName: '小厨神' + Math.floor(Math.random() * 1000),
              avatarUrl: ''
            });
          }
        });
      }
    });
  },

  /**
   * 退出登录
   */
  logout() {
    storage.remove('token');
    storage.remove('game_state');
    console.log('[Auth] 已退出登录');
  },

  /**
   * 检查是否已登录
   */
  isLoggedIn() {
    return !!storage.get('token');
  }
};

module.exports = auth;
