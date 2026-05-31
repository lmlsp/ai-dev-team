/**
 * home.js — 主界面（核心页面）
 * Canvas 棋盘渲染 + 订单队列 + 底部操作栏
 * 游戏主循环：requestAnimationFrame 60fps render loop
 */
const Board = require('../../engine/Board');
const MergeEngine = require('../../engine/MergeEngine');
const DragHandler = require('../../engine/DragHandler');
const OrderManager = require('../../engine/OrderManager');
const ParticleEmitter = require('../../engine/ParticleEmitter');
const adManager = require('../../services/ad');
const api = require('../../services/api');
const i18n = require('../../utils/i18n');
const validator = require('../../utils/validator');
const storage = require('../../utils/storage');

const INFO_BAR_HEIGHT = 88;    // 顶部状态栏高度（px）
const ORDER_ZONE_HEIGHT = 160; // 订单区高度
const BOTTOM_BAR_HEIGHT = 112; // 底部操作栏高度
const CELL_PADDING = 4;
const GRID_LINE_WIDTH = 2;

Page({
  data: {
    // 顶部信息
    user: { nickName: '小厨神', avatarUrl: '', isGuest: true },
    gold: 100,
    rating: 3.0,
    restaurantLevel: 1,
    restaurantName: '街边小摊',
    energy: 100,
    maxEnergy: 100,

    // 系统信息
    statusBarHeight: 20,
    safeAreaBottom: 0,

    // 订单区
    orders: [],

    // 底部按钮
    isSellMode: false,
    showUpgradeModal: false,

    // 提示
    toastText: '',
    toastVisible: false
  },

  // ========== 生命周期 ==========

  onLoad() {
    const app = getApp();
    this.gameStore = app.gameStore;

    // 系统信息（safe-area 适配）
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      safeAreaBottom: sysInfo.safeAreaInsets ? sysInfo.safeAreaInsets.bottom : 0
    });

    // 从 gameStore 同步初始状态
    this._syncFromStore();

    // 初始化游戏引擎
    this._initEngine();

    // 绑定 Canvas 触摸事件（在 WXML 中通过 bindtouchstart 等绑定）
    // 实际触摸由 DragHandler 在 Canvas 上处理
  },

  onReady() {
    // Canvas 节点就绪后初始化渲染
    this._initCanvas();
  },

  onShow() {
    // 恢复 render loop
    if (this._canvasReady) {
      this._startRenderLoop();
    }
    // 刷新能量显示
    if (this.gameStore) {
      this.gameStore.refreshEnergy();
      this._syncFromStore();
    }
  },

  onHide() {
    // 暂停 render loop
    this._stopRenderLoop();
    // 保存状态
    this._saveState();
  },

  onUnload() {
    this._stopRenderLoop();
    if (this.dragHandler) this.dragHandler.destroy();
    if (this.particles) this.particles.stop();
    if (this.orderManager) this._saveState();
    // 解绑 gameStore 监听
    if (this._unsubscribers) {
      this._unsubscribers.forEach(fn => fn());
    }
  },

  // ========== 分享 ==========

  onShareAppMessage() {
    return {
      title: i18n.t('app.name') + ' — ' + i18n.t('app.slogan'),
      path: '/pages/loading/loading'
    };
  },

  // ========== 初始化 ==========

  _syncFromStore() {
    if (!this.gameStore) return;
    const state = this.gameStore.getState();
    this.setData({
      user: state.user,
      gold: state.gold,
      rating: state.rating,
      restaurantLevel: state.restaurantLevel,
      energy: state.energy,
      'orders': state.orders || []
    });
    // 同步餐厅名称
    try {
      const levels = require('../../config/restaurant-levels.json');
      const levelInfo = levels.find(l => l.level === state.restaurantLevel);
      if (levelInfo) {
        this.setData({ restaurantName: levelInfo.name, maxEnergy: levelInfo.maxEnergy || 100 });
      }
    } catch (e) { /* ignore */ }
  },

  _initEngine() {
    // 棋盘
    const state = this.gameStore.getState();
    const boardData = state.board;
    const rows = (boardData && boardData.rows) || 6;
    const cols = (boardData && boardData.cols) || 5;
    this.board = new Board(rows, cols);
    this.board.init(boardData && boardData.cells ? boardData : null);

    // 如果棋盘为空，生成初始食材
    if (this.board.getEmptyCount() === rows * cols) {
      this._generateInitialItems();
    }

    // 粒子特效
    this.particles = new ParticleEmitter();

    // 订单管理
    this.orderManager = new OrderManager();
    this._loadOrders();

    // 监听 gameStore 变化
    this._bindStoreListeners();

    // 食材自动生成计时器
    this._autoGenInterval = 30000;
    this._autoGenTimer = null;
    this._startAutoGenerate();
  },

  /**
   * 生成初始食材（新手或空棋盘）
   */
  _generateInitialItems() {
    const initialItems = [
      { type: 'tomato', level: 0 },
      { type: 'tomato', level: 0 },
      { type: 'egg', level: 0 },
      { type: 'egg', level: 0 },
      { type: 'rice', level: 0 },
      { type: 'flour', level: 0 },
      { type: 'potato', level: 0 },
      { type: 'cabbage', level: 0 }
    ];
    for (const item of initialItems) {
      this.board.generateItem(item.type, item.level);
    }
  },

  /**
   * 加载当前订单
   */
  _loadOrders() {
    const state = this.gameStore.getState();
    const unlockedIds = state.unlockedRecipes || [];
    const unlocked = [];
    try {
      const recipes = require('../../config/recipes.json');
      for (const r of recipes) {
        if (unlockedIds.includes(r.chainId)) unlocked.push(r);
      }
    } catch (e) { /* ignore */ }
    this.orderManager.generateOrders(unlocked.length > 0 ? unlocked : null, 3);
    this._updateOrderDisplay();
  },

  _bindStoreListeners() {
    this._unsubscribers = [];
    const store = this.gameStore;

    this._unsubscribers.push(store.on('gold', (val) => {
      this.setData({ gold: val });
    }));
    this._unsubscribers.push(store.on('energy', (val) => {
      this.setData({ energy: val });
    }));
    this._unsubscribers.push(store.on('rating', (val) => {
      this.setData({ rating: val });
    }));
    this._unsubscribers.push(store.on('user', (val) => {
      this.setData({ user: val });
    }));
    this._unsubscribers.push(store.on('restaurantLevel', (val) => {
      this.setData({ restaurantLevel: val });
    }));
  },

  /**
   * 自动生成食材（每 30 秒）
   */
  _startAutoGenerate() {
    this._autoGenTimer = setInterval(() => {
      if (this.board.isFull()) return;
      const types = ['tomato', 'egg', 'rice', 'flour', 'potato', 'cabbage'];
      const t = types[Math.floor(Math.random() * types.length)];
      const idx = this.board.generateItem(t, 0);
      if (idx >= 0) {
        // 记录生成动画（§5.6 食材生成动画 — 300ms 气泡冒出）
        this._spawnItems = this._spawnItems || [];
        this._spawnItems.push({ idx, startTime: Date.now(), duration: 300 });
        console.log('[Home] 自动生成食材:', t, '位置:', idx);
      }
    }, this._autoGenInterval);
  },

  // ========== Canvas 初始化 ==========

  _initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) {
          console.error('[Home] Canvas 节点获取失败');
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        const dpr = wx.getSystemInfoSync().pixelRatio;
        const width = res[0].width;
        const height = res[0].height;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        this.canvas = canvas;
        this.ctx = ctx;
        this.canvasWidth = width;
        this.canvasHeight = height;

        // 计算布局
        this._calcLayout();

        // 初始化拖拽处理器
        this.dragHandler = new DragHandler(canvas, this.board, {
          onDragStart: (item, idx) => {
            // 触发重绘
          },
          onDragMove: (state) => {
            // 由 render loop 自动绘制
          },
          onDragEnd: (result) => {
            // 拖拽结束
          },
          onDropTo: (fromIdx, toIdx) => {
            this._handleDropTo(fromIdx, toIdx);
          },
          onServe: (fromIdx, orderIdx) => {
            this._handleServe(fromIdx, orderIdx);
          },
          onDrop: (idx) => {
            // 弹回原位，无需额外处理
          },
          onTap: (item, idx) => {
            this._handleTap(item, idx);
          },
          onLongPress: (item, idx) => {
            this._handleLongPress(item, idx);
          }
        });

        // 更新拖拽布局信息
        this.dragHandler.setLayout(
          this.cellSize, this.cellSize,
          this.boardOffsetX, this.boardOffsetY,
          this.orderZoneY, this.orderZoneY + ORDER_ZONE_HEIGHT
        );

        this._canvasReady = true;
        this._startRenderLoop();

        console.log('[Home] Canvas 初始化完成', width, 'x', height);
      });
  },

  /**
   * 计算棋盘布局
   */
  _calcLayout() {
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    const boardAreaTop = INFO_BAR_HEIGHT + ORDER_ZONE_HEIGHT;
    const boardAreaBottom = h - BOTTOM_BAR_HEIGHT;
    const boardAreaHeight = boardAreaBottom - boardAreaTop;
    const boardAreaWidth = w - 20; // 左右留 10px 边距

    // 格子大小（取宽高中的较小值来适配）
    const cellW = Math.floor((boardAreaWidth - (this.board.cols + 1) * CELL_PADDING) / this.board.cols);
    const cellH = Math.floor((boardAreaHeight - (this.board.rows + 1) * CELL_PADDING) / this.board.rows);
    const cellSize = Math.min(cellW, cellH);

    // 棋盘总尺寸
    const boardW = cellSize * this.board.cols + (this.board.cols + 1) * CELL_PADDING;
    const boardH = cellSize * this.board.rows + (this.board.rows + 1) * CELL_PADDING;

    // 居中偏移
    const offsetX = (w - boardW) / 2;
    const offsetY = boardAreaTop + (boardAreaHeight - boardH) / 2;

    this.cellSize = cellSize;
    this.boardOffsetX = offsetX;
    this.boardOffsetY = offsetY;
    this.boardPixelW = boardW;
    this.boardPixelH = boardH;

    // 订单区 Y 范围
    this.orderZoneY = INFO_BAR_HEIGHT;
  },

  // ========== Render Loop ==========

  _startRenderLoop() {
    if (this._running) return;
    this._running = true;
    this._lastFrameTime = Date.now();

    const loop = () => {
      if (!this._running) return;

      const now = Date.now();
      const delta = (now - this._lastFrameTime) / 1000; // 秒
      this._lastFrameTime = now;

      this._render(delta);
      this._rafId = requestAnimationFrame(loop);
    };

    // 微信小程序 Canvas 使用 canvas.requestAnimationFrame
    if (this.canvas && this.canvas.requestAnimationFrame) {
      const canvasLoop = () => {
        if (!this._running) return;
        const now = Date.now();
        const delta = (now - this._lastFrameTime) / 1000;
        this._lastFrameTime = now;
        this._render(delta);
        this._rafId = this.canvas.requestAnimationFrame(canvasLoop);
      };
      this._rafId = this.canvas.requestAnimationFrame(canvasLoop);
    } else {
      // 降级为全局 requestAnimationFrame
      this._rafId = requestAnimationFrame(loop);
    }
  },

  _stopRenderLoop() {
    this._running = false;
    if (this._rafId) {
      if (this.canvas && this.canvas.cancelAnimationFrame) {
        this.canvas.cancelAnimationFrame(this._rafId);
      } else {
        cancelAnimationFrame(this._rafId);
      }
      this._rafId = null;
    }
  },

  /**
   * 主渲染函数（每帧调用）
   */
  _render(delta) {
    const ctx = this.ctx;
    if (!ctx) return;

    const w = this.canvasWidth;
    const h = this.canvasHeight;

    // 1. 清空画布
    ctx.clearRect(0, 0, w, h);

    // 2. 绘制背景色
    ctx.fillStyle = '#FFF8F0';
    ctx.fillRect(0, 0, w, h);

    // 3. 绘制订单区背景和顾客
    this._drawOrderZone(ctx);

    // 4. 绘制棋盘背景
    this._drawBoardBackground(ctx);

    // 5. 绘制棋盘网格
    this._drawGrid(ctx);

    // 6. 绘制所有食材
    this._drawAllItems(ctx);

    // 7. 绘制高亮目标格
    this._drawHighlight(ctx);

    // 8. 绘制拖拽中的食材
    this._drawDraggingItem(ctx);

    // 9. 绘制粒子特效
    if (this.particles && this.particles.isActive()) {
      this.particles.update(delta);
      this.particles.draw(ctx);
    }

    // 10. 绘制物品生成动画（§5.6 — 气泡冒出）
    this._drawSpawnAnimations(ctx);

    // 11. 绘制合成回弹动画（§7.1）
    this._drawMergeBounce(ctx);

    // 12. 绘制金币飘字 "+N"（§7.1）
    this._drawGoldFloats(ctx);

    // 13. 更新订单倒计时
    this._updateOrderTimers(delta);
  },

  /**
   * 绘制物品生成动画 — 气泡从底部冒出（§5.6）
   * translateY: +20px → -8px → 0, scale: 0.3 → 1.15 → 1.0, 300ms
   */
  _drawSpawnAnimations(ctx) {
    if (!this._spawnItems || this._spawnItems.length === 0) return;
    const now = Date.now();
    const remaining = [];

    for (const si of this._spawnItems) {
      const elapsed = now - si.startTime;
      if (elapsed >= si.duration) continue;

      const progress = elapsed / si.duration;
      // ease-out-back 模拟: cubic-bezier(0.34, 1.56, 0.64, 1)
      const t = progress;
      const ease = 1 - Math.pow(1 - t, 3);
      const back = 1 + 1.56 * Math.sin(t * Math.PI) * (1 - t);

      // translateY: +20 → -8 → 0
      let ty;
      if (progress < 0.5) {
        ty = 20 * (1 - progress * 2); // 20→0 at midpoint
      } else if (progress < 0.83) {
        ty = -8 * ((progress - 0.5) / 0.33); // 0→-8 overshoot
      } else {
        ty = -8 * (1 - (progress - 0.83) / 0.17); // -8→0 settle
      }

      // scale: 0.3 → 1.15 → 1.0
      let sc;
      if (progress < 0.5) {
        sc = 0.3 + 0.85 * (progress * 2);
      } else {
        sc = 1.15 - 0.15 * ((progress - 0.5) / 0.5);
      }

      // alpha: 0→1 (first 100ms)
      const alpha = Math.min(1, progress * 3);

      const cell = this.board.getCell(si.idx);
      if (cell) {
        const r = Math.floor(si.idx / this.board.cols);
        const c = si.idx % this.board.cols;
        const cellSize = this.cellSize;
        const pad = CELL_PADDING;
        const cx = this.boardOffsetX + c * (cellSize + pad) + pad;
        const cy = this.boardOffsetY + r * (cellSize + pad) + pad;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(cx + cellSize / 2, cy + cellSize / 2 + ty);
        ctx.scale(sc, sc);
        ctx.translate(-(cx + cellSize / 2), -(cy + cellSize / 2));
        this._drawItem(ctx, cell, cx, cy, cellSize, false);
        ctx.restore();
      }
      remaining.push(si);
    }
    this._spawnItems = remaining;
  },

  /**
   * 绘制合成回弹动画（§7.1 — 200ms ease-out-back）
   */
  _drawMergeBounce(ctx) {
    if (!this._mergeBounceCells || this._mergeBounceCells.length === 0) return;
    const now = Date.now();
    const remaining = [];

    for (const mb of this._mergeBounceCells) {
      const elapsed = now - mb.startTime;
      if (elapsed >= mb.duration) continue;

      const progress = elapsed / mb.duration;
      // ease-out-back: overshoot then settle
      const scale = 1 + 0.15 * Math.sin(progress * Math.PI) * (1 - progress);

      const cell = this.board.getCell(mb.idx);
      if (cell) {
        const r = Math.floor(mb.idx / this.board.cols);
        const c = mb.idx % this.board.cols;
        const cellSize = this.cellSize;
        const pad = CELL_PADDING;
        const cx = this.boardOffsetX + c * (cellSize + pad) + pad;
        const cy = this.boardOffsetY + r * (cellSize + pad) + pad;

        ctx.save();
        ctx.translate(cx + cellSize / 2, cy + cellSize / 2);
        ctx.scale(scale, scale);
        ctx.translate(-(cx + cellSize / 2), -(cy + cellSize / 2));
        this._drawItem(ctx, cell, cx, cy, cellSize, false);
        ctx.restore();
      }
      remaining.push(mb);
    }
    this._mergeBounceCells = remaining;
  },

  /**
   * 绘制金币飘字 "+N" 动画（§7.1 — 上飘 40px 后淡出，持续 1000ms）
   */
  _drawGoldFloats(ctx) {
    if (!this._goldFloats || this._goldFloats.length === 0) return;
    const now = Date.now();
    const remaining = [];

    for (const gf of this._goldFloats) {
      const elapsed = (now - gf.startTime) / 1000;
      if (elapsed >= gf.duration / 1000) continue;

      const progress = elapsed / (gf.duration / 1000);
      const alpha = 1 - progress;
      const offsetY = -40 * progress; // 上飘 40px

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFB347';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+' + gf.amount, gf.x, gf.y + offsetY);
      ctx.restore();

      remaining.push(gf);
    }
    this._goldFloats = remaining;
  },

  // ========== 绘制函数 ==========

  _drawOrderZone(ctx) {
    const y = this.orderZoneY;
    const w = this.canvasWidth;
    const h = ORDER_ZONE_HEIGHT;

    // 订单区背景 — 暖白底
    ctx.fillStyle = '#FFF8F2';
    ctx.fillRect(0, y, w, h);
    // 底部分割线 — 暖灰
    ctx.strokeStyle = '#EDE4DA';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + h);
    ctx.lineTo(w, y + h);
    ctx.stroke();

    // 标题
    ctx.fillStyle = '#8B6F5F';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(i18n.t('home.today_customers') || '今日顾客', 12, y + 18);

    // 绘制顾客卡片
    const orders = this.orderManager ? this.orderManager.orders : [];
    const cardWidth = Math.min(200, (w - 40) / 3);
    const startX = (w - cardWidth * Math.min(orders.length, 3)) / 2;

    for (let i = 0; i < Math.min(orders.length, 3); i++) {
      const order = orders[i];
      const cx = startX + i * (cardWidth + 8);
      const cy = y + 30;

      // 卡片背景
      if (order.completed) {
        ctx.fillStyle = '#E8F5E9';
      } else if (order.timedOut) {
        ctx.fillStyle = '#FFEBEE';
      } else if (order.remaining < 15) {
        ctx.fillStyle = '#FFF3E0';
      } else {
        ctx.fillStyle = '#FFFFFF';
      }
      ctx.strokeStyle = '#E0D5C5';
      ctx.lineWidth = 1;
      this._roundRect(ctx, cx, cy, cardWidth, h - 40, 8);
      ctx.fill();
      ctx.stroke();

      if (order.completed) {
        // 已完成
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓ 完成', cx + cardWidth / 2, cy + 50);
        continue;
      }
      if (order.timedOut) {
        ctx.fillStyle = '#F44336';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✗ 超时', cx + cardWidth / 2, cy + 50);
        continue;
      }

      // 顾客头像（emoji）
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(order.customer.avatar || '👤', cx + cardWidth / 2, cy + 28);

      // 顾客名称
      ctx.fillStyle = '#2C1810';
      ctx.font = '12px sans-serif';
      ctx.fillText(order.customer.name || '顾客', cx + cardWidth / 2, cy + 48);

      // 菜品名
      ctx.fillStyle = '#FF6B35';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(order.recipeName || '菜品', cx + cardWidth / 2, cy + 70);

      // 倒计时
      const remaining = Math.ceil(order.remaining);
      ctx.fillStyle = remaining < 15 ? '#FF5252' : '#8B6F5F';
      ctx.font = '14px sans-serif';
      ctx.fillText('⏱' + remaining + 's', cx + cardWidth / 2, cy + 92);

      // 进度条
      const barW = cardWidth - 20;
      const barH = 4;
      const barX = cx + 10;
      const barY = cy + 105;
      const progress = order.remaining / order.timeLimit;
      ctx.fillStyle = '#EDE4DA';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = progress > 0.25 ? '#4CAF50' : '#FF5252';
      ctx.fillRect(barX, barY, barW * progress, barH);
    }
  },

  _drawBoardBackground(ctx) {
    const x = this.boardOffsetX - 4;
    const y = this.boardOffsetY - 4;
    const w = this.boardPixelW + 8;
    const h = this.boardPixelH + 8;

    // 木纹色背景（§5.2 格子详细参数 — 底板颜色 #F5E6D8）
    ctx.fillStyle = '#F5E6D8';
    this._roundRect(ctx, x, y, w, h, 12);
    ctx.fill();

    // 暖灰分割线边框
    ctx.strokeStyle = '#EDE4DA';
    ctx.lineWidth = 2;
    this._roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
  },

  _drawGrid(ctx) {
    const cellSize = this.cellSize;
    const pad = CELL_PADDING;
    const ox = this.boardOffsetX;
    const oy = this.boardOffsetY;

    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const cx = ox + c * (cellSize + pad) + pad;
        const cy = oy + r * (cellSize + pad) + pad;

        const idx = r * this.board.cols + c;
        const hasItem = this.board.cells[idx] != null;

        if (hasItem) {
          // 有食材：白色底 + 柔阴影（§5.2）
          ctx.fillStyle = '#FFFFFF';
          this._roundRect(ctx, cx, cy, cellSize, cellSize, 8);
          ctx.fill();
          ctx.strokeStyle = '#EDE4DA';
          ctx.lineWidth = 0.5;
          this._roundRect(ctx, cx, cy, cellSize, cellSize, 8);
          ctx.stroke();
        } else {
          // 空格子：底板色 + 内凹阴影效果（§4.1）
          ctx.fillStyle = '#F5E6D8';
          this._roundRect(ctx, cx, cy, cellSize, cellSize, 8);
          ctx.fill();
          // 内凹阴影模拟
          ctx.strokeStyle = 'rgba(0,0,0,0.06)';
          ctx.lineWidth = 2;
          this._roundRect(ctx, cx + 1, cy + 1, cellSize - 2, cellSize - 2, 8);
          ctx.stroke();
          // 虚线暗示（无网格线设计，但给出轻微视觉参考）
          ctx.strokeStyle = 'rgba(0,0,0,0.04)';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([2, 6]);
          this._roundRect(ctx, cx + 0.5, cy + 0.5, cellSize - 1, cellSize - 1, 8);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  },

  _drawAllItems(ctx) {
    const cellSize = this.cellSize;
    const pad = CELL_PADDING;
    const ox = this.boardOffsetX;
    const oy = this.boardOffsetY;
    const dragIdx = (this.dragHandler && this.dragHandler.dragState)
      ? this.dragHandler.dragState.fromIdx : -1;

    for (let i = 0; i < this.board.cells.length; i++) {
      const cell = this.board.cells[i];
      if (!cell || i === dragIdx) continue;

      const r = Math.floor(i / this.board.cols);
      const c = i % this.board.cols;
      const cx = ox + c * (cellSize + pad) + pad;
      const cy = oy + r * (cellSize + pad) + pad;

      this._drawItem(ctx, cell, cx, cy, cellSize);
    }
  },

  /**
   * 绘制单个食材（§4.1 / §4.2 等级视觉层级）
   */
  _drawItem(ctx, item, cx, cy, size, isDragging) {
    if (!item) return;

    const info = MergeEngine.getItemInfo(item.itemType);
    const displayName = info ? info.display : item.itemType;
    const emoji = info ? info.emoji : '❓';
    const isTerminal = info && info.isTerminal;
    const level = item.level || 0;

    // === 等级底衬绘制 ===
    const baseSize = size * (0.6 + level * 0.05); // Lv.0: 60%, Lv.4: 80%
    const baseCX = cx + size / 2;
    const baseCY = cy + size / 2;

    if (level >= 3) {
      // Lv.3: 金色渐变圆底 + 发光（§4.2.1）
      const grad = ctx.createRadialGradient(baseCX, baseCY, baseSize * 0.3, baseCX, baseCY, baseSize * 0.7);
      grad.addColorStop(0, '#FFD700');
      grad.addColorStop(1, '#FFB347');
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(255, 179, 71, 0.4)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(baseCX, baseCY, baseSize * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (level >= 2) {
      // Lv.2: 暖橙色圆底 + 细阴影（§4.2.1）
      ctx.fillStyle = '#FFF3E0';
      ctx.shadowColor = 'rgba(45, 24, 10, 0.12)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.arc(baseCX, baseCY, baseSize * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    } else if (level >= 1) {
      // Lv.1: 白色圆底 + 1px 浅边框（§4.2.1）
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#EDE4DA';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(baseCX, baseCY, baseSize * 0.44, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // === 等级边框 ===
    if (level >= 4) {
      // Lv.4: 彩虹边框旋转（呼吸光晕）
      ctx.strokeStyle = '#FF6B35';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(255, 107, 53, 0.3)';
      ctx.shadowBlur = 6;
      this._roundRect(ctx, cx, cy, size, size, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (level >= 3) {
      // Lv.3: 金色虚线边框
      ctx.strokeStyle = '#FFB347';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      this._roundRect(ctx, cx, cy, size, size, 8);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (level >= 2) {
      // Lv.2: 边框渐变暖橙色
      ctx.strokeStyle = '#FFB347';
      ctx.lineWidth = 1.5;
      this._roundRect(ctx, cx, cy, size, size, 8);
      ctx.stroke();
    } else if (isTerminal) {
      // 终端菜品特殊金框
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      this._roundRect(ctx, cx, cy, size, size, 8);
      ctx.stroke();
    } else if (level === 0 && !isDragging) {
      // Lv.0: 微弱边框
      ctx.strokeStyle = 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 0.5;
      this._roundRect(ctx, cx, cy, size, size, 8);
      ctx.stroke();
    }

    // === Emoji 图标 ===
    const iconSize = Math.min(size * 0.48, 36);
    ctx.font = `${iconSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx + size / 2, cy + size * 0.4);

    // === 物品名称 ===
    ctx.fillStyle = '#2C1810';
    const fontSize = Math.min(size * 0.14, 11);
    ctx.font = `400 ${fontSize}px sans-serif`;
    ctx.fillText(displayName, cx + size / 2, cy + size * 0.73);

    // === 等级角标（右下角 §4.2.1）===
    if (level >= 1) {
      const badgeR = Math.min(size * 0.13, 8);
      const badgeX = cx + size - badgeR - 2;
      const badgeY = cy + size - badgeR - 2;
      ctx.fillStyle = '#FF6B35';
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 ${badgeR * 1.2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(level, badgeX, badgeY);
    }
  },

  _drawHighlight(ctx) {
    const ds = this.dragHandler ? this.dragHandler.dragState : null;
    if (!ds || ds.highlightIdx < 0) return;

    const idx = ds.highlightIdx;
    const r = Math.floor(idx / this.board.cols);
    const c = idx % this.board.cols;
    const cellSize = this.cellSize;
    const pad = CELL_PADDING;
    const cx = this.boardOffsetX + c * (cellSize + pad) + pad;
    const cy = this.boardOffsetY + r * (cellSize + pad) + pad;

    // 高亮背景 #FFF0E8（§4.1 可合成高亮）
    ctx.fillStyle = 'rgba(255, 240, 232, 0.7)';
    this._roundRect(ctx, cx, cy, cellSize, cellSize, 8);
    ctx.fill();

    // 橙色虚线边框 #FF6B35
    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    this._roundRect(ctx, cx, cy, cellSize, cellSize, 8);
    ctx.stroke();
    ctx.setLineDash([]);

    // 发光外扩
    ctx.strokeStyle = 'rgba(255, 107, 53, 0.2)';
    ctx.lineWidth = 5;
    this._roundRect(ctx, cx - 2, cy - 2, cellSize + 4, cellSize + 4, 10);
    ctx.stroke();
  },

  _drawDraggingItem(ctx) {
    const ds = this.dragHandler ? this.dragHandler.dragState : null;
    if (!ds || !ds.item) return;

    const size = this.cellSize * 1.1; // 放大 1.1x（§5.4）
    const x = ds.currentX - size / 2;
    // 手指上方偏移 10px 防止遮挡（§5.4）
    const y = ds.currentY - size / 2 - 10;

    ctx.save();
    ctx.globalAlpha = 0.85; // 半透明（§5.4）

    // 阴影（§5.4）
    ctx.shadowColor = 'rgba(45, 24, 10, 0.2)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // 微旋转 ±5°（§5.4）— 基于拖拽方向
    if (ds.currentX !== ds.startX && ds.currentY !== ds.startY) {
      const dx = ds.currentX - ds.startX;
      const maxRot = (Math.PI / 36); // 5°
      const rot = Math.max(-maxRot, Math.min(maxRot, dx * 0.005));
      ctx.translate(ds.currentX, ds.currentY - 10);
      ctx.rotate(rot);
      ctx.translate(-ds.currentX, -(ds.currentY - 10));
    }

    this._drawItem(ctx, ds.item, x, y, size, true);

    // 源格虚线框（§4.1 被拖拽中）
    if (ds.fromIdx >= 0) {
      const r = Math.floor(ds.fromIdx / this.board.cols);
      const c = ds.fromIdx % this.board.cols;
      const cellSize = this.cellSize;
      const pad = CELL_PADDING;
      const srcX = this.boardOffsetX + c * (cellSize + pad) + pad;
      const srcY = this.boardOffsetY + r * (cellSize + pad) + pad;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#C4B5AC';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      this._roundRect(ctx, srcX, srcY, cellSize, cellSize, 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  },

  // ========== 交互处理 ==========

  /**
   * Canvas 触摸事件（WXML 绑定）
   */
  onCanvasTouchStart(e) {
    if (!this.dragHandler) return;
    this.dragHandler._onTouchStart(e);
  },

  onCanvasTouchMove(e) {
    if (!this.dragHandler) return;
    this.dragHandler._onTouchMove(e);
  },

  onCanvasTouchEnd(e) {
    if (!this.dragHandler) return;
    this.dragHandler._onTouchEnd(e);
  },

  /**
   * 处理放置到格子（尝试合成或移动）
   */
  _handleDropTo(fromIdx, toIdx) {
    const fromCell = this.board.getCell(fromIdx);
    const toCell = this.board.getCell(toIdx);

    if (!fromCell) return;

    // 目标为空 → 移动
    if (!toCell) {
      this.board.tryMove(fromIdx, toIdx);
      return;
    }

    // 目标有物品 → 尝试合成
    if (!MergeEngine.canMerge(fromCell, toCell)) {
      // 不可合成，弹回
      return;
    }

    // 消耗能量
    if (!this.gameStore.consumeEnergy(1)) {
      this._showToast(i18n.t('home.not_enough_energy'));
      return;
    }

    this.setData({ energy: this.gameStore.get('energy') });

    // 执行合成
    const mergeResult = this.board.tryMerge(fromIdx, toIdx);
    if (!mergeResult.merged) return;

    // 获取合成结果
    const result = MergeEngine.getMergeResult(fromCell, toCell);
    if (!result) return;

    // 更新棋盘
    this.board.removeCell(fromIdx);
    this.board.removeCell(toIdx);
    const newItem = {
      itemType: result.itemType,
      level: result.level || 0
    };
    this.board.placeItem(toIdx, newItem);

    // 触觉反馈：合成成功 medium 振动（§8.3）
    wx.vibrateShort({ type: 'medium' });

    // 粒子特效（§5.5）
    if (this.particles) {
      const pos = this.dragHandler ? this.dragHandler.getCellCenter(toIdx) : null;
      if (pos) {
        // Lv.3+ 合成使用增强粒子
        const resultLevel = result.level || 0;
        const particleType = resultLevel >= 3 ? 'merge_lv3' : 'merge';
        this.particles.emit(particleType, pos.x, pos.y);
      }
    }

    // 检查是否解锁新菜谱
    this._checkNewRecipe(result);

    // 合成成功回弹动画记录
    this._mergeBounceCells = this._mergeBounceCells || [];
    this._mergeBounceCells.push({ idx: toIdx, startTime: Date.now(), duration: 200 });

    // 通知游戏状态
    this._showToast(i18n.t('home.merge_success'));

    console.log('[Home] 合成:', fromCell.itemType, 'Lv.' + fromCell.level,
      '+', toCell.itemType, 'Lv.' + toCell.level,
      '→', result.itemType, 'Lv.' + (result.level || 0));
  },

  /**
   * 处理上菜
   */
  _handleServe(fromIdx, orderIdx) {
    const item = this.board.getCell(fromIdx);
    if (!item) return;

    const orders = this.orderManager.orders;
    if (orderIdx < 0 || orderIdx >= orders.length) return;

    const order = orders[orderIdx];
    if (order.completed || order.timedOut) return;

    // 检查是否为终端菜品且匹配订单
    if (!MergeEngine.isServable(item.itemType)) {
      this._showToast('只有完成的菜品才能上菜哦');
      return;
    }

    if (item.itemType !== order.itemType) {
      this._showToast('这不是顾客想要的菜品');
      return;
    }

    // 上菜成功
    this.board.removeCell(fromIdx);
    order.completed = true;

    // 金币奖励（从菜谱配置获取）
    let goldEarned = 10;
    try {
      const allRecipes = require('../../config/recipes.json');
      const recipe = allRecipes.find(r => {
        if (r.steps) {
          return r.steps.some(s => s.itemType === item.itemType && s.isTerminal);
        }
        if (r.result) {
          return r.result.itemType === item.itemType;
        }
        return false;
      });
      if (recipe) goldEarned = recipe.goldValue || 10;
    } catch (e) { /* ignore */ }

    this.gameStore.addGold(goldEarned);
    this.gameStore.updateRating(0.05);

    // 触觉反馈：上菜成功 light 振动（§8.3）
    wx.vibrateShort({ type: 'light' });

    // 粒子特效
    if (this.particles) {
      const pos = { x: this.canvasWidth / 2, y: this.orderZoneY + ORDER_ZONE_HEIGHT / 2 };
      this.particles.emit('serve', pos.x, pos.y);
    }

    // 金币飘字动画 "+N"
    this._goldFloats = this._goldFloats || [];
    this._goldFloats.push({
      amount: goldEarned,
      x: this.canvasWidth / 2,
      y: this.orderZoneY + ORDER_ZONE_HEIGHT / 2,
      startTime: Date.now(),
      duration: 1000
    });

    this._showToast('+' + goldEarned + ' 金币！');
    this.setData({ gold: this.gameStore.get('gold'), rating: this.gameStore.get('rating') });

    // 延迟清理已完成订单
    setTimeout(() => {
      this.orderManager.removeCompleted();
      this._refillOrders();
      this._updateOrderDisplay();
    }, 1000);

    console.log('[Home] 上菜成功:', item.itemType, '+', goldEarned, '金币');
  },

  /**
   * 处理点击（卖出模式或查看）
   */
  _handleTap(item, idx) {
    if (this.data.isSellMode) {
      // 卖出模式
      const sellPrice = (item.level + 1) * 5;
      this.board.removeCell(idx);
      this.gameStore.addGold(sellPrice);
      this.setData({ gold: this.gameStore.get('gold') });
      this._showToast('卖出 +' + sellPrice + ' 金币');
      console.log('[Home] 卖出:', item.itemType, 'Lv.' + item.level, '+' + sellPrice);
    }
  },

  /**
   * 长按查看物品信息
   */
  _handleLongPress(item, idx) {
    const info = MergeEngine.getItemInfo(item.itemType);
    const name = info ? info.display : item.itemType;
    const chain = MergeEngine.getRecipeChain(item.itemType);

    wx.showModal({
      title: name + ' Lv.' + item.level,
      content: chain ? `合成链: ${chain.name}\n菜系: ${chain.cuisine || '未知'}` : '基础食材',
      showCancel: false,
      confirmText: i18n.t('common.ok')
    });
  },

  // ========== 订单更新 ==========

  _updateOrderTimers(delta) {
    if (!this.orderManager) return;
    const timedOut = this.orderManager.tick(delta);

    for (const order of timedOut) {
      this._showToast(i18n.t('home.customer_leave', { name: order.customer.name }));
      this.gameStore.updateRating(-0.1);
      this.setData({ rating: this.gameStore.get('rating') });
    }

    // 定期更新订单UI（每 1 秒）
    if (!this._lastOrderUpdate || Date.now() - this._lastOrderUpdate > 1000) {
      this._lastOrderUpdate = Date.now();
      this._updateOrderDisplay();

      // 检查是否需要补充订单
      const activeCount = this.orderManager.getActiveCount();
      if (activeCount < 3) {
        this._refillOrders();
      }
    }

    // 清理超时订单
    if (timedOut.length > 0) {
      setTimeout(() => {
        this.orderManager.removeTimedOut();
        this._refillOrders();
        this._updateOrderDisplay();
      }, 2000);
    }
  },

  _refillOrders() {
    const state = this.gameStore ? this.gameStore.getState() : {};
    const unlockedIds = state.unlockedRecipes || [];
    const unlocked = [];
    try {
      const recipes = require('../../config/recipes.json');
      for (const r of recipes) {
        if (unlockedIds.includes(r.chainId)) unlocked.push(r);
      }
    } catch (e) { /* ignore */ }
    if (unlocked.length === 0) return;
    this.orderManager.generateOrders(unlocked, 3);
  },

  _updateOrderDisplay() {
    if (!this.orderManager) return;
    const orders = this.orderManager.orders.slice(0, 4);
    this.setData({
      orders: orders.map(o => ({
        id: o.id,
        customerName: o.customer ? o.customer.name : '',
        customerAvatar: o.customer ? o.customer.avatar : '👤',
        recipeName: o.recipeName || '',
        remaining: Math.ceil(o.remaining),
        timeLimit: o.timeLimit,
        completed: o.completed === true,
        timedOut: o.timedOut === true,
        urgent: !o.completed && !o.timedOut && o.remaining < 15
      }))
    });
  },

  // ========== 底部按钮 ==========

  /**
   * 切换卖出模式
   */
  onToggleSellMode() {
    this.setData({ isSellMode: !this.data.isSellMode });
    if (this.data.isSellMode) {
      this._showToast(i18n.t('home.sell_mode_tip'));
    }
  },

  /**
   * 打开菜谱图鉴
   */
  onOpenCookbook() {
    wx.navigateTo({ url: '/pages-sub/cookbook/cookbook' });
  },

  /**
   * 食材加速（看广告）
   */
  onSpeedUp() {
    if (this.board.isFull()) {
      this._showToast(i18n.t('home.board_full'));
      return;
    }

    const self = this;
    adManager.showRewardedVideo('speedup')
      .then(() => {
        // 生成 3 个 Lv.1 食材
        const types = ['tomato', 'egg', 'rice', 'flour', 'potato', 'cabbage', 'pepper'];
        let count = 0;
        for (let i = 0; i < 3; i++) {
          const t = types[Math.floor(Math.random() * types.length)];
          const idx = self.board.generateItem(t, 1);
          if (idx >= 0) count++;
        }
        self._showToast('生成 ' + count + ' 个食材！');
      })
      .catch(() => {
        // 用户取消或广告加载失败
      });
  },

  /**
   * 打开设置
   */
  onOpenSettings() {
    wx.navigateTo({ url: '/pages-sub/settings/settings' });
  },

  /**
   * 打开餐厅升级页
   */
  onOpenUpgrade() {
    wx.navigateTo({ url: '/pages-sub/upgrade/upgrade' });
  },

  /**
   * 看广告获取能量
   */
  onGetEnergy() {
    const self = this;
    adManager.showRewardedVideo('energy')
      .then(() => {
        if (self.gameStore && self.gameStore._energyManager) {
          self.gameStore._energyManager.watchAdForEnergy();
          self.gameStore.refreshEnergy();
        } else {
          self.gameStore.set('energy', Math.min(100, self.gameStore.get('energy') + 30));
        }
        self.setData({ energy: self.gameStore.get('energy') });
        self._showToast('+30 能量！');
      })
      .catch(() => {});
  },

  // ========== 工具方法 ==========

  _checkNewRecipe(result) {
    if (!result) return;
    try {
      const allRecipes = require('../../config/recipes.json');
      for (const r of allRecipes) {
        if (r.steps) {
          const last = r.steps[r.steps.length - 1];
          if (last && last.itemType === result.itemType && last.isTerminal) {
            if (!this.gameStore.get('unlockedRecipes').includes(r.chainId)) {
              this.gameStore.unlockRecipe(r.chainId);
              this._showToast(i18n.t('home.new_recipe', { name: r.name }));
            }
          }
        }
        if (r.result && r.result.itemType === result.itemType) {
          if (!this.gameStore.get('unlockedRecipes').includes(r.chainId)) {
            this.gameStore.unlockRecipe(r.chainId);
            this._showToast(i18n.t('home.new_recipe', { name: r.name }));
          }
        }
      }
    } catch (e) { /* ignore */ }
  },

  _showToast(text) {
    this.setData({ toastText: text, toastVisible: true });
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.setData({ toastVisible: false });
    }, 1500);
  },

  _saveState() {
    if (!this.board || !this.gameStore) return;
    const boardData = this.board.toJSON();
    this.gameStore.updateBoard(boardData);
    if (this.orderManager) {
      this.gameStore.set('orders', this.orderManager.orders);
    }
    try {
      const state = this.gameStore.getState();
      storage.save('game_state', state);
    } catch (e) {
      console.warn('[Home] 保存失败', e);
    }
  },

  /**
   * 圆角矩形绘制辅助
   */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
});
