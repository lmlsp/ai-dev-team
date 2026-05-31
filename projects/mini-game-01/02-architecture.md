# 《合合小厨神》技术架构设计

> 版本：v1.0 | 日期：2026-05-31 | 作者：Architect Agent
> 对应 PRD：01-prd.md

---

## 目录

1. [技术选型](#1-技术选型)
2. [模块划分](#2-模块划分)
3. [前端架构](#3-前端架构)
4. [后端架构](#4-后端架构)
5. [数据库设计](#5-数据库设计)
6. [缓存设计](#6-缓存设计)
7. [安全设计](#7-安全设计)
8. [部署方案](#8-部署方案)

---

## 1. 技术选型

### 1.1 前端框架：微信小程序原生 + Canvas

#### 选型对比

| 维度 | 微信小程序原生 | uni-app | Taro |
|------|-------------|---------|------|
| 微信 API 兼容性 | 100%，第一时间跟进 | 依赖 uni-app 适配层，滞后 1-3 月 | 依赖 Taro 适配层，滞后 1-3 月 |
| 包大小 | 无框架开销，理论最轻 | 运行时 + 编译产物 ~200KB+ | 运行时 + 编译产物 ~150KB+ |
| Canvas 性能 | 直接调用 native Canvas API，无中间层损耗 | 通过 uni.canvasToTempFilePath 桥接 | 通过 Taro.createCanvasContext 桥接 |
| 游戏渲染（requestAnimationFrame） | 原生支持，帧率可控 | 封装后可能有卡顿 | 封装后可能有卡顿 |
| 微信社交 API（关系链、分享） | 直接调用 wx.xxx | 需 uni.xxx 封装，部分 API 不可用 | 需 Taro.xxx 封装，部分 API 不可用 |
| 优量汇 SDK 接入 | 官方原生组件 `<ad>` | 需条件编译 + 平台判断 | 需条件编译 + 平台判断 |
| 拖拽交互（touchstart/move/end） | 原生支持，精确控制 | H5 映射层有偏差 | H5 映射层有偏差 |
| 小程序特有限制适配 | 完全掌控 | 框架层黑盒可能出问题 | 框架层黑盒可能出问题 |
| 学习成本（新人） | 微信文档即可 | 需学框架 + 微信文档 | 需学框架 + React/Vue + 微信文档 |

**推荐：微信小程序原生开发 + Canvas 2D API**

**理由：**
- 本项目核心是 **Merge Board**（Canvas 拖拽合成），对渲染性能和触摸交互精度要求高，框架封装层会造成性能损耗和交互延迟
- 优量汇 SDK、微信社交 API 直接调用原生 API 最可靠，无需排坑框架适配问题
- 包大小敏感：小程序主包限制 2MB，分包总计 20MB；框架额外开销 150-200KB 在主包里是实实在在的浪费
- 项目周期 1-2 周，原生开发省去框架学习 + 踩坑时间
- V1.0 只有 11 个页面，原生开发复杂度完全可控

### 1.2 游戏渲染方案：Canvas 2D

| 维度 | Canvas 2D | DOM (WXML) |
|------|-----------|------------|
| 拖拽性能 | 直接操作像素，60fps 稳定 | DOM 重排重绘，大量元素时掉帧 |
| 合成动画（粒子特效） | 原生支持，render loop 统一控制 | CSS animation 能力有限，复杂动画卡顿 |
| 棋盘网格渲染 | 一次 draw，批量渲染 | 每格一个 `<view>`，30-42 个节点 |
| 碰撞检测 | 像素级精确 | 需手动计算 bounding rect |
| 内存占用 | 一个 Canvas 上下文 | N 个 DOM 节点 + 样式计算 |
| 开发成本 | 需自行封装交互层 | 直接用 WXML 组件 |

**推荐：Canvas 2D（`<canvas type="2d">`）**

Merge Board 的 30-42 格食材拖拽合成，涉及高频 touchmove → 重绘，DOM 方案会产生大量 setData 调用（小程序 setData 有 256KB/次限制且跨 native 通信开销大）。Canvas 将所有渲染控制在单个上下文中，无 JS-Native 桥接瓶颈。

### 1.3 后端框架：Spring Boot 3.x

| 依赖 | 版本 | 用途 |
|------|------|------|
| spring-boot-starter-web | 3.2.x | RESTful API |
| spring-boot-starter-data-jpa | 3.2.x | ORM（V1.0 表少，JPA 足够） |
| spring-boot-starter-data-redis | 3.2.x | Redis 缓存 |
| spring-boot-starter-validation | 3.2.x | 参数校验 |
| spring-boot-starter-aop | 3.2.x | 日志/鉴权切面 |
| mysql-connector-j | 8.3.x | MySQL 驱动 |
| weixin-java-miniapp | 4.6.x | 微信登录/订阅消息 |
| hutool-all | 5.8.x | 工具类（JSON、加密等） |
| lombok | 1.18.x | 消除样板代码 |

**为什么不用 Spring Cloud 微服务：** V1.0 用户量级在万级以内，QPS < 100，单体架构足够且开发效率最高。后续 DAU 破 10 万时可拆。

### 1.4 数据库方案

| 方案 | 适用场景 | 推荐度 |
|------|---------|--------|
| MySQL 8.0 | 关系型数据（用户、棋盘、订单、餐厅） | **推荐** |
| MongoDB | 棋盘 JSON 数据灵活存储 | 不推荐（V1.0 数据模型固定，不需要 schema-less） |
| 云开发数据库 | 免运维、免后端 | 可选，但锁平台且性能受限 |

**推荐：MySQL 8.0**

- 用户、餐厅、棋盘、订单、菜谱数据均为强结构化关系型数据
- Spring Boot + JPA 开箱即用
- 单表万级数据，索引优化后查询 < 10ms

### 1.5 缓存方案

| 方案 | 适用场景 | 推荐度 |
|------|---------|--------|
| Redis 7.x | 排行榜、会话、热点数据 | **推荐** |
| Caffeine（本地缓存） | 配置表、菜谱树 | **推荐**（配合 Redis） |
| 仅 MySQL | 无缓存 | 不推荐 |

**推荐：Redis 7.x（远程） + Caffeine（本地）**

- Redis：存储用户会话、排行榜 Sorted Set、能量/金币的临时校验值
- Caffeine：缓存菜谱配置表（34 条，基本不变），减少 Redis 访问

---

## 2. 模块划分

### 2.1 前端模块

```
mini-game-01/
├── app.js / app.json / app.wxss       # 小程序入口
├── pages/                              # 11 个页面
│   ├── loading/                        # P1 加载页
│   ├── home/                           # P2 主界面（核心）
│   ├── cookbook/                       # P3 菜谱图鉴
│   ├── upgrade/                        # P4 餐厅升级
│   ├── leaderboard/                    # P5 排行榜
│   ├── friends/                        # P6 好友列表
│   ├── friend-restaurant/              # P7 好友餐厅
│   ├── inventory/                      # P8 背包/道具
│   ├── settings/                       # P9 设置
│   ├── tutorial/                       # P10 新手引导（浮层）
│   └── share/                          # P11 分享结果
├── engine/                             # 游戏核心引擎
│   ├── Board.js                        # 棋盘数据结构 + 操作
│   ├── MergeEngine.js                  # 合成规则引擎
│   ├── DragHandler.js                  # 拖拽手势处理
│   ├── RecipeTree.js                   # 菜谱合成树
│   ├── OrderManager.js                 # 订单生成 & 管理
│   ├── EnergyManager.js                # 能量管理（本地 + 服务端校验）
│   └── ParticleEmitter.js             # 粒子特效
├── services/                           # 业务服务层
│   ├── api.js                          # HTTP 请求封装
│   ├── auth.js                         # 微信登录
│   ├── sync.js                         # 数据同步（本地 ↔ 云端）
│   ├── ad.js                           # 优量汇广告管理
│   └── share.js                        # 分享逻辑
├── store/                              # 全局状态
│   └── gameStore.js                    # 游戏状态（用户/棋盘/能量/金币）
├── utils/                              # 工具函数
│   ├── i18n.js                         # 国际化
│   ├── storage.js                      # 本地存储封装
│   └── validator.js                    # 客户端校验
├── components/                         # 公共组件
│   ├── energy-bar/                     # 能量条
│   ├── gold-display/                   # 金币展示
│   ├── customer-card/                  # 顾客卡片
│   ├── merge-cell/                     # 棋盘格子（非 Canvas 辅助）
│   ├── upgrade-modal/                  # 升级弹窗
│   └── ad-button/                      # 广告按钮
└── config/                             # 配置表
    ├── recipes.json                     # 菜谱合成公式（34 条）
    ├── restaurant-levels.json          # 餐厅等级配置
    └── items.json                       # 道具配置
```

### 2.2 后端模块

```
mini-game-server/
├── src/main/java/com/chefgame/
│   ├── ChefGameApplication.java
│   ├── controller/                     # 控制器层
│   │   ├── UserController.java
│   │   ├── BoardController.java
│   │   ├── MergeController.java
│   │   ├── OrderController.java
│   │   ├── RestaurantController.java
│   │   ├── SocialController.java
│   │   ├── LeaderboardController.java
│   │   └── AdController.java
│   ├── service/                        # 业务逻辑层
│   │   ├── UserService.java
│   │   ├── BoardService.java
│   │   ├── MergeService.java
│   │   ├── OrderService.java
│   │   ├── RestaurantService.java
│   │   ├── SocialService.java
│   │   ├── LeaderboardService.java
│   │   ├── EnergyService.java
│   │   └── AdService.java
│   ├── repository/                     # 数据访问层
│   │   ├── UserRepository.java
│   │   ├── BoardRepository.java
│   │   ├── MergeLogRepository.java
│   │   ├── OrderLogRepository.java
│   │   ├── RestaurantRepository.java
│   │   └── SocialRepository.java
│   ├── entity/                         # 数据实体
│   │   ├── User.java
│   │   ├── BoardState.java
│   │   ├── MergeLog.java
│   │   ├── OrderLog.java
│   │   ├── Restaurant.java
│   │   └── SocialVisit.java
│   ├── dto/                            # 数据传输对象
│   │   ├── request/
│   │   └── response/
│   ├── config/                         # 配置类
│   │   ├── RedisConfig.java
│   │   ├── CaffeineConfig.java
│   │   └── WeChatConfig.java
│   ├── security/                       # 安全
│   │   ├── WeChatAuthFilter.java
│   │   ├── AntiCheatAspect.java
│   │   └── AdCallbackVerifier.java
│   └── common/                         # 通用
│       ├── Result.java                 # 统一响应
│       ├── GameException.java
│       └── GlobalExceptionHandler.java
├── src/main/resources/
│   ├── application.yml
│   ├── application-dev.yml
│   ├── application-prod.yml
│   └── db/migration/                   # Flyway 迁移脚本
│       └── V1__init.sql
└── Dockerfile
```

### 2.3 模块依赖图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (WeChat Mini Program)             │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  pages/  │  │ engine/  │  │ store/   │  │ services/   │ │
│  │ 11 pages │──▶  Board   │──▶ gameStore│──▶ api.js      │ │
│  │          │  │  Merge    │  │          │  │ auth.js     │ │
│  │          │  │  Drag     │  │          │  │ sync.js     │ │
│  │          │  │  Recipe   │  │          │  │ ad.js       │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────┬──────┘ │
│                                                    │        │
└────────────────────────────────────────────────────┼────────┘
                                                     │ HTTPS
                                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端 (Spring Boot 3.x)                  │
│                                                             │
│  ┌────────────┐    ┌──────────┐    ┌──────────────┐        │
│  │ controller │───▶│ service  │───▶│ repository   │        │
│  │ 8 个       │    │ 9 个     │    │ 6 个          │        │
│  └────────────┘    └────┬─────┘    └──────┬───────┘        │
│                         │                 │                 │
└─────────────────────────┼─────────────────┼─────────────────┘
                          │                 │
                    ┌─────┴─────┐    ┌──────┴───────┐
                    │  Redis     │    │  MySQL 8.0   │
                    │  Session   │    │  User/Board  │
                    │  Cache     │    │  Restaurant  │
                    │  LB        │    │  Social      │
                    └───────────┘    └──────────────┘
```

---

## 3. 前端架构

### 3.1 页面路由设计

```json
// app.json
{
  "pages": [
    "pages/loading/loading",           // P1  加载页（首页）
    "pages/home/home",                 // P2  主界面
    "pages/cookbook/cookbook",         // P3  菜谱图鉴
    "pages/upgrade/upgrade",           // P4  餐厅升级
    "pages/leaderboard/leaderboard",   // P5  排行榜
    "pages/friends/friends",           // P6  好友列表
    "pages/friend-restaurant/friend-restaurant",  // P7  好友餐厅
    "pages/inventory/inventory",       // P8  背包/道具
    "pages/settings/settings",         // P9  设置
    "pages/share/share"                // P11 分享结果页
  ],
  "window": {
    "navigationStyle": "custom",       // 自定义导航栏（沉浸式）
    "pageOrientation": "portrait"      // 锁定竖屏
  }
}
```

**路由跳转策略：**
- `loading → home`：`wx.redirectTo`（不可返回加载页）
- `home → cookbook/upgrade/leaderboard/friends/settings`：`wx.navigateTo`（可返回）
- `home → tutorial`：浮层组件，不占页面栈
- `friends → friend-restaurant`：`wx.navigateTo`
- 分享卡片落地 → `share`：通过 `path` 参数分发到目标页

### 3.2 状态管理方案

不引入第三方状态库（减少包大小），使用小程序全局 `app.globalData` + 发布订阅模式：

```javascript
// store/gameStore.js
class GameStore {
  constructor() {
    this._state = {
      // 用户
      user: { uid: null, nickName: '', avatarUrl: '', isGuest: true },
      // 棋盘
      board: {
        cells: [],          // 30-42 格，每格 { id, itemType, level, pos }
        maxSlots: 30,       // 当前最大格子数
        version: 0          // 乐观锁版本号
      },
      // 资源
      energy: 100,
      gold: 0,
      rating: 3.0,         // 好评度
      // 餐厅
      restaurantLevel: 1,
      // 订单
      orders: [],           // [{ customerId, recipeId, timeout }]
      // 社交
      inspiration: 0,      // 灵感值
      // 标记
      isNewUser: false,
      lastSyncAt: null
    };
    this._listeners = {};
  }

  get(key) { return this._state[key]; }
  set(key, value) {
    this._state[key] = value;
    this._notify(key, value);
  }
  on(key, fn) { /* 订阅 */ }
  _notify(key, value) { /* 通知 */ }
}

// app.js
App({
  onLaunch() {
    this.gameStore = new GameStore();
  }
});

// 页面中使用
const app = getApp();
app.gameStore.on('energy', (val) => { this.setData({ energy: val }); });
```

**状态分类：**

| 类别 | 数据 | 存储位置 | 同步策略 |
|------|------|---------|---------|
| 会话状态 | 用户信息、token | app.globalData + storage | 登录时写入 |
| 游戏核心 | 棋盘、能量、金币 | app.globalData + 本地缓存 | 每 30s 云端同步 + 关键操作即时同步 |
| 只读配置 | 菜谱、升级条件 | 本地 config JSON + 云端版本号校验 | 启动时拉取，有更新覆盖 |
| UI 临时 | 动画状态、弹窗 | 页面 data | 不持久化 |
| 社交 | 排行榜、好友列表 | 页面 data | 进入页面时拉取 |

### 3.3 游戏核心引擎设计

#### 3.3.1 Merge Board 数据结构

```javascript
// engine/Board.js
class Board {
  constructor(rows, cols) {
    this.rows = rows;        // 6
    this.cols = cols;        // 5（初始）
    this.cells = [];         // cells[rows * cols]
    this.itemIdCounter = 0;
  }

  // 初始化棋盘
  init(savedState) {
    this.cells = new Array(this.rows * this.cols).fill(null);
    if (savedState) this._restore(savedState);
  }

  // 放置食材到指定位置
  placeItem(row, col, item) {
    const idx = row * this.cols + col;
    if (this.cells[idx]) return false; // 格位占用
    this.cells[idx] = { ...item, id: ++this.itemIdCounter };
    return true;
  }

  // 拖拽合成：from → to
  // 返回 { merged, newItem, removedFrom }
  tryMerge(fromIdx, toIdx) {
    const from = this.cells[fromIdx];
    const to = this.cells[toIdx];
    if (!from || !to) return { merged: false };
    if (from.itemType !== to.itemType) return { merged: false };
    if (from.level !== to.level) return { merged: false };

    // 检查是否为终端菜品（不可再合成）
    const nextLevel = this._getNextLevel(from);
    if (!nextLevel) return { merged: false };

    // 执行合成
    this.cells[fromIdx] = null;
    this.cells[toIdx] = {
      itemType: nextLevel.itemType,
      level: nextLevel.level,
      id: ++this.itemIdCounter
    };
    return { merged: true, newItem: this.cells[toIdx], removedFrom: fromIdx };
  }

  // 查合成链下一级
  _getNextLevel(item) {
    return RecipeTree.getNext(item.itemType, item.level);
  }

  // 找空格
  findEmptySlots(count) {
    const slots = [];
    for (let i = 0; i < this.cells.length; i++) {
      if (!this.cells[i]) slots.push(i);
      if (slots.length >= count) break;
    }
    return slots;
  }

  // 序列化（用于本地存储和云端同步）
  serialize() {
    return {
      rows: this.rows,
      cols: this.cols,
      cells: this.cells.map(c => c ? {
        t: c.itemType,    // 缩写节省存储
        l: c.level,
        i: c.id
      } : null)
    };
  }

  // 反序列化
  _restore(saved) {
    this.rows = saved.rows;
    this.cols = saved.cols;
    this.cells = saved.cells.map(c => c ? {
      itemType: c.t,
      level: c.l,
      id: c.i
    } : null);
  }
}
```

#### 3.3.2 菜谱合成树

```javascript
// engine/RecipeTree.js
// 基于配置表构建合成树
class RecipeTree {
  static recipes = [];  // 从 config/recipes.json 加载

  // recipes.json 结构：
  // [
  //   {
  //     "chainId": "tomato_egg",
  //     "name": "番茄炒蛋",
  //     "steps": [
  //       { "itemType": "tomato", "level": 0, "display": "番茄" },
  //       { "itemType": "tomato", "level": 1, "display": "番茄块" },
  //       { "itemType": "tomato", "level": 2, "display": "番茄酱" },
  //       { "itemType": "tomato_egg", "level": 3, "display": "番茄炒蛋", "isTerminal": true }
  //     ]
  //   },
  //   {
  //     "chainId": "cross_tomato_egg",
  //     "name": "番茄炒蛋（成品）",
  //     "recipe": [
  //       { "itemType": "tomato", "level": 2 },   // 番茄酱 Lv.2
  //       { "itemType": "egg", "level": 3 }         // 炒蛋 Lv.3
  //     ],
  //     "result": { "itemType": "tomato_egg_dish", "level": 0, "display": "番茄炒蛋", "isTerminal": true }
  //   }
  // ]

  static getNext(itemType, level) {
    // 1. 查线性链的下一级
    const chain = this.recipes.find(r =>
      r.steps && r.steps.some(s => s.itemType === itemType && s.level === level)
    );
    if (chain) {
      const idx = chain.steps.findIndex(s => s.itemType === itemType && s.level === level);
      if (idx < chain.steps.length - 1) return chain.steps[idx + 1];
    }
    // 2. 终端检查：是否作为跨品类配方的原料
    return null; // 终端物品不可再合成
  }

  // 某菜品可被拖到订单区上菜
  static isServable(itemType, level) {
    const chain = this.recipes.find(r =>
      r.steps && r.steps.some(s => s.itemType === itemType && s.level === level && s.isTerminal)
    );
    if (chain) return true;
    const cross = this.recipes.find(r =>
      r.result && r.result.itemType === itemType
    );
    return !!cross;
  }
}
```

#### 3.3.3 拖拽交互处理

```javascript
// engine/DragHandler.js
class DragHandler {
  constructor(canvas, board, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.board = board;
    this.cb = callbacks;  // { onMerge, onServe, onDrop }

    this.dragState = null;
    // { item, fromIdx, startX, startY, currentX, currentY }

    this.cellWidth = 0;
    this.cellHeight = 0;
    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener('touchstart', this._onStart.bind(this));
    this.canvas.addEventListener('touchmove', this._onMove.bind(this));
    this.canvas.addEventListener('touchend', this._onEnd.bind(this));
  }

  _getCellIndex(x, y) {
    const col = Math.floor(x / this.cellWidth);
    const row = Math.floor(y / this.cellHeight);
    if (col < 0 || col >= this.board.cols || row < 0 || row >= this.board.rows) {
      return -1;
    }
    return row * this.board.cols + col;
  }

  _onStart(e) {
    const touch = e.touches[0];
    const idx = this._getCellIndex(touch.x, touch.y);
    if (idx < 0 || !this.board.cells[idx]) return;

    this.dragState = {
      item: this.board.cells[idx],
      fromIdx: idx,
      startX: touch.x,
      startY: touch.y,
      currentX: touch.x,
      currentY: touch.y
    };
  }

  _onMove(e) {
    if (!this.dragState) return;
    const touch = e.touches[0];
    this.dragState.currentX = touch.x;
    this.dragState.currentY = touch.y;
    // 触发重绘（显示拖拽中的食材跟随手指）
    this.cb.onDragMove(this.dragState);
  }

  _onEnd(e) {
    if (!this.dragState) return;
    const touch = e.changedTouches[0];
    const toIdx = this._getCellIndex(touch.x, touch.y);

    if (toIdx >= 0 && toIdx !== this.dragState.fromIdx) {
      // 拖到棋盘内 → 尝试合成
      const result = this.board.tryMerge(this.dragState.fromIdx, toIdx);
      if (result.merged) {
        this.cb.onMerge(result);
      } else {
        this.cb.onDrop(); // 弹回原位
      }
    } else if (this._isInOrderZone(touch.x, touch.y)) {
      // 拖到订单区 → 尝试上菜
      const orderIdx = this._getOrderIndex(touch.x, touch.y);
      this.cb.onServe(this.dragState.fromIdx, orderIdx);
    } else {
      this.cb.onDrop(); // 弹回原位
    }

    this.dragState = null;
  }

  _isInOrderZone(x, y) {
    // 判断触摸点是否在订单区（Canvas 顶部区域）
    return y < 0; // 订单区在棋盘上方（viewport 坐标）
  }
}
```

#### 3.3.4 Canvas 渲染分层

```
┌─────────────────────────────┐
│  Layer 3: 粒子特效          │  ← 合成时动态粒子
│  Layer 2: 食材图标 + 拖拽层 │  ← 食材精灵 + 拖拽跟随
│  Layer 1: 棋盘网格背景      │  ← 静态网格线
│  Layer 0: 背景色/纹理       │  ← 厨师台面纹理
└─────────────────────────────┘
```

渲染使用 `requestAnimationFrame` 游戏循环，60fps 理想帧率：

```javascript
// 在 home 页面中
renderLoop() {
  const ctx = this.ctx;
  // 1. 清空画布
  ctx.clearRect(0, 0, this.width, this.height);

  // 2. 绘制背景
  this._drawBackground(ctx);

  // 3. 绘制棋盘网格
  this._drawGrid(ctx);

  // 4. 绘制所有食材（跳过正在拖拽的）
  this.board.cells.forEach((cell, idx) => {
    if (!cell || (this.dragState && idx === this.dragState.fromIdx)) return;
    this._drawItem(ctx, cell, idx);
  });

  // 5. 绘制拖拽中的食材（跟随手指，半透明）
  if (this.dragState) {
    this._drawDraggingItem(ctx, this.dragState);
  }

  // 6. 绘制粒子
  this.particleEmitter.update();
  this.particleEmitter.draw(ctx);

  // 7. 请求下一帧
  this._rafId = requestAnimationFrame(() => this.renderLoop());
}
```

### 3.4 广告接入方案

```javascript
// services/ad.js
class AdManager {
  constructor() {
    this._rewardedVideoAd = null;
    this._bannerAd = null;
    this._interstitialAd = null;
    this._init();
  }

  _init() {
    // 激励视频
    this._rewardedVideoAd = wx.createRewardedVideoAd({
      adUnitId: 'adunit-xxxxxxxx'  // 优量汇广告位 ID
    });
    this._rewardedVideoAd.onError(err => {
      console.warn('激励视频加载失败，尝试备选平台', err);
      this._fallbackToCsj(); // 优量汇失败 → 穿山甲
    });

    // Banner（底部常驻）
    this._bannerAd = wx.createBannerAd({
      adUnitId: 'adunit-yyyyyyyy',
      style: { left: 0, top: wx.getSystemInfoSync().windowHeight - 100, width: 375 }
    });

    // 插屏（预加载，场景触发）
    this._interstitialAd = wx.createInterstitialAd({
      adUnitId: 'adunit-zzzzzzzz'
    });
  }

  // 播放激励视频
  showRewardedVideo(scene) {
    // scene: 'energy' | 'speedup' | 'double_gold' | 'extend_time'
    return new Promise((resolve, reject) => {
      // 新用户前 5 分钟不展示广告
      if (this._isNewUserGracePeriod()) {
        this._grantReward(scene); // 直接给奖励（提升体验）
        return;
      }
      this._rewardedVideoAd.show()
        .then(() => { /* 用户看完 */ })
        .catch(err => {
          // 广告加载中，提示稍后重试
          wx.showToast({ title: '广告加载中，请稍后再试', icon: 'none' });
        });
      this._rewardedVideoAd.onClose(res => {
        if (res && res.isEnded) {
          this._grantReward(scene);
          resolve();
        } else {
          wx.showToast({ title: '完整观看才能获得奖励哦', icon: 'none' });
          reject('not_completed');
        }
      });
    });
  }

  _grantReward(scene) {
    switch (scene) {
      case 'energy':    // +30 能量
        app.gameStore.set('energy', Math.min(100, app.gameStore.get('energy') + 30));
        break;
      case 'speedup':   // 生成 3 个 Lv.1 食材
        break;
      case 'double_gold': // 本次金币 ×2
        break;
      case 'extend_time': // 顾客等待 +30s
        break;
    }
    // 通知服务端记录广告观看（用于反作弊校验）
    api.post('/ad/callback', { scene, timestamp: Date.now() });
  }
}
```

### 3.5 数据持久化方案

```
┌──────────────────────────────────────────────┐
│                  同步策略                      │
│                                              │
│  ┌──────────┐   每 30s/关键操作    ┌────────┐ │
│  │ 本地缓存  │ ◀───────────────▶ │ 云端 DB │ │
│  │ (Storage) │   启动时全量拉取     │ (MySQL) │ │
│  └──────────┘                     └────────┘ │
│                                              │
│  优先级：                                     │
│  1. 游戏操作 → 本地立即更新（乐观 UI）          │
│  2. 关键操作 → 即时同步（合成上菜、金币变更）    │
│  3. 普通操作 → 30s 批量同步                    │
│  4. 冲突 → 服务端为准                          │
└──────────────────────────────────────────────┘
```

**本地存储配额管理：**

小程序 Storage 上限 10MB。存储预算：
- 棋盘状态（序列化后 ~2KB）
- 用户数据（~1KB）
- 配置表缓存（~50KB，菜谱 JSON 等）
- 广告缓存（~100KB，预加载素材）
- **总计 < 200KB，远低于上限**

```javascript
// utils/storage.js
const STORAGE_KEYS = {
  BOARD: 'board_v1',
  USER: 'user_v1',
  CONFIG: 'config_v1',
  LAST_SYNC: 'last_sync',
  TUTORIAL_DONE: 'tutorial_done'
};

function saveBoard(board) {
  const data = JSON.stringify(board.serialize());
  wx.setStorageSync(STORAGE_KEYS.BOARD, data);
}

function loadBoard() {
  const data = wx.getStorageSync(STORAGE_KEYS.BOARD);
  return data ? JSON.parse(data) : null;
}

// 数据完整性校验
function validateStoredData(key, schema) {
  try {
    const data = wx.getStorageSync(key);
    if (!data) return null;
    const parsed = JSON.parse(data);
    // 简易 schema 校验
    if (!schema.every(field => field in parsed)) {
      console.warn(`${key} 数据损坏，清除`);
      wx.removeStorageSync(key);
      return null;
    }
    return parsed;
  } catch (e) {
    wx.removeStorageSync(key);
    return null;
  }
}
```

---

## 4. 后端架构

### 4.1 架构选型：单体（Monolith）

**为什么是单体而不是微服务：**

| 维度 | 单体 | 微服务 |
|------|------|--------|
| V1.0 开发效率 | 1 人 3-5 天 | 1 人 2-3 周（基础设施 + 服务发现） |
| 运维复杂度 | 一个 JAR，docker compose 一条龙 | K8s + 服务网格 + CI/CD 管道 |
| V1.0 QPS 预估 | < 100 | 不需要 |
| 调试成本 | 单步调试 | 分布式追踪 |
| 后续拆分 | 按领域拆 module → 独立服务 | 已拆分 |

**结论：单体先行，按需拆分。** 代码内部按 module 分层（controller/service/repository），后续用户量起来时，横向复制服务实例 + Nginx 负载均衡，纵向拆分 module 为独立服务即可。

### 4.2 RESTful API 设计

所有接口前缀：`/api/v1`

#### 4.2.1 用户模块 (UserController)

```
POST   /api/v1/auth/login                    # 微信静默登录
GET    /api/v1/users/me                       # 获取当前用户信息
PUT    /api/v1/users/me                       # 更新用户信息（昵称、头像）
```

**POST /api/v1/auth/login**

```json
// Request
{
  "code": "0b3xXXXXXXX",            // wx.login() 返回的 code
  "nickName": "小厨神888",          // 可选，首次注册时
  "avatarUrl": "https://xxx"       // 可选
}

// Response 200
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOi...",       // JWT token
    "user": {
      "uid": "user_10001",
      "nickName": "小厨神888",
      "avatarUrl": "https://xxx",
      "isNewUser": true,
      "gold": 100,                   // 初始金币
      "energy": 100,
      "restaurantLevel": 1,
      "rating": 3.0
    }
  }
}
```

#### 4.2.2 棋盘模块 (BoardController)

```
GET    /api/v1/board                          # 获取棋盘完整状态
POST   /api/v1/board/sync                     # 批量同步棋盘变更（增量）
```

**POST /api/v1/board/sync**

```json
// Request
{
  "version": 12,                     // 本地棋盘版本号（乐观锁）
  "operations": [
    {
      "op": "merge",                 // merge | generate | sell | place
      "timestamp": 1717152000000,    // 客户端时间戳
      "fromIdx": 7,
      "toIdx": 13,
      "fromItem": { "t": "tomato", "l": 0 },
      "toItem": { "t": "tomato", "l": 0 },
      "resultItem": { "t": "tomato", "l": 1 }
    },
    {
      "op": "sell",
      "timestamp": 1717152001000,
      "idx": 20,
      "item": { "t": "egg", "l": 0 },
      "goldEarned": 5
    }
  ],
  "currentGold": 450,
  "currentEnergy": 75,
  "currentRating": 3.2
}

// Response 200
{
  "code": 0,
  "data": {
    "accepted": true,
    "newVersion": 14,
    "serverGold": 450,               // 服务端校验后的金币
    "serverEnergy": 75,              // 服务端校验后的能量
    "serverRating": 3.2,
    "corrections": []                // 如有差异，返回服务端正确值
  }
}

// Response 409 (版本冲突)
{
  "code": 10001,
  "message": "版本冲突，请拉取最新棋盘",
  "data": {
    "serverBoard": { /* 完整棋盘数据 */ }
  }
}
```

#### 4.2.3 合成模块 (MergeController)

```
POST   /api/v1/merges                         # 单次合成校验（关键操作即时同步）
```

```json
// Request
{
  "timestamp": 1717152000000,
  "fromIdx": 7,
  "toIdx": 13,
  "fromItem": { "t": "tomato", "l": 0 },
  "toItem": { "t": "tomato", "l": 0 },
  "expectedResult": { "t": "tomato", "l": 1 },
  "energyCost": 1
}

// Response 200
{
  "code": 0,
  "data": {
    "valid": true,
    "newEnergy": 74,
    "newGold": 0,                    // 合成不直接产生金币
    "unlockedRecipe": null,          // 如解锁新菜，返回菜谱信息
    "achievement": null
  }
}

// Response 400 (作弊检测)
{
  "code": 20001,
  "message": "合成校验失败",
  "data": {
    "reason": "item_mismatch",       // item_mismatch | energy_insufficient | invalid_synthesis
    "serverEnergy": 75
  }
}
```

#### 4.2.4 订单模块 (OrderController)

```
GET    /api/v1/orders                         # 获取当前订单队列
POST   /api/v1/orders/:orderId/serve          # 上菜（关键操作）
GET    /api/v1/orders/history?page=1&size=20  # 历史订单（用于图鉴进度）
```

**POST /api/v1/orders/:orderId/serve**

```json
// Request
{
  "timestamp": 1717152000000,
  "servedItem": { "t": "tomato_egg_dish", "l": 0 },  // 拖到顾客的菜品
  "boardIdx": 13,                                      // 菜品在棋盘的位置
  "customerId": "c_001"
}

// Response 200
{
  "code": 0,
  "data": {
    "goldEarned": 50,                  // 获得金币
    "ratingChange": 0.1,               // 好评度变化
    "tipGold": 10,                     // 小费（好评度 > 4 概率触发）
    "newGold": 500,
    "newRating": 3.3
  }
}
```

#### 4.2.5 餐厅模块 (RestaurantController)

```
GET    /api/v1/restaurant                      # 餐厅当前状态
POST   /api/v1/restaurant/upgrade              # 升级餐厅
```

**POST /api/v1/restaurant/upgrade**

```json
// Response 200
{
  "code": 0,
  "data": {
    "newLevel": 2,
    "newName": "小饭馆",
    "unlockedRecipes": [               // 新解锁的菜系
      { "chainId": "mapo_tofu", "name": "麻婆豆腐" },
      { "chainId": "kungpao_chicken", "name": "宫保鸡丁" }
      // ... 共 8 种
    ],
    "boardExpanded": false,            // Lv.3 才扩展棋盘
    "unlockedFeatures": ["decor_2"]   // 新解锁装饰位
  }
}
```

#### 4.2.6 社交模块 (SocialController)

```
GET    /api/v1/friends                         # 好友列表（已授权 + 在玩游戏的好友）
GET    /api/v1/friends/:uid/restaurant         # 查看好友餐厅
POST   /api/v1/friends/:uid/visit              # 拜访好友餐厅
POST   /api/v1/friends/:uid/like               # 给好友点赞
POST   /api/v1/friends/gift-energy             # 赠送能量给好友
GET    /api/v1/friends/energy-gifts            # 收到的能量赠礼
```

#### 4.2.7 排行榜模块 (LeaderboardController)

```
GET    /api/v1/leaderboard/weekly?page=1&size=20     # 周榜（好评度排名）
GET    /api/v1/leaderboard/total?page=1&size=20      # 总榜（餐厅等级排名）
GET    /api/v1/leaderboard/me/rank?type=weekly       # 我的排名
```

```json
// GET /api/v1/leaderboard/weekly?page=1&size=20
// Response 200
{
  "code": 0,
  "data": {
    "list": [
      {
        "rank": 1,
        "uid": "user_10005",
        "nickName": "厨神阿芳",
        "avatarUrl": "https://xxx",
        "restaurantName": "阿芳大酒楼",
        "restaurantLevel": 4,
        "rating": 4.8
      }
      // ...
    ],
    "myRank": {
      "rank": 42,
      "rating": 3.5
    },
    "total": 1280
  }
}
```

#### 4.2.8 广告验证模块 (AdController)

```
POST   /api/v1/ad/watch                       # 记录广告观看（用于统计 + 发奖校验）
POST   /api/v1/ad/callback/ylh                # 优量汇回调（服务端对服务端验证）
```

**POST /api/v1/ad/watch**

```json
// Request
{
  "scene": "energy",                 // energy | speedup | double_gold | extend_time
  "adPlatform": "ylh",              // ylh | csj
  "adToken": "xxx",                 // 广告平台返回的验证 token
  "timestamp": 1717152000000
}

// Response 200
{
  "code": 0,
  "data": {
    "reward": {
      "type": "energy",
      "amount": 30,
      "dailyCount": 3,               // 当日已看次数
      "dailyLimit": 10               // 当日上限
    }
  }
}
```

### 4.3 统一响应格式

```java
// common/Result.java
public class Result<T> {
    private int code;          // 0=成功，非0=业务错误码
    private String message;
    private T data;

    public static <T> Result<T> ok(T data) {
        return new Result<>(0, "ok", data);
    }
    public static <T> Result<T> fail(int code, String message) {
        return new Result<>(code, message, null);
    }
}
```

**错误码规范：**

| 范围 | 含义 |
|------|------|
| 0 | 成功 |
| 10000-10999 | 用户/认证错误 |
| 11000-11999 | 棋盘/合成错误 |
| 12000-12999 | 订单错误 |
| 13000-13999 | 餐厅升级错误 |
| 14000-14999 | 社交错误 |
| 20000-20999 | 反作弊拦截 |
| 30000-30999 | 服务端内部错误 |

### 4.4 Controller/Service/Repository 分层示例

```java
// controller/BoardController.java
@RestController
@RequestMapping("/api/v1/board")
public class BoardController {

    @Autowired
    private BoardService boardService;

    @GetMapping
    public Result<BoardDTO> getBoard(@RequestAttribute("uid") String uid) {
        return Result.ok(boardService.getBoard(uid));
    }

    @PostMapping("/sync")
    public Result<SyncResultDTO> syncBoard(
            @RequestAttribute("uid") String uid,
            @Valid @RequestBody SyncRequestDTO request) {
        return Result.ok(boardService.syncBoard(uid, request));
    }
}

// service/BoardService.java
@Service
public class BoardService {

    @Autowired
    private BoardRepository boardRepository;
    @Autowired
    private EnergyService energyService;

    @Transactional
    public SyncResultDTO syncBoard(String uid, SyncRequestDTO request) {
        // 1. 乐观锁版本校验
        BoardState current = boardRepository.findByUid(uid);
        if (current.getVersion() != request.getVersion()) {
            throw new GameException(10001, "版本冲突");
        }

        // 2. 逐个校验操作合法性
        for (SyncOp op : request.getOperations()) {
            validateOp(uid, op);
        }

        // 3. 校验资源（金币/能量）与服务端是否一致
        // 如果客户端数值异常，以服务端为准
        boardRepository.updateBoard(uid, request.getOperations(),
            request.getVersion() + request.getOperations().size());

        return SyncResultDTO.builder()
            .accepted(true)
            .newVersion(current.getVersion() + request.getOperations().size())
            .build();
    }

    private void validateOp(String uid, SyncOp op) {
        switch (op.getOp()) {
            case "merge":
                // 校验两个物品是否相同类型 + 相同等级
                // 校验合成结果是否在合成树中存在
                // 校验能量是否足够
                break;
            case "sell":
                // 校验物品等级对应的售价
                // 累加金币后检查是否异常增长
                break;
        }
    }
}
```

---

## 5. 数据库设计

### 5.1 ER 图

```
┌──────────────┐       ┌────────────────┐       ┌───────────────┐
│    user      │       │  board_state   │       │  merge_log    │
├──────────────┤       ├────────────────┤       ├───────────────┤
│ id (PK)      │──1:1──│ uid (FK)       │       │ id (PK)       │
│ openid       │       │ cells (JSON)   │       │ uid (FK)      │
│ unionid      │       │ rows           │       │ from_item_type│
│ nick_name    │       │ cols           │       │ from_level    │
│ avatar_url   │       │ version        │──1:N──│ to_item_type  │
│ gold         │       │ updated_at     │       │ to_level      │
│ energy       │       └────────────────┘       │ result_type   │
│ energy_ts    │                                 │ result_level  │
│ rating       │       ┌────────────────┐       │ created_at    │
│ rest_level   │       │  order_log     │       └───────────────┘
│ created_at   │       ├────────────────┤
│ updated_at   │──1:N──│ id (PK)        │       ┌───────────────┐
└──────────────┘       │ uid (FK)       │       │ social_visit  │
       │               │ recipe_id      │       ├───────────────┤
       │               │ gold_earned    │       │ id (PK)       │
       │               │ rating_change  │       │ visitor_uid   │
       │               │ served_at      │       │ host_uid      │
       │               └────────────────┘       │ visited_at    │
       │                                        └───────────────┘
       │               ┌────────────────┐
       │               │  restaurant    │       ┌───────────────┐
       │               ├────────────────┤       │ ad_watch_log  │
       └───1:1─────────│ uid (FK)       │       ├───────────────┤
                       │ level          │       │ id (PK)       │
                       │ name           │       │ uid (FK)      │
                       │ unlocked_at    │       │ scene         │
                       │ upgraded_at    │       │ platform      │
                       └────────────────┘       │ rewarded      │
                                                │ watched_at    │
                                                └───────────────┘
```

### 5.2 建表 SQL

```sql
-- =====================================================
-- V1__init.sql — 合合小厨神 V1.0 数据库初始化
-- =====================================================

-- 用户表
CREATE TABLE `user` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
  `uid`             VARCHAR(32)   NOT NULL                 COMMENT '业务 UID（user_ 前缀 + 雪花ID）',
  `openid`          VARCHAR(64)   NOT NULL                 COMMENT '微信 openid',
  `unionid`         VARCHAR(64)   DEFAULT NULL             COMMENT '微信 unionid（多端打通预留）',
  `nick_name`       VARCHAR(64)   DEFAULT '小厨神'        COMMENT '昵称',
  `avatar_url`      VARCHAR(512)  DEFAULT NULL             COMMENT '头像 URL',
  `gold`            INT           NOT NULL DEFAULT 100     COMMENT '金币',
  `energy`          INT           NOT NULL DEFAULT 100     COMMENT '当前能量',
  `energy_ts`       BIGINT        NOT NULL DEFAULT 0       COMMENT '上次能量恢复时间戳（毫秒）',
  `rating`          DECIMAL(3,1)  NOT NULL DEFAULT 3.0    COMMENT '好评度 (1.0-5.0)',
  `restaurant_level` TINYINT      NOT NULL DEFAULT 1       COMMENT '餐厅等级 (1-5)',
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_uid` (`uid`),
  UNIQUE KEY `uk_openid` (`openid`),
  KEY `idx_rating` (`rating`),
  KEY `idx_restaurant_level` (`restaurant_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户表';

-- 棋盘状态表
CREATE TABLE `board_state` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(32)   NOT NULL                 COMMENT '用户 UID',
  `cells`           JSON          NOT NULL                 COMMENT '棋盘格子数据 [{t:"tomato",l:0,i:1},null,...]',
  `rows`            TINYINT       NOT NULL DEFAULT 6       COMMENT '棋盘行数',
  `cols`            TINYINT       NOT NULL DEFAULT 5       COMMENT '棋盘列数',
  `version`         INT           NOT NULL DEFAULT 0       COMMENT '乐观锁版本号',
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_uid` (`uid`),
  KEY `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='棋盘状态表';

-- 合成日志表（反作弊审计 + 数据分析）
CREATE TABLE `merge_log` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(32)   NOT NULL,
  `from_item_type`  VARCHAR(32)   NOT NULL,
  `from_level`      TINYINT       NOT NULL,
  `to_item_type`    VARCHAR(32)   NOT NULL,
  `to_level`        TINYINT       NOT NULL,
  `result_type`     VARCHAR(32)   NOT NULL,
  `result_level`    TINYINT       NOT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uid` (`uid`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='合成日志表';

-- 订单日志表
CREATE TABLE `order_log` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(32)   NOT NULL,
  `recipe_id`       VARCHAR(32)   NOT NULL                 COMMENT '菜品 ID',
  `gold_earned`     INT           NOT NULL DEFAULT 0       COMMENT '获得金币',
  `rating_change`   DECIMAL(3,1)  NOT NULL DEFAULT 0       COMMENT '好评度变化',
  `served_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uid_served_at` (`uid`, `served_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='订单日志表';

-- 餐厅表
CREATE TABLE `restaurant` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(32)   NOT NULL,
  `level`           TINYINT       NOT NULL DEFAULT 1       COMMENT '餐厅等级 (1-5)',
  `name`            VARCHAR(64)   DEFAULT '街边小摊'       COMMENT '餐厅名称',
  `unlocked_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `upgraded_at`     DATETIME      DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_uid` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='餐厅表';

-- 社交拜访表
CREATE TABLE `social_visit` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `visitor_uid`     VARCHAR(32)   NOT NULL                 COMMENT '拜访者 UID',
  `host_uid`        VARCHAR(32)   NOT NULL                 COMMENT '被拜访者 UID',
  `liked`           TINYINT(1)    NOT NULL DEFAULT 0       COMMENT '是否已点赞',
  `visited_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_host` (`host_uid`),
  KEY `idx_visitor_date` (`visitor_uid`, `visited_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='社交拜访表';

-- 广告观看日志表
CREATE TABLE `ad_watch_log` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(32)   NOT NULL,
  `scene`           VARCHAR(32)   NOT NULL                 COMMENT '场景: energy/speedup/double_gold/extend_time',
  `platform`        VARCHAR(16)   NOT NULL                 COMMENT '平台: ylh/csj',
  `rewarded`        TINYINT(1)    NOT NULL DEFAULT 0       COMMENT '是否已发放奖励',
  `watched_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uid_scene_date` (`uid`, `scene`, `watched_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='广告观看日志表';
```

### 5.3 索引设计及理由

| 表 | 索引 | 类型 | 理由 |
|-----|------|------|------|
| `user` | `uk_uid` | UNIQUE | 业务 UID 是最频繁的查询条件（每次请求都查），必须唯一索引 |
| `user` | `uk_openid` | UNIQUE | 微信登录时需要根据 openid 查用户，唯一约束防重复注册 |
| `user` | `idx_rating` | NORMAL | 排行榜按好评度排序用 |
| `user` | `idx_restaurant_level` | NORMAL | 排行榜按餐厅等级排序用 |
| `board_state` | `uk_uid` | UNIQUE | 一个用户只有一个棋盘，uid 是唯一查询键 |
| `merge_log` | `idx_uid` | NORMAL | 反作弊审计时按用户查询合成历史 |
| `merge_log` | `idx_created_at` | NORMAL | 数据分析按时间段聚合 |
| `order_log` | `idx_uid_served_at` | 联合索引 | 按用户 + 时间查历史订单 |
| `social_visit` | `idx_host` | NORMAL | 查"谁拜访过我" |
| `social_visit` | `idx_visitor_date` | 联合索引 | 查"我今天拜访了谁"（每日上限校验） |
| `ad_watch_log` | `idx_uid_scene_date` | 联合索引 | 查"用户今天在某场景看了几次广告"（每日上限校验） |

**索引原则：**
- V1.0 单表数据量 < 100 万行，不需要考虑索引覆盖、分区表
- 联合索引遵循最左前缀原则，`(uid, scene, watched_at)` 可同时覆盖 `WHERE uid=?` 和 `WHERE uid=? AND scene=? AND watched_at > ?`

---

## 6. 缓存设计

### 6.1 Redis 数据结构选型

| 数据 | Redis 类型 | Key 格式 | 过期时间 | 说明 |
|------|-----------|---------|---------|------|
| JWT Token | String | `token:{uid}` | 7 天 | 存储 token，用于鉴权 + 踢人 |
| 用户会话 | Hash | `session:{uid}` | 30 分钟无操作过期 | 在线状态、最后心跳时间 |
| 能量数据 | Hash | `energy:{uid}` | 永久（与 DB 同步） | `{energy: 75, ts: 1717152000}` 防客户端时间篡改 |
| 每日广告次数 | String | `ad:count:{uid}:{scene}:{date}` | 次日 0 点 | INCR 原子计数，校验每日上限 |
| 排行榜-周榜 | Sorted Set | `lb:weekly:{week_key}` | 每周一重置 | score=好评度，member=uid |
| 排行榜-总榜 | Sorted Set | `lb:total` | 永久 | score=(level*1000+rating)，member=uid |
| 配置版本号 | String | `config:version:{type}` | 永久 | 菜谱配置版本号，前端对比决定是否更新 |
| 今日拜访计数 | String | `visit:count:{uid}:{date}` | 次日 0 点 | INCR 原子计数，校验每日拜访上限 |
| 好友赠礼计数 | String | `gift:count:{uid}:{date}` | 次日 0 点 | 每日赠送/接收上限 |

### 6.2 缓存策略

```
┌─────────────────────────────────────────────────────────────────┐
│                      多层缓存架构                                 │
│                                                                 │
│  客户端                    服务端                                 │
│  ┌──────────┐    HTTP     ┌─────────────┐    ┌──────────┐      │
│  │ 本地缓存  │ ─────────▶ │ Caffeine L1 │───▶│ Redis L2 │      │
│  │ (Storage) │            │ (配置表)     │    │ (热点数据)│      │
│  │           │            │ TTL: 5min   │    │          │      │
│  └──────────┘            └─────────────┘    └────┬─────┘      │
│                                                   │             │
│                                                   ▼             │
│                                              ┌──────────┐      │
│                                              │ MySQL    │      │
│                                              └──────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

**缓存更新策略：**

| 策略 | 适用场景 | 实现 |
|------|---------|------|
| **Cache Aside**（旁路缓存） | 用户数据、棋盘状态 | 读：cache miss → 查 DB → 写缓存；写：更新 DB → 删除缓存 |
| **Write Through** | 能量数据 | 每次能量变更同时写 Redis + DB（异步写 DB，同步写 Redis） |
| **Refresh Ahead** | 排行榜 | 定时任务（每 5 分钟）刷新 Sorted Set，前端拉取时直接返回 |
| **本地缓存** | 菜谱配置表 | 启动时从服务端拉取版本号，有变更才更新 JSON |

**能量缓存详细设计：**

```java
// service/EnergyService.java
@Service
public class EnergyService {

    // Redis Key: energy:{uid}  →  Hash { energy, ts }
    // 能量恢复公式: currentEnergy = min(100, storedEnergy + floor((now - ts) / 180000))

    public int getEnergy(String uid) {
        String key = "energy:" + uid;
        Map<Object, Object> data = redisTemplate.opsForHash().entries(key);

        int storedEnergy = Integer.parseInt((String) data.get("energy"));
        long timestamp = Long.parseLong((String) data.get("ts"));
        long now = System.currentTimeMillis();

        // 服务端时间计算恢复量（忽略客户端时间）
        int recovered = (int) ((now - timestamp) / 180_000);  // 3min = 180000ms
        int actualEnergy = Math.min(100, storedEnergy + recovered);

        // 如果恢复了能量，更新 Redis 中的基准值
        if (recovered > 0) {
            redisTemplate.opsForHash().put(key, "energy", String.valueOf(actualEnergy));
            redisTemplate.opsForHash().put(key, "ts", String.valueOf(now));
        }

        return actualEnergy;
    }

    @Transactional
    public int consumeEnergy(String uid, int amount) {
        int current = getEnergy(uid);
        if (current < amount) {
            throw new GameException(20001, "能量不足");
        }
        String key = "energy:" + uid;
        redisTemplate.opsForHash().put(key, "energy", String.valueOf(current - amount));
        redisTemplate.opsForHash().put(key, "ts", String.valueOf(System.currentTimeMillis()));
        // 异步写 DB
        userRepository.updateEnergy(uid, current - amount, System.currentTimeMillis());
        return current - amount;
    }
}
```

### 6.3 排行榜实现

```java
// service/LeaderboardService.java
@Service
public class LeaderboardService {

    private static final String WEEKLY_KEY_PREFIX = "lb:weekly:";
    private static final String TOTAL_KEY = "lb:total";

    // 更新用户排行分数
    public void updateScore(String uid, double rating, int restaurantLevel) {
        // 周榜
        String weekKey = WEEKLY_KEY_PREFIX + getCurrentWeekKey();
        redisTemplate.opsForZSet().add(weekKey, uid, rating);

        // 总榜（level 加权）
        double totalScore = restaurantLevel * 1000 + rating;
        redisTemplate.opsForZSet().add(TOTAL_KEY, uid, totalScore);
    }

    // 查询排行榜
    public LeaderboardDTO getWeeklyRanking(int page, int size, String myUid) {
        String weekKey = WEEKLY_KEY_PREFIX + getCurrentWeekKey();
        long start = (long) (page - 1) * size;
        long end = start + size - 1;

        // ZREVRANGE 获取排名（降序）
        Set<ZSetOperations.TypedTuple<String>> topUsers =
            redisTemplate.opsForZSet().reverseRangeWithScores(weekKey, start, end);

        // 我的排名
        Long myRank = redisTemplate.opsForZSet().reverseRank(weekKey, myUid);

        // 批量查用户信息（从 Caffeine 或 DB）
        List<String> uids = topUsers.stream()
            .map(ZSetOperations.TypedTuple::getValue).toList();
        Map<String, UserBrief> userMap = userService.getBriefMap(uids);

        return buildLeaderboardDTO(topUsers, userMap, myRank);
    }

    // 每周一凌晨重置周榜
    @Scheduled(cron = "0 0 0 * * MON")
    public void resetWeeklyLeaderboard() {
        String lastWeekKey = WEEKLY_KEY_PREFIX + getLastWeekKey();
        redisTemplate.delete(lastWeekKey);
    }

    private String getCurrentWeekKey() {
        // 返回如 "2026-W22"
        return YearWeek.now().toString();
    }
}
```

**排行榜性能分析：**

- Redis Sorted Set 对 10 万成员的 ZREVRANGE 操作 < 5ms
- V1.0 预期用户量 < 1 万，性能绰绰有余
- 成员数超 100 万时考虑分段（如按等级分段排行榜）

---

## 7. 安全设计

### 7.1 防作弊方案

```
┌────────────────────────────────────────────────────────────────┐
│                       防作弊架构                                │
│                                                                │
│   客户端                         服务端                          │
│   ┌──────────┐                  ┌──────────────────┐           │
│   │ 本地操作  │ ─── 上报 ─────▶ │  操作校验引擎     │           │
│   │ (乐观UI)  │                  │  ┌──────────────┐ │           │
│   └──────────┘                  │  │ 合成合法性     │ │           │
│                                 │  │ 能量充足性     │ │           │
│                                 │  │ 金币一致性     │ │           │
│                                 │  │ 时间合理性     │ │           │
│                                 │  └──────────────┘ │           │
│                                 └────────┬─────────┘           │
│                                          │                     │
│                                          ▼                     │
│                                 ┌──────────────────┐           │
│                                 │  异常检测         │           │
│                                 │  · 异常高频合成   │           │
│                                 │  · 金币增量异常   │           │
│                                 │  · 能量恢复异常   │           │
│                                 └──────────────────┘           │
└────────────────────────────────────────────────────────────────┘
```

#### 核心校验规则

```java
// security/AntiCheatAspect.java
@Aspect
@Component
public class AntiCheatAspect {

    @Around("@annotation(CheatProtected)")
    public Object validate(ProceedingJoinPoint pjp) throws Throwable {
        Object[] args = pjp.getArgs();
        String uid = RequestContext.getUid();
        SyncRequestDTO request = (SyncRequestDTO) args[0];

        // 规则 1：时间合理性校验
        // 操作时间戳不能早于上次同步时间，不能晚于当前服务端时间 + 5s（容错）
        long lastOpTime = getLastOpTime(uid);
        for (var op : request.getOperations()) {
            if (op.getTimestamp() < lastOpTime) {
                throw new CheatException("时间倒流");           // 篡改时间戳
            }
            if (op.getTimestamp() > System.currentTimeMillis() + 5000) {
                throw new CheatException("时间戳超前");          // 篡改时间戳
            }
        }

        // 规则 2：频率校验
        // 1 分钟内合成次数 > 120 次（平均 0.5s 一次）→ 可能是脚本
        long mergeCountInMinute = mergeLogRepository.countByUidSince(
            uid, LocalDateTime.now().minusMinutes(1));
        if (mergeCountInMinute > 120) {
            throw new CheatException("合成频率异常");
        }

        // 规则 3：金币增量校验
        // 对比客户端上报的金币增量与服务端计算的增量
        int serverGold = userRepository.getGold(uid);
        int clientGold = request.getCurrentGold();
        int expectedGold = calculateExpectedGold(request.getOperations());
        if (Math.abs(clientGold - (serverGold + expectedGold)) > 10) {
            // 允许 10 金币误差（并发操作），超出视为异常
            request.setOverrideGold(serverGold + expectedGold);
        }

        return pjp.proceed();
    }
}
```

#### 能量防篡改核心逻辑

```java
// 能量计算以服务端时间为准，完全无视客户端时间
public int calculateEnergy(String uid) {
    long serverNow = System.currentTimeMillis();
    long lastRecoveryTs = redisTemplate.opsForHash()
        .get("energy:" + uid, "ts");  // 最后能量变更时间戳（服务端记录）
    int storedEnergy = redisTemplate.opsForHash()
        .get("energy:" + uid, "energy");

    long elapsed = serverNow - lastRecoveryTs;
    int recovered = (int) (elapsed / (3 * 60 * 1000));  // 3 分钟 1 点
    return Math.min(100, storedEnergy + recovered);
}
```

### 7.2 广告回调验证

优量汇支持服务端回调（S2S）验证广告观看：

```java
// security/AdCallbackVerifier.java
@RestController
@RequestMapping("/api/v1/ad/callback")
public class AdCallbackVerifier {

    // 优量汇服务端回调
    @PostMapping("/ylh")
    public String ylhCallback(@RequestBody YlhCallbackDTO dto) {
        // 1. 验证签名（优量汇使用 MD5 签名）
        String sign = DigestUtil.md5Hex(
            dto.getAppId() + dto.getTransId() + SECRET_KEY);
        if (!sign.equals(dto.getSign())) {
            return "{\"ret\": 1, \"msg\": \"sign error\"}";
        }

        // 2. 防重复发放（transId 唯一）
        if (adWatchLogRepository.existsByTransId(dto.getTransId())) {
            return "{\"ret\": 0, \"msg\": \"ok\"}";
        }

        // 3. 发放奖励
        adService.grantReward(dto.getUid(), dto.getScene());

        // 4. 记录日志
        adWatchLogRepository.save(new AdWatchLog(dto));

        return "{\"ret\": 0, \"msg\": \"ok\"}";
    }

    // 客户端上报（辅助校验，不可完全信任）
    @PostMapping("/watch")
    public Result<?> clientReport(
            @RequestAttribute("uid") String uid,
            @Valid @RequestBody AdWatchDTO dto) {
        // 校验每日上限
        int count = adService.getDailyWatchCount(uid, dto.getScene());
        if (count >= getSceneLimit(dto.getScene())) {
            return Result.fail(20002, "已达每日上限");
        }
        // 计数 + 发奖
        adService.incrementAndGrant(uid, dto.getScene());
        return Result.ok(new AdRewardDTO(dto.getScene(), count + 1));
    }
}
```

### 7.3 接口鉴权

```java
// security/WeChatAuthFilter.java
// 基于 JWT 的接口鉴权
@Component
public class WeChatAuthFilter extends OncePerRequestFilter {

    private static final Set<String> WHITE_LIST = Set.of(
        "/api/v1/auth/login",
        "/api/v1/ad/callback/ylh",  // 优量汇回调不需要用户 token
        "/api/v1/share"              // 分享落地页不需要登录
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response, FilterChain chain) {
        String path = request.getRequestURI();

        // 白名单放行
        if (WHITE_LIST.stream().anyMatch(path::startsWith)) {
            chain.doFilter(request, response);
            return;
        }

        // Token 校验
        String token = request.getHeader("Authorization");
        if (token == null || !token.startsWith("Bearer ")) {
            response.setStatus(401);
            return;
        }

        try {
            Claims claims = JwtUtil.parseToken(token.substring(7));
            request.setAttribute("uid", claims.getSubject());
            chain.doFilter(request, response);
        } catch (JwtException e) {
            response.setStatus(401);
        }
    }
}
```

**JWT 设计：**

```java
// 生成
String token = Jwts.builder()
    .setSubject(uid)
    .setIssuedAt(new Date())
    .setExpiration(new Date(System.currentTimeMillis() + 7 * 24 * 3600 * 1000)) // 7天
    .signWith(SignatureAlgorithm.HS256, SECRET_KEY)
    .compact();

// Payload:
// {
//   "sub": "user_10001",
//   "iat": 1717152000,
//   "exp": 1717756800
// }
```

---

## 8. 部署方案

### 8.1 Docker 容器化

```dockerfile
# Dockerfile
FROM openjdk:17-slim

WORKDIR /app
COPY target/chef-game-1.0.0.jar app.jar
COPY src/main/resources/application.yml application.yml

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "-Xms256m", "-Xmx512m", "app.jar", "--spring.config.location=application.yml"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=prod
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: chef_game
      MYSQL_USER: chef
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  mysql_data:
  redis_data:
```

### 8.2 Nginx 配置

```nginx
# nginx.conf
upstream chef_game_backend {
    server 127.0.0.1:8080;
    # V1.1+ 横向扩展时添加:
    # server 127.0.0.1:8081;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.chefgame.cn;

    ssl_certificate     /etc/ssl/chefgame.crt;
    ssl_certificate_key /etc/ssl/chefgame.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # 安全头
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;

    # 微信小程序要求：请求超时 60s
    proxy_read_timeout 60s;
    proxy_connect_timeout 10s;

    location /api/ {
        proxy_pass http://chef_game_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 限流（单 IP 每秒 50 请求）
        limit_req zone=api_limit burst=50 nodelay;
    }

    # 静态资源（如有 CDN 可替代）
    location /static/ {
        root /var/www/chefgame;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}

# 限流区域定义
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name api.chefgame.cn;
    return 301 https://$host$request_uri;
}
```

### 8.3 微信小程序配置要点

**request 合法域名：**
```
https://api.chefgame.cn
```

**分包策略（应对 2MB 主包限制）：**

```json
{
  "pages": [
    "pages/loading/loading",
    "pages/home/home"
  ],
  "subPackages": [
    {
      "root": "pages-sub/",
      "pages": [
        "cookbook/cookbook",
        "upgrade/upgrade",
        "leaderboard/leaderboard",
        "friends/friends",
        "friend-restaurant/friend-restaurant",
        "inventory/inventory",
        "settings/settings",
        "share/share"
      ]
    }
  ],
  "preloadRule": {
    "pages/home/home": {
      "network": "all",
      "packages": ["pages-sub/"]
    }
  }
}
```

- 主包（~1.5MB）：加载页 + 主界面 + 游戏引擎 + 核心素材
- 分包（~3MB）：其他 8 个页面 + 非核心素材
- 独立分包：分享结果页（不依赖主包，秒开）

---

## 附录 A：技术指标

| 指标 | 目标值 | 备注 |
|------|--------|------|
| 主包大小 | < 1.5MB | 微信限制 2MB |
| 总包大小 | < 5MB | 微信限制 20MB（含分包） |
| 首屏加载 | < 3s | 加载页 → 主界面 |
| Canvas 帧率 | 50-60fps | 主流机型 |
| API 响应时间 | < 100ms (P95) | 棋盘同步接口 |
| 内存峰值（客户端） | < 200MB | 低端安卓机 |
| QPS 支持 | 500 | V1.0 万级 DAU 绰绰有余 |
| 数据库连接池 | 10 | HikariCP 默认 |

## 附录 B：开发排期建议

| 阶段 | 内容 | 工时 |
|------|------|------|
| Day 1-2 | 后端：DB + 用户/棋盘/合成 API | 2 天 |
| Day 3-4 | 前端：Canvas 引擎 + 主界面 | 2 天 |
| Day 5 | 前端：接单/升级/图鉴页面 + 后端联调 | 1 天 |
| Day 6 | 广告接入 + 排行榜 + 社交 | 1 天 |
| Day 7 | 新手引导 + 异常处理 + 弱网测试 | 1 天 |
| Day 8-10 | 内测 + Bug 修复 + 性能调优 | 3 天 |
| **总计** | | **10 天** |
