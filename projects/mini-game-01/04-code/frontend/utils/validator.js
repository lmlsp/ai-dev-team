/**
 * validator.js — 客户端校验工具
 * 在数据提交到服务端之前进行基础合法性校验
 */
const validator = {
  /**
   * 校验合成操作
   * @param {object} fromItem - 被拖拽物品
   * @param {object} toItem - 目标物品
   * @param {number} energy - 当前能量
   * @returns {{ valid: boolean, message: string }}
   */
  validateMerge(fromItem, toItem, energy) {
    if (!fromItem || !toItem) {
      return { valid: false, message: '物品不存在' };
    }
    if (!fromItem.itemType || !toItem.itemType) {
      return { valid: false, message: '物品数据异常' };
    }
    if (fromItem.itemType !== toItem.itemType) {
      return { valid: false, message: '只能合成相同类型的物品' };
    }
    if (fromItem.level !== toItem.level) {
      return { valid: false, message: '只能合成相同等级的物品' };
    }
    if (energy < 1) {
      return { valid: false, message: '能量不足' };
    }
    return { valid: true, message: '' };
  },

  /**
   * 校验棋盘索引
   */
  validateBoardIndex(idx, maxSize) {
    if (typeof idx !== 'number' || idx < 0 || idx >= maxSize) {
      return { valid: false, message: '无效的棋盘位置' };
    }
    return { valid: true, message: '' };
  },

  /**
   * 校验金币是否足够
   */
  validateGold(currentGold, cost) {
    if (currentGold < cost) {
      return { valid: false, message: `金币不足，需要 ${cost} 金币` };
    }
    return { valid: true, message: '' };
  },

  /**
   * 校验升级条件
   */
  validateUpgrade(currentLevel, targetLevel, gold, rating, config) {
    if (targetLevel <= currentLevel) {
      return { valid: false, message: '不能降级' };
    }
    if (targetLevel > currentLevel + 1) {
      return { valid: false, message: '不能跳级升级' };
    }
    const req = config;
    if (!req) {
      return { valid: false, message: '无效的升级配置' };
    }
    if (gold < req.goldCost) {
      return { valid: false, message: `升级需要 ${req.goldCost} 金币` };
    }
    if (rating < req.minRating) {
      return { valid: false, message: `需要好评度 ${req.minRating}⭐` };
    }
    return { valid: true, message: '' };
  },

  /**
   * 校验昵称格式
   */
  validateNickName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, message: '昵称不能为空' };
    }
    if (name.length > 20) {
      return { valid: false, message: '昵称最多 20 个字符' };
    }
    return { valid: true, message: '' };
  },

  /**
   * 校验棋盘是否满
   */
  validateBoardNotFull(board) {
    if (!board) return { valid: false, message: '棋盘不存在' };
    const emptyCount = board.getEmptyCount ? board.getEmptyCount() : 0;
    if (emptyCount <= 0) {
      return { valid: false, message: '格子满了，卖出或合成腾出空间吧' };
    }
    return { valid: true, message: '' };
  },

  /**
   * 校验能量用于合成
   */
  validateEnergyForMerge(energy) {
    if (energy < 1) {
      return { valid: false, message: '能量不足，等待恢复或看广告获取' };
    }
    return { valid: true, message: '' };
  }
};

module.exports = validator;
