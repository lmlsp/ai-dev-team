/**
 * OrderManager.js — 订单管理
 * 生成随机顾客和订单、等待倒计时管理、超时检查
 */
const MergeEngine = require('./MergeEngine');

class OrderManager {
  constructor() {
    /** @type {Array<{id: string, customer: object, recipeId: string, recipeName: string, timeLimit: number, remaining: number, completed: boolean, timedOut: boolean}>} */
    this.orders = [];
    this._orderIdCounter = 0;
    this.maxOrders = 3;

    // 顾客名字池
    this._customerNames = [
      '吃货小明', '美食家阿芳', '馋嘴老王', '小吃货丽丽',
      '食神张叔', '小厨娘悦悦', '大胃王阿强', '甜品控娜娜',
      '辣味达人峰哥', '家常菜控翠花', '素食者小绿', '肉食者大壮'
    ];
    // 顾客头像色（emoji 代替真实头像）
    this._customerAvatars = [
      '👩', '👨', '👩‍🍳', '👨‍🍳', '👵', '👴', '👶', '👧',
      '🧑', '👩‍💼', '👨‍💼', '👩‍🎓'
    ];
  }

  /**
   * 生成新订单
   * @param {Array} unlockedRecipes - 已解锁的菜谱列表
   * @param {number} count - 生成数量（默认填满到 maxOrders）
   */
  generateOrders(unlockedRecipes, count) {
    const targetCount = count || this.maxOrders;
    const need = targetCount - this.orders.length;
    if (need <= 0) return [];

    const servable = MergeEngine.getServableRecipes();
    // 过滤已解锁的菜品
    const available = servable.length > 0 ? servable : unlockedRecipes || [];

    if (available.length === 0) return [];

    const newOrders = [];
    for (let i = 0; i < need; i++) {
      const recipe = available[Math.floor(Math.random() * available.length)];
      const recipeId = recipe.chainId || recipe.itemType || 'unknown';
      const recipeName = recipe.name || recipe.display || recipeId;

      // 随机等待时间 60-120 秒
      const timeLimit = 60 + Math.floor(Math.random() * 61);

      const customerIdx = Math.floor(Math.random() * this._customerNames.length);
      const avatarIdx = Math.floor(Math.random() * this._customerAvatars.length);

      const order = {
        id: `order_${++this._orderIdCounter}`,
        customer: {
          name: this._customerNames[customerIdx],
          avatar: this._customerAvatars[avatarIdx]
        },
        recipeId: recipeId,
        recipeName: recipeName,
        itemType: recipe.itemType || recipeId,
        timeLimit: timeLimit,
        remaining: timeLimit,
        completed: false,
        timedOut: false,
        createdAt: Date.now()
      };

      this.orders.push(order);
      newOrders.push(order);
    }

    return newOrders;
  }

  /**
   * 完成订单（上菜成功）
   * @param {number} orderIndex - 订单在队列中的索引
   * @returns {object|null} 完成的订单，失败返回 null
   */
  completeOrder(orderIndex) {
    if (orderIndex < 0 || orderIndex >= this.orders.length) return null;
    const order = this.orders[orderIndex];
    if (order.completed || order.timedOut) return null;
    order.completed = true;
    return order;
  }

  /**
   * 移除已完成的订单
   */
  removeCompleted() {
    this.orders = this.orders.filter(o => !o.completed && !o.timedOut);
  }

  /**
   * 移除所有超时订单
   */
  removeTimedOut() {
    this.orders = this.orders.filter(o => !o.timedOut);
  }

  /**
   * 每帧更新时间（delta 秒）
   * @param {number} delta - 距离上一帧的秒数
   * @returns {Array} 本帧超时的订单列表
   */
  tick(delta) {
    const timedOutOrders = [];
    for (const order of this.orders) {
      if (order.completed || order.timedOut) continue;
      order.remaining -= delta;
      if (order.remaining <= 0) {
        order.remaining = 0;
        order.timedOut = true;
        timedOutOrders.push(order);
      }
    }
    return timedOutOrders;
  }

  /**
   * 检查是否有活跃订单
   */
  hasActiveOrders() {
    return this.orders.some(o => !o.completed && !o.timedOut);
  }

  /**
   * 获取活跃订单数量
   */
  getActiveCount() {
    return this.orders.filter(o => !o.completed && !o.timedOut).length;
  }

  /**
   * 延长指定订单的等待时间（看广告）
   * @param {number} orderIndex
   * @param {number} seconds
   */
  extendTime(orderIndex, seconds) {
    if (orderIndex < 0 || orderIndex >= this.orders.length) return false;
    const order = this.orders[orderIndex];
    if (order.completed || order.timedOut) return false;
    order.remaining += seconds;
    order.timeLimit += seconds;
    return true;
  }

  /**
   * 序列化
   */
  toJSON() {
    return {
      orders: this.orders.map(o => ({ ...o })),
      idc: this._orderIdCounter
    };
  }

  /**
   * 反序列化
   */
  fromJSON(data) {
    if (data && data.orders) {
      this.orders = data.orders;
      this._orderIdCounter = data.idc || 0;
    }
  }
}

module.exports = OrderManager;
