/**
 * Board.js — 棋盘数据结构
 * 管理棋盘格子的增删改查、序列化/反序列化
 */
class Board {
  /**
   * @param {number} rows - 行数
   * @param {number} cols - 列数
   */
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.cells = new Array(rows * cols).fill(null);
    this._idCounter = 0;
  }

  /**
   * 从存档恢复棋盘
   * @param {object} saved - 序列化的棋盘数据
   */
  init(saved) {
    if (saved) {
      this._restore(saved);
    } else {
      this.cells = new Array(this.rows * this.cols).fill(null);
      this._idCounter = 0;
    }
  }

  /**
   * 根据行列获取格子索引
   */
  getIndex(row, col) {
    return row * this.cols + col;
  }

  /**
   * 根据索引获取行列
   */
  getRowCol(idx) {
    return { row: Math.floor(idx / this.cols), col: idx % this.cols };
  }

  /**
   * 获取指定位置的物品
   */
  getCell(idx) {
    if (idx < 0 || idx >= this.cells.length) return null;
    return this.cells[idx];
  }

  /**
   * 放置物品到指定位置
   * @param {number} idx - 格子索引
   * @param {object} item - { itemType, level }
   * @returns {boolean} 是否放置成功
   */
  placeItem(idx, item) {
    if (idx < 0 || idx >= this.cells.length) return false;
    if (this.cells[idx]) return false;
    this.cells[idx] = {
      itemType: item.itemType,
      level: item.level,
      id: ++this._idCounter
    };
    return true;
  }

  /**
   * 生成随机物品到空格
   * @param {string} itemType - 物品类型
   * @param {number} level - 物品等级
   * @returns {number|null} 放置的格子索引，失败返回 null
   */
  generateItem(itemType, level) {
    const emptyIdx = this._findRandomEmpty();
    if (emptyIdx < 0) return null;
    this.placeItem(emptyIdx, { itemType, level: level || 0 });
    return emptyIdx;
  }

  /**
   * 在指定位置生成物品
   * @param {number} idx
   * @param {string} itemType
   * @param {number} level
   */
  generateItemAt(idx, itemType, level) {
    if (this.cells[idx]) return false;
    this.cells[idx] = {
      itemType: itemType,
      level: level || 0,
      id: ++this._idCounter
    };
    return true;
  }

  /**
   * 移除指定格子的物品
   * @param {number} idx
   */
  removeCell(idx) {
    if (idx < 0 || idx >= this.cells.length) return null;
    const item = this.cells[idx];
    this.cells[idx] = null;
    return item;
  }

  /**
   * 交换两个格子的物品
   */
  swapCells(fromIdx, toIdx) {
    if (fromIdx < 0 || fromIdx >= this.cells.length) return false;
    if (toIdx < 0 || toIdx >= this.cells.length) return false;
    const temp = this.cells[fromIdx];
    this.cells[fromIdx] = this.cells[toIdx];
    this.cells[toIdx] = temp;
    return true;
  }

  /**
   * 尝试合成 fromIdx --> toIdx
   * @param {number} fromIdx - 被拖拽的物品位置
   * @param {number} toIdx - 目标位置
   * @returns {{ merged: boolean, newItem?: object, removedFrom?: number }}
   */
  tryMerge(fromIdx, toIdx) {
    const from = this.cells[fromIdx];
    const to = this.cells[toIdx];
    if (!from || !to) return { merged: false };
    if (!from.itemType || !to.itemType) return { merged: false };
    if (from.itemType !== to.itemType) return { merged: false };
    if (from.level !== to.level) return { merged: false };

    // 允许外部设置合成结果（由 MergeEngine 判定）
    // 这里只做基本校验，具体规则由 MergeEngine 处理
    return { merged: true, fromItem: from, toItem: to, fromIdx, toIdx };
  }

  /**
   * 将物品移动到空格（不合成）
   */
  tryMove(fromIdx, toIdx) {
    if (fromIdx === toIdx) return false;
    if (this.cells[toIdx]) return false;
    if (!this.cells[fromIdx]) return false;
    this.cells[toIdx] = this.cells[fromIdx];
    this.cells[fromIdx] = null;
    return true;
  }

  /**
   * 查找空格
   */
  findEmptySlots(count) {
    const slots = [];
    for (let i = 0; i < this.cells.length; i++) {
      if (!this.cells[i]) slots.push(i);
      if (count && slots.length >= count) break;
    }
    return slots;
  }

  /**
   * 获取空格数量
   */
  getEmptyCount() {
    let count = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (!this.cells[i]) count++;
    }
    return count;
  }

  /**
   * 是否已满
   */
  isFull() {
    return this.getEmptyCount() === 0;
  }

  /**
   * 扩展棋盘
   */
  expand(rows, cols) {
    const oldCells = this.cells;
    const newCells = new Array(rows * cols).fill(null);
    for (let r = 0; r < Math.min(this.rows, rows); r++) {
      for (let c = 0; c < Math.min(this.cols, cols); c++) {
        newCells[r * cols + c] = oldCells[r * this.cols + c];
      }
    }
    this.rows = rows;
    this.cols = cols;
    this.cells = newCells;
  }

  /**
   * 序列化为可存储/传输的格式
   */
  toJSON() {
    return {
      rows: this.rows,
      cols: this.cols,
      cells: this.cells.map(c => c ? { t: c.itemType, l: c.level, i: c.id } : null),
      idc: this._idCounter
    };
  }

  /**
   * 从序列化数据恢复
   */
  fromJSON(data) {
    this._restore(data);
  }

  // ========== 私有方法 ==========

  _findRandomEmpty() {
    const empties = this.findEmptySlots();
    if (empties.length === 0) return -1;
    return empties[Math.floor(Math.random() * empties.length)];
  }

  _restore(saved) {
    this.rows = saved.rows || 6;
    this.cols = saved.cols || 5;
    this._idCounter = saved.idc || 0;
    const total = this.rows * this.cols;
    this.cells = new Array(total).fill(null);
    if (saved.cells && Array.isArray(saved.cells)) {
      for (let i = 0; i < Math.min(saved.cells.length, total); i++) {
        const c = saved.cells[i];
        if (c) {
          this.cells[i] = { itemType: c.t, level: c.l, id: c.i };
        }
      }
    }
  }
}

module.exports = Board;
