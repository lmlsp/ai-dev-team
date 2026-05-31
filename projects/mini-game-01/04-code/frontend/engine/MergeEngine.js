/**
 * MergeEngine.js — 合成规则引擎
 * 检查合成合法性、查询合成结果、加载菜谱配置
 */
const recipes = require('../config/recipes.json');

class MergeEngine {
  /** 初始化：构建快速查询索引 */
  static init() {
    this._linearMap = {};    // key: "itemType:level" → next step
    this._crossMap = {};     // key: sorted type pair → result
    this._terminals = {};    // itemType → recipe info
    this._allItems = {};     // itemType → display info

    for (const recipe of recipes) {
      // 线性合成链
      if (recipe.steps) {
        for (let i = 0; i < recipe.steps.length; i++) {
          const step = recipe.steps[i];
          const key = `${step.itemType}:${step.level}`;
          if (i < recipe.steps.length - 1) {
            this._linearMap[key] = recipe.steps[i + 1];
          }
          this._allItems[step.itemType] = step;
          if (step.isTerminal) {
            this._terminals[step.itemType] = recipe;
          }
        }
      }
      // 跨品类合成
      if (recipe.recipe && recipe.result) {
        const types = recipe.recipe.map(r => `${r.itemType}:${r.level}`).sort();
        const crossKey = types.join('+');
        this._crossMap[crossKey] = recipe.result;
        this._allItems[recipe.result.itemType] = recipe.result;
        if (recipe.result.isTerminal) {
          this._terminals[recipe.result.itemType] = recipe;
        }
      }
    }
    console.log('[MergeEngine] 初始化完成，加载', recipes.length, '条菜谱');
  }

  /**
   * 检查两个物品是否可合成
   * @param {object} itemA - { itemType, level }
   * @param {object} itemB - { itemType, level }
   * @returns {boolean}
   */
  static canMerge(itemA, itemB) {
    if (!itemA || !itemB) return false;
    if (itemA.itemType !== itemB.itemType) return false;
    if (itemA.level !== itemB.level) return false;
    // 已到合成链末端则不可再合成
    return !!this.getNextLevel(itemA);
  }

  /**
   * 获取合成结果（线性链的下一个等级）
   * @param {object} item - { itemType, level }
   * @returns {object|null} - { itemType, level, display, isTerminal }
   */
  static getNextLevel(item) {
    if (!item) return null;
    const key = `${item.itemType}:${item.level}`;
    return this._linearMap[key] || null;
  }

  /**
   * 检查物品是否可上菜（终端菜品）
   */
  static isServable(itemType) {
    return !!this._terminals[itemType];
  }

  /**
   * 获取完整合成结果（包括跨品类合成）
   * @param {object} itemA
   * @param {object} itemB
   * @returns {object|null} - 合成结果物品
   */
  static getMergeResult(itemA, itemB) {
    // 1. 检查线性合成
    if (itemA.itemType === itemB.itemType && itemA.level === itemB.level) {
      const next = this.getNextLevel(itemA);
      if (next) return next;
    }

    // 2. 检查跨品类合成
    const types = [
      `${itemA.itemType}:${itemA.level}`,
      `${itemB.itemType}:${itemB.level}`
    ].sort();
    const crossKey = types.join('+');
    if (this._crossMap[crossKey]) {
      return this._crossMap[crossKey];
    }

    // 反向检查（顺序无关）
    const reverseKey = types.reverse().join('+');
    if (this._crossMap[reverseKey]) {
      return this._crossMap[reverseKey];
    }

    return null;
  }

  /**
   * 获取物品的合成链信息
   * @param {string} itemType
   * @returns {object|null}
   */
  static getRecipeChain(itemType) {
    for (const recipe of recipes) {
      if (recipe.steps) {
        for (const step of recipe.steps) {
          if (step.itemType === itemType) return recipe;
        }
      }
      if (recipe.result && recipe.result.itemType === itemType) return recipe;
    }
    return null;
  }

  /**
   * 获取所有可上菜的终端菜品列表
   */
  static getServableRecipes() {
    return Object.values(this._terminals);
  }

  /**
   * 根据菜系获取菜谱
   * @param {string} cuisine - 菜系名称
   */
  static getRecipesByCuisine(cuisine) {
    return recipes.filter(r => r.cuisine === cuisine);
  }

  /**
   * 获取菜品显示名称
   */
  static getDisplayName(itemType) {
    const info = this._allItems[itemType];
    return info ? (info.display || info.name || itemType) : itemType;
  }

  /**
   * 获取菜品信息
   */
  static getItemInfo(itemType) {
    return this._allItems[itemType] || null;
  }
}

// 加载时自动初始化
MergeEngine.init();

module.exports = MergeEngine;
