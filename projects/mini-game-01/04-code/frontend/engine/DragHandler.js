/**
 * DragHandler.js — 拖拽手势处理
 * touchstart/touchmove/touchend 完整的拖拽交互逻辑
 */
class DragHandler {
  /**
   * @param {object} canvas - Canvas 节点
   * @param {Board} board - 棋盘实例
   * @param {object} callbacks - { onDragStart, onDragMove, onDragEnd, onMerge, onServe, onDrop }
   */
  constructor(canvas, board, callbacks) {
    this.canvas = canvas;
    this.board = board;
    this.cb = callbacks || {};

    this.cellWidth = 0;
    this.cellHeight = 0;
    this.boardOffsetX = 0;
    this.boardOffsetY = 0;
    this.orderZoneTop = 0;
    this.orderZoneBottom = 0;

    this.dragState = null;
    this._longPressTimer = null;
    this._hasMoved = false;

    this._bindEvents();
  }

  /**
   * 设置棋盘在 Canvas 上的偏移和格子尺寸
   */
  setLayout(cellW, cellH, offsetX, offsetY, orderZoneTop, orderZoneBottom) {
    this.cellWidth = cellW;
    this.cellHeight = cellH;
    this.boardOffsetX = offsetX;
    this.boardOffsetY = offsetY;
    this.orderZoneTop = orderZoneTop;
    this.orderZoneBottom = orderZoneBottom;
  }

  _bindEvents() {
    // 使用 Canvas 2D 的事件绑定
    if (this.canvas.addEventListener) {
      this.canvas.addEventListener('touchstart', this._onTouchStart.bind(this));
      this.canvas.addEventListener('touchmove', this._onTouchMove.bind(this));
      this.canvas.addEventListener('touchend', this._onTouchEnd.bind(this));
      this.canvas.addEventListener('touchcancel', this._onTouchEnd.bind(this));
    }
  }

  /**
   * 解绑事件（页面卸载时调用）
   */
  destroy() {
    if (this.canvas.removeEventListener) {
      this.canvas.removeEventListener('touchstart', this._onTouchStart);
      this.canvas.removeEventListener('touchmove', this._onTouchMove);
      this.canvas.removeEventListener('touchend', this._onTouchEnd);
      this.canvas.removeEventListener('touchcancel', this._onTouchEnd);
    }
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
    }
  }

  /**
   * 像素坐标 → 格子索引
   */
  getCellIndex(x, y) {
    const relX = x - this.boardOffsetX;
    const relY = y - this.boardOffsetY;
    const col = Math.floor(relX / this.cellWidth);
    const row = Math.floor(relY / this.cellHeight);
    if (col < 0 || col >= this.board.cols || row < 0 || row >= this.board.rows) {
      return -1;
    }
    return row * this.board.cols + col;
  }

  /**
   * 获取格子中心像素坐标
   */
  getCellCenter(idx) {
    const row = Math.floor(idx / this.board.cols);
    const col = idx % this.board.cols;
    return {
      x: this.boardOffsetX + col * this.cellWidth + this.cellWidth / 2,
      y: this.boardOffsetY + row * this.cellHeight + this.cellHeight / 2
    };
  }

  /**
   * 判断触摸点是否在订单区域
   */
  _isInOrderZone(y) {
    return y >= this.orderZoneTop && y <= this.orderZoneBottom;
  }

  /**
   * 获取触摸点对应的订单索引
   */
  _getOrderIndex(x, y) {
    if (!this._isInOrderZone(y)) return -1;
    // 订单区横向排列，每个订单宽度约 1/3 屏宽
    const orderWidth = this.canvas.width / 3;
    return Math.floor(x / orderWidth);
  }

  _onTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const x = touch.x;
    const y = touch.y;

    const idx = this.getCellIndex(x, y);
    if (idx < 0 || !this.board.cells[idx]) {
      // 点击在棋盘外的空格
      if (this.cb.onTapEmpty) {
        this.cb.onTapEmpty(x, y);
      }
      return;
    }

    const item = this.board.cells[idx];
    this._hasMoved = false;

    // 延迟判断是否为长按（查看物品信息）
    this._longPressTimer = setTimeout(() => {
      if (!this._hasMoved && this.cb.onLongPress) {
        this.cb.onLongPress(item, idx);
      }
    }, 500);

    this.dragState = {
      item: item,
      fromIdx: idx,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      targetIdx: -1,
      highlightIdx: -1
    };

    if (this.cb.onDragStart) {
      this.cb.onDragStart(item, idx);
    }
  }

  _onTouchMove(e) {
    if (!this.dragState) return;
    if (!e.touches || e.touches.length === 0) return;

    const touch = e.touches[0];
    const dx = touch.x - this.dragState.startX;
    const dy = touch.y - this.dragState.startY;

    // 移动超过阈值（8px）才判定为拖拽
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;

    // 第一次超过阈值时触发触摸反馈（§8.3）
    if (!this._hasMoved) {
      wx.vibrateShort({ type: 'light' });
    }

    this._hasMoved = true;
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }

    this.dragState.currentX = touch.x;
    this.dragState.currentY = touch.y;

    // 计算当前手指所在的格子
    const targetIdx = this.getCellIndex(touch.x, touch.y);
    const orderIdx = this._isInOrderZone(touch.y)
      ? this._getOrderIndex(touch.x, touch.y)
      : -1;

    this.dragState.targetIdx = targetIdx;
    this.dragState.orderIdx = orderIdx;
    this.dragState.highlightIdx = targetIdx >= 0 ? targetIdx : -1;
    this.dragState.isOverOrder = orderIdx >= 0;

    if (this.cb.onDragMove) {
      this.cb.onDragMove(this.dragState);
    }
  }

  _onTouchEnd(e) {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }

    if (!this.dragState) return;

    const touch = (e.changedTouches && e.changedTouches.length > 0)
      ? e.changedTouches[0]
      : null;

    if (!touch || !this._hasMoved) {
      // 点击（未拖拽）
      if (this.cb.onTap && this.dragState) {
        this.cb.onTap(this.dragState.item, this.dragState.fromIdx);
      }
      this.dragState = null;
      if (this.cb.onDragEnd) this.cb.onDragEnd(null);
      return;
    }

    const toIdx = this.getCellIndex(touch.x, touch.y);
    const orderIdx = this._isInOrderZone(touch.y)
      ? this._getOrderIndex(touch.x, touch.y)
      : -1;

    const result = {
      fromIdx: this.dragState.fromIdx,
      fromItem: this.dragState.item,
      toIdx: toIdx,
      orderIdx: orderIdx,
      isOverOrder: orderIdx >= 0
    };

    // 拖到订单区 → 尝试上菜
    if (orderIdx >= 0 && toIdx < 0) {
      if (this.cb.onServe) {
        this.cb.onServe(this.dragState.fromIdx, orderIdx);
      }
    }
    // 拖到棋盘内
    else if (toIdx >= 0 && toIdx !== this.dragState.fromIdx) {
      if (this.cb.onDropTo) {
        this.cb.onDropTo(this.dragState.fromIdx, toIdx);
      }
    }
    // 弹回原位
    else {
      if (this.cb.onDrop) {
        this.cb.onDrop(this.dragState.fromIdx);
      }
    }

    if (this.cb.onDragEnd) {
      this.cb.onDragEnd(result);
    }

    this.dragState = null;
  }
}

module.exports = DragHandler;
