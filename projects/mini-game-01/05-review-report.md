# Code Review Report

> 项目：合合小厨神 | 审查日期：2026-05-31 | 审查人：Code Reviewer Agent
> 范围：后端 59 个 Java 文件 + 前端 33 个 JS 文件 + 配置/模板约 65 个文件

## 风险等级总览

| 🔴 高危 | 🟡 中危 | 🟢 低危 |
|---------|---------|---------|
| 7 | 7 | 13 |

---

## 🔴 高危问题（必须修复）

### [P0-01] JWT 密钥硬编码在配置文件中

- **位置**: `backend/src/main/resources/application.yml:16`
- **描述**: JWT 签名密钥 `chefgame2026secretkey!!@#$%^&*()minigame` 硬编码在配置文件中。如果代码泄露到 Git 仓库或 CI 日志，攻击者可以伪造任意用户的 JWT token，完全绕过鉴权系统。
- **修复建议**:
```yaml
# application.yml — 改为环境变量，不留默认值
jwt:
  secret: ${JWT_SECRET}          # 必须通过环境变量注入，无默认值
  expiration: 604800000
```
同时在所有环境的部署配置（K8s Secret / docker-compose env_file）中注入真实的随机密钥（建议 256-bit base64）。

- **是否必须修复**: 是

---

### [P0-02] 优量汇回调验签密钥为占位符

- **位置**: `backend/src/main/java/com/chefgame/service/AdService.java:52`
- **描述**: `YLH_SECRET_KEY` 写死为 `"your_ylh_secret_key"`。攻击者可以伪造优量汇 S2S 回调请求，无限刷取广告奖励（能量/食材加速等），严重破坏游戏经济。
- **修复建议**:
```java
// 从配置/环境变量读取，不留硬编码
@Value("${ad.ylh.secret-key}")
private String ylhSecretKey;
```
```yaml
# application.yml
ad:
  ylh:
    secret-key: ${YLH_SECRET_KEY}  # 从优量汇后台获取真实密钥
```

- **是否必须修复**: 是

---

### [P0-03] `storage.get()` 方法不存在 — 所有鉴权 API 调用崩溃

- **位置**: 
  - `frontend/services/api.js:53` — `storage.get('token')`
  - `frontend/services/auth.js:16` — `storage.get('token')`  
  - `frontend/services/auth.js:143` — `storage.get('token')`
- **描述**: `utils/storage.js` 导出的对象只有 `load` 方法，没有 `get` 方法。调用 `storage.get('token')` 会抛 `TypeError: storage.get is not a function`。这导致：
  1. 所有需要鉴权的 API 请求无法携带 Authorization header（token 获取失败）
  2. `auth.login()` 的 token 缓存检查失败，每次都重新登录
  3. `auth.isLoggedIn()` 永远抛异常
- **修复建议**:
```javascript
// utils/storage.js — 添加 get 别名方法
const storage = {
  // ...existing methods...
  
  /** get 是 load 的别名（业界习惯命名） */
  get(key, defaultValue) {
    return this.load(key, defaultValue);
  },
  
  /** set 是 save 的别名 */
  set(key, value) {
    this.save(key, value);
  }
};
```
或者将所有 `storage.get(` 改为 `storage.load(` ，所有 `storage.save(` 也可以统一加 `storage.set(` 别名。

- **是否必须修复**: 是

---

### [P0-04] 好友赠能量绕过 EnergyService — Redis 不同步

- **位置**: `backend/src/main/java/com/chefgame/service/SocialService.java:226-230`
- **描述**: `giftEnergy` 方法直接通过 `UserRepository` 更新好友的 `energy` 和 `energyTs` 字段，没有调用 `EnergyService.addEnergy()`。这导致：
  1. Redis 中的能量缓存不会更新（`syncToRedis` 没有被调用）
  2. 后续 `EnergyService.getEnergy()` 从 Redis 读取到的是过期数据
  3. 好友实际收到的能量与实际显示不一致
- **修复建议**:
```java
// SocialService.java:226-230 — 改为通过 EnergyService
// 删除以下代码:
//   friend.setEnergy(newEnergy);
//   friend.setEnergyTs(System.currentTimeMillis());
//   userRepository.save(friend);
// 改为:
@Autowired
private EnergyService energyService;
// ...
energyService.addEnergy(friendUid, 10);
```

- **是否必须修复**: 是

---

### [P0-05] 加载页缺少超时处理 — 用户可能卡死在加载页

- **位置**: `frontend/pages/loading/loading.js:22-26`
- **描述**: 文件定义了 `LOADING_TIMEOUT = 10000` 和 `LOADING_HARD_TIMEOUT = 30000`，但 `_startLoading()` 中从未创建实际的 `setTimeout` 定时器来触发 `_handleLoadError`。如果登录或配置加载永远挂起（如网络异常），用户将永远卡在加载页，看不到重试按钮。
- **修复建议**:
```javascript
// loading.js — _startLoading 方法开头添加
async _startLoading() {
  // 超时保护
  this._timeoutTimer = setTimeout(() => {
    if (!this._finished) this._handleLoadError(new Error('timeout'));
  }, LOADING_TIMEOUT);
  
  this._hardTimeoutTimer = setTimeout(() => {
    if (!this._finished) {
      this.setData({ showOffline: true });
      this._handleLoadError(new Error('hard_timeout'));
    }
  }, LOADING_HARD_TIMEOUT);
  
  // ...existing code...
}

// _enterGame 方法中添加
_enterGame() {
  this._finished = true;  // 标记完成，阻止超时回调
  // ...existing code...
}
```

- **是否必须修复**: 是

---

### [P0-06] 广告奖励去重存在竞态条件

- **位置**: `backend/src/main/java/com/chefgame/service/AdService.java:70-76`
- **描述**: 先通过 `countByTransId` 检查 `transId` 是否存在，再插入记录。在高并发或重复请求场景下，两个请求可能同时通过检查（count=0），然后都执行奖励发放。应使用数据库唯一约束或 Redis SETNX 保证原子性。
- **修复建议**:
```java
// 方案1：数据库加唯一约束
// V1__init.sql 中的 ad_watch_log 表 trans_id 列已有 idx_trans_id，改为 UNIQUE KEY
// ALTER TABLE ad_watch_log ADD UNIQUE KEY uk_trans_id (trans_id);

// 方案2：使用 Redis SETNX 原子操作
Boolean firstTime = stringRedisTemplate.opsForValue()
    .setIfAbsent("ad:dedup:" + request.getTransId(), "1", 7, TimeUnit.DAYS);
if (Boolean.FALSE.equals(firstTime)) {
    throw new GameException(20002, "该广告已领取过奖励了");
}
```

- **是否必须修复**: 是

---

### [P0-07] 登录接口无频率限制 — 可被暴力调用

- **位置**: `backend/src/main/java/com/chefgame/security/WeChatAuthInterceptor.java:28` + `backend/src/main/java/com/chefgame/config/WebMvcConfig.java:22`
- **描述**: `/api/v1/auth/login` 在白名单中，不受鉴权保护，也没有任何频率限制。攻击者可以通过高频调用消耗微信 code2session 配额（每日有限额），或在 code 有效期内批量创建账号。
- **修复建议**:
```java
// 在 WebMvcConfig 或独立 Filter 中添加限流
// 方案：使用 Guava RateLimiter 或 Redis 令牌桶
// 对 /api/v1/auth/login 限制为单IP每10秒最多3次

// 简单实现示例（Nginx 层面已在架构文档设计了 limit_req，确保部署时启用）：
// nginx.conf:
// location /api/v1/auth/login {
//     limit_req zone=login_limit burst=3 nodelay;
//     proxy_pass http://chef_game_backend;
// }
```

- **是否必须修复**: 是

---

## 🟡 中危问题（强烈建议修复）

### [P1-01] `getFriends()` 全表扫描 — 数据量大时性能灾难

- **位置**: `backend/src/main/java/com/chefgame/service/SocialService.java:56`
- **描述**: `userRepository.findAll()` 将整个 `user` 表加载到内存，然后在 Java 中过滤和限制 20 条。即使 V1.0 用户量不大，这也是一个隐患：如果表有 10 万行，每次请求都会传输全部数据。
- **修复建议**:
```java
// 改为数据库层面分页
Page<User> page = userRepository.findAll(PageRequest.of(0, 20));
// 或者排除自己 + 随机排序
@Query(value = "SELECT * FROM user WHERE uid != :uid ORDER BY RAND() LIMIT :limit", nativeQuery = true)
List<User> findRandomUsers(@Param("uid") String uid, @Param("limit") int limit);
```

- **是否必须修复**: 是（数据量增长后会出现严重性能问题）

---

### [P1-02] `merge_log` 表缺少联合索引 `(uid, created_at)`

- **位置**: `backend/src/main/resources/db/migration/V1__init.sql:58-59` + `backend/src/main/java/com/chefgame/repository/MergeLogRepository.java:21`
- **描述**: MergeLogRepository 的 `countByUidSince` 查询使用了 `WHERE uid = ? AND created_at >= ?`，每笔合成操作都会执行一次。但表只有 `idx_uid` 和 `idx_created_at` 两个独立索引，MySQL 只能选择其中一个，效率远低于联合索引。
- **修复建议**:
```sql
-- 在 V1__init.sql 中添加：
-- 删除原有的独立索引（合并到联合索引中）
-- KEY `idx_uid` (`uid`),        -- 删除此行
-- KEY `idx_created_at` (`created_at`),  -- 删除此行
-- 替换为：
KEY `idx_uid_created` (`uid`, `created_at`),
```

- **是否必须修复**: 是（每笔合成都触发此查询）

---

### [P1-03] Canvas 渲染循环持续全速运行 — 浪费电量

- **位置**: `frontend/pages/home/home.js:355-398`
- **描述**: `_render(delta)` 每帧都在执行 `clearRect`、7 层绘制、订单计时更新等操作，即使在棋盘完全静止（无拖拽、无动画）时也以 60fps 运行。对于一款大部分时间处于静止状态的合成游戏，这严重浪费 CPU 和电量。
- **修复建议**:
```javascript
// 添加脏标记（dirty flag）机制
_render(delta) {
  // 如果没有拖拽、动画、计时器变化，跳过绘制
  const hasDrag = !!(this.dragHandler && this.dragHandler.dragState);
  const hasAnimations = !!(this.particles && this.particles.isActive()) ||
    (this._spawnItems && this._spawnItems.length > 0) ||
    (this._mergeBounceCells && this._mergeBounceCells.length > 0) ||
    (this._goldFloats && this._goldFloats.length > 0);
  const needsOrderUpdate = this.orderManager && this.orderManager.hasActiveOrders();
  
  if (!hasDrag && !hasAnimations && !needsOrderUpdate && !this._dirty) {
    // 完全静止，跳过本帧绘制
    if (!this._idleFrameCount) this._idleFrameCount = 0;
    this._idleFrameCount++;
    if (this._idleFrameCount < 60) return; // 至少每 60 帧（1秒）刷新一次订单倒计时
    this._idleFrameCount = 0;
  }
  this._dirty = false;
  // ...existing render code...
}
```

- **是否必须修复**: 建议修复（影响用户体验和电量）

---

### [P1-04] Redis ZSet 排行榜无限增长

- **位置**: `backend/src/main/java/com/chefgame/service/LeaderboardService.java:44-48`
- **描述**: `ZADD` 操作没有成员上限。如果游戏有 100 万用户，每个 ZSet 存储 100 万个成员（每个 ~100 bytes），周榜 + 总榜共同占用约 200MB Redis 内存。架构文档中提到了"成员数超 100 万时考虑分段"，但没有实现。
- **修复建议**:
```java
// 每次 ZADD 后检查成员数，超过阈值时移除最低分
private static final long MAX_LEADERBOARD_SIZE = 100_000;

public void updateScore(String uid, double rating, int restaurantLevel) {
    String weekKey = WEEKLY_KEY_PREFIX + getCurrentWeekKey();
    stringRedisTemplate.opsForZSet().add(weekKey, uid, rating);
    // 裁剪：仅保留前 100K 名
    Long size = stringRedisTemplate.opsForZSet().zCard(weekKey);
    if (size != null && size > MAX_LEADERBOARD_SIZE) {
        stringRedisTemplate.opsForZSet().removeRange(weekKey, 0, size - MAX_LEADERBOARD_SIZE - 1);
    }
    // 同样处理总榜...
}
```

- **是否必须修复**: 建议修复（V1.0 用户量小时可暂缓，但应尽早加入）

---

### [P1-05] 多个 store 监听器导致连续 setData — 应批量合并

- **位置**: `frontend/pages/home/home.js:207-224`
- **描述**: 一次上菜操作会同步触发 gold、energy、rating 三次独立的 `setData` 调用。小程序 `setData` 每次都会触发 JS → Native 的跨线程通信，连续调用效率低。应在下一帧使用 `wx.nextTick` 合并。
- **修复建议**:
```javascript
// gameStore 中添加批量通知机制
_bindStoreListeners() {
  let pendingUpdates = {};
  let tickScheduled = false;
  
  const scheduleBatch = () => {
    if (tickScheduled) return;
    tickScheduled = true;
    // 使用 wx.nextTick 或 Promise.resolve() 批量应用
    Promise.resolve().then(() => {
      if (Object.keys(pendingUpdates).length > 0) {
        this.setData(pendingUpdates);
        pendingUpdates = {};
      }
      tickScheduled = false;
    });
  };
  
  this._unsubscribers.push(store.on('gold', (val) => {
    pendingUpdates.gold = val;
    scheduleBatch();
  }));
  // ...energy, rating 同理
}
```

- **是否必须修复**: 建议修复

---

### [P1-06] `countByTransId` 缺少 NULL 保护 — 可能导致漏过重复上报

- **位置**: `backend/src/main/java/com/chefgame/repository/AdWatchLogRepository.java:30` + `backend/src/main/java/com/chefgame/service/AdService.java:71`
- **描述**: JPQL `SELECT COUNT(a) FROM AdWatchLog a WHERE a.transId = :transId` — 当 `transId` 为 NULL 时，SQL `WHERE trans_id = NULL` 在 MySQL 中永远返回 0 行（SQL NULL 比较语义）。如果客户端不传 `transId`，每次检查 countByTransId 都返回 0，去重机制被绕过。
- **修复建议**:
```java
// AdService.java — 加强前置校验
if (request.getTransId() == null || request.getTransId().isBlank()) {
    throw new GameException(20002, "广告验证Token缺失");
}
```

- **是否必须修复**: 是

---

### [P1-07] `ylhCallback` 返回 `Map` 而非 `Result` — 不统一

- **位置**: `backend/src/main/java/com/chefgame/controller/AdController.java:44`
- **描述**: 所有其他 Controller 方法返回 `Result<T>` 统一响应格式，但 `ylhCallback` 直接返回 `Map<String, Object>`（`{"ret": 0, "msg": "ok"}`）。这是为了符合优量汇 S2S 回调的协议格式，但应确保 `@RestControllerAdvice` 不会拦截并包装此响应。当前 `GlobalExceptionHandler.handleException` 会将异常转为 `Result.fail(30000, ...)` 格式，可能与优量汇期望格式不一致。
- **修复建议**:
```java
// 为 S2S 回调创建专用异常处理
@ExceptionHandler(GameException.class)
public ResponseEntity<Map<String, Object>> handleYlhException(GameException e) {
    return ResponseEntity.ok(Map.of("ret", e.getCode(), "msg", e.getMessage()));
}
// 并在 Controller 中使用 @ExceptionHandler 或单独的处理逻辑
```

- **是否必须修复**: 建议修复

---

## 🟢 低危问题（建议修复）

### [P2-01] 合成频率校验逻辑重复

- **位置**: 
  - `backend/src/main/java/com/chefgame/security/AntiCheatAspect.java:40-46`
  - `backend/src/main/java/com/chefgame/service/MergeService.java:103-108`
- **描述**: 两处都做了"1分钟内合成不超过120次"的频率校验。重复代码增加维护成本，且如果一处修改阈值而另一处未同步，会产生不一致行为。
- **修复建议**: 只在 AntiCheatAspect 中保留频率校验，MergeService 中移除重复逻辑。或者抽取为独立的 `CheatGuardService.checkMergeRate(uid)` 方法。

---

### [P2-02] 时间戳校验逻辑重复

- **位置**: 
  - `AntiCheatAspect.java` 的 3 个切面方法
  - `BoardService.java:148-151`
  - `MergeService.java:95-100`
  - `OrderService.java:188-193`
- **描述**: 时间戳超前校验 `timestamp > now + 10000` 在 6 处独立重复。如果容错阈值需要从 10s 改为 5s，需要改 6 个地方。
- **修复建议**: 抽取为 `CheatGuardService.validateTimestamp(Long timestamp)` 静态方法。

---

### [P2-03] `getOrders()` 返回硬编码模拟数据 — 订单系统未实现

- **位置**: `backend/src/main/java/com/chefgame/service/OrderService.java:49-78`
- **描述**: 订单接口硬编码返回了 3 个固定的订单（"美食家老王"、"吃货小美"、"厨神阿强"），无论用户解锁了哪些菜品、当前是什么等级。真实的订单生成逻辑完全没有实现。PRD 规定"订单池仅从已解锁菜品中抽取"，此功能未完成。
- **修复建议**: 实现真正的订单生成逻辑：根据用户已解锁的菜品和好评度，随机生成 3 个不同菜品订单，超时时间随机 60-120 秒。

---

### [P2-04] `getOrderHistory()` 返回空响应

- **位置**: `backend/src/main/java/com/chefgame/service/OrderService.java:147-153`
- **描述**: 虽然做了分页查询 `orderLogRepository.findByUidOrderByServedAtDesc()`，但结果没有映射到 `OrderResponse` 中返回，`return OrderResponse.builder().build()` 返回了一个空的 OrderResponse。
- **修复建议**: 将 Page<OrderLog> 映射为 OrderResponse 的 history 列表。

---

### [P2-05] `expandBoardCells()` 丢失旧棋盘数据

- **位置**: `backend/src/main/java/com/chefgame/service/RestaurantService.java:231-251`
- **描述**: 餐厅升级到 Lv.3 时调用 `expandBoardCells` 扩展棋盘为 6×7。但方法中所有格子都写入了 `"null"`，旧棋盘上的食材全部丢失。注释说"保留旧格子"但代码并未实现。
- **修复建议**: 解析旧 cells JSON，按新尺寸重建数组，保留旧位置的元素。

---

### [P2-06] WXML 模板大量硬编码中文 — 未使用 i18n

- **位置**: 以下 WXML 中的所有可见文字未通过 `i18n.t()` 获取：
  - `pages/home/home.wxml` — "卖出"、"退出卖出"、"图鉴"、"加速"、"升级"、"设置"
  - `pages-sub/cookbook/cookbook.wxml` — "菜谱图鉴"、"收集进度"、"全部"、"家常菜"、"川菜"、"粤菜"、"创意融合"、"隐藏菜谱"、"价值"、"解锁等级"、"关闭"
  - `pages-sub/leaderboard/leaderboard.wxml` — "排行榜"、"周榜"、"总榜"、"我的排名"、"排行榜加载失败"、"重试"、"加载中..."
  - `pages-sub/friends/friends.wxml` — "好友列表"、"拜访"、"还没有好友在玩"、"邀请好友来玩"、"加载中..."
  - `pages/loading/loading.wxml` — "重试"、"跳过加载（离线模式）"
- **描述**: 虽然 `locales/zh-CN.json` 有丰富的翻译条目（286 行），但 WXML 模板几乎全部绕过 i18n 直接写了中文。PRD 明确要求"所有用户可见文案使用 `i18n.t(key)` 调用"。
- **修复建议**: 
```xml
<!-- 改前 -->
<text class="nav-title">菜谱图鉴</text>
<!-- 改后 — 在 JS 中通过 i18n.t('cookbook.title') 获取，或使用 wxs 模块 -->
<text class="nav-title">{{i18n.cookbookTitle}}</text>
```

---

### [P2-07] home.js 存在硬编码中文字符串

- **位置**: `frontend/pages/home/home.js` 多处：
  - 行 1079: `'只有完成的菜品才能上菜哦'`
  - 行 1084: `'这不是顾客想要的菜品'`
  - 行 1130: `` '+' + goldEarned + ' 金币！' ``
  - 行 1153: `` '卖出 +' + sellPrice + ' 金币' ``
  - 行 1279: `` '生成 ' + count + ' 个食材！' ``
  - 行 1314: `'+30 能量！'`
- **修复建议**: 改用 `i18n.t('home.only_servable_serve')` 等已有的翻译 key。

---

### [P2-08] 前端 ad.js 每日计数仅在内存中 — 跨午夜不重置

- **位置**: `frontend/services/ad.js:32-37`
- **描述**: `_dailyCounts` 对象在内存中维护，只有在应用重启时才清零。如果用户从 23:55 玩游戏到 00:05，广告次数不会重置。服务端使用 `LocalDate.now()` 校验，客户端和服务端计数可能不一致。
- **修复建议**: 添加日期检查：
```javascript
getDailyCount(scene) {
  const today = new Date().toDateString();
  if (this._countDate !== today) {
    this._dailyCounts = { energy: 0, speedup: 0, double_gold: 0, extend_time: 0 };
    this._countDate = today;
  }
  return this._dailyCounts[scene] || 0;
}
```

---

### [P2-09] 雪花 ID 的 worker-id/datacenter-id 硬编码为 1

- **位置**: 
  - `backend/src/main/resources/application.yml:49-51` — `worker-id: 1`, `datacenter-id: 1`
  - `backend/src/main/java/com/chefgame/service/UserService.java:110` — `IdUtil.getSnowflake(1, 1)`
- **描述**: 如果后端部署多个实例（横向扩展），所有实例使用相同的 worker-id=1 / datacenter-id=1，会产生重复的雪花 ID，导致 uid 冲突。
- **修复建议**: 
```yaml
snowflake:
  worker-id: ${SNOWFLAKE_WORKER_ID:1}
  datacenter-id: ${SNOWFLAKE_DC_ID:1}
```
并在 docker-compose 中为每个实例分配不同的 worker-id。

---

### [P2-10] `updateUserInfo` 缺少输入校验 — 潜在 XSS 风险

- **位置**: `backend/src/main/java/com/chefgame/controller/UserController.java:52-61` + `backend/src/main/java/com/chefgame/service/UserService.java:190-204`
- **描述**: 更新昵称接口直接接受 `Map<String, String>` 无 `@Valid`，无长度限制，无特殊字符过滤。虽然微信小程序 `{{}}` 模板自动 HTML 转义保护了前端，但昵称可能在多种场景展示（Canvas 绘制、分享卡片等），应该在服务端做最小过滤。
- **修复建议**:
```java
@PutMapping("/users/me")
public Result<UserInfoResponse> updateUserInfo(
        @RequestAttribute("uid") String uid,
        @Valid @RequestBody UpdateUserRequest body) { // 使用专用 DTO
    // ...
}

// UpdateUserRequest.java
@Data
public class UpdateUserRequest {
    @Size(max = 20, message = "昵称最多20个字符")
    @Pattern(regexp = "^[\\u4e00-\\u9fa5a-zA-Z0-9_\\-\\s]+$", message = "昵称包含非法字符")
    private String nickName;
    
    @Size(max = 512)
    @Pattern(regexp = "^https?://.*", message = "头像URL格式不正确")
    private String avatarUrl;
}
```

---

### [P2-11] Redis 能量 key 无过期时间 — 内存泄漏风险

- **位置**: `backend/src/main/java/com/chefgame/service/EnergyService.java:130-134`
- **描述**: `syncToRedis` 方法写入 `energy:{uid}` Hash 时没有设置 TTL。如果用户卸载游戏或长期不活跃，能量 key 永久占用 Redis 内存。
- **修复建议**:
```java
private void syncToRedis(String uid, int energy, long ts) {
    String key = ENERGY_KEY_PREFIX + uid;
    stringRedisTemplate.opsForHash().put(key, "energy", String.valueOf(energy));
    stringRedisTemplate.opsForHash().put(key, "ts", String.valueOf(ts));
    stringRedisTemplate.expire(key, 30, TimeUnit.DAYS); // 30 天不活跃自动清理
}
```

---

### [P2-12] 服务端订单模块未与 PRD 对齐 — 缺少好评度影响逻辑

- **位置**: `backend/src/main/java/com/chefgame/service/OrderService.java`
- **描述**: PRD 规定好评度影响：顾客数量、高级菜品订单概率、小费概率。当前实现中：
  - 订单生成是硬编码的（P2-03）
  - 小费固定 40% 概率（不受好评度影响）
  - 顾客数量固定为 3 个
- **修复建议**: 实现 PRD 规则：
```java
// 小费概率 = rating / 10（4.0星 → 40%, 5.0星 → 50%）
double tipChance = user.getRating().doubleValue() / 10.0;
if (Math.random() < tipChance) { ... }
```

---

### [P2-13] pom.xml 中 H2 数据库在生产依赖中

- **位置**: `backend/pom.xml` (H2 dependency, scope=runtime)
- **描述**: H2 内存数据库的 scope 是 `runtime` 而非 `test`。在生产环境启动时，如果 MySQL 连接失败，Spring 可能会回退到 H2，导致数据写入内存数据库而丢失。且 H2 包大小约 2MB，无意义增加 JAR 体积。
- **修复建议**:
```xml
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>test</scope>  <!-- 改为 test scope -->
</dependency>
```

---

## 正面评价（做得好的地方）

1. **服务端能量防作弊设计优秀**: `EnergyService` 以服务端时间为准计算能量恢复量，完全无视客户端时间戳，有效防止系统时间篡改作弊。Redis + DB 双写策略合理。

2. **乐观锁版本号机制**: BoardState 使用 version 字段做乐观锁，客户端同步时需携带版本号，有效防止并发冲突和数据覆盖。

3. **广告反作弊体系完善**: `AdWatchLog` 表存储 `transId` 用于去重、`S2S 回调验签`、每日上限校验（Redis 计数）、场景频率限制，构成了完整的广告反作弊链。

4. **全局异常处理规范**: `GlobalExceptionHandler` 统一处理业务异常、参数校验异常和未知异常，所有异常都返回统一的 `Result` 格式，避免了异常信息泄露。

5. **i18n 框架设计良好**: `i18n.js` 支持嵌套 key、参数插值、多语言注册，`locales/zh-CN.json` 包含 286 行全面覆盖的翻译——只是 WXML 模板还没全面使用。

6. **Canvas 渲染引擎结构清晰**: 4 层渲染分离（背景→网格→物品→特效），粒子特效独立模块，拖拽手势处理分离，代码结构良好。物品生成动画（气泡冒出 300ms ease-out-back）和合成回弹动画实现细致。

7. **JWT 鉴权白名单 + Interceptor 模式**: `WeChatAuthInterceptor` 将鉴权逻辑从业务代码中解耦，白名单清晰（login / ad S2S callback / share），`WebMvcConfig` 注册模式和排除路径一致。

8. **数据同步策略合理**: 前端 `sync.js` 实现了三层同步——关键操作即时同步（merge/serve）、常规操作 30s 批量同步、网络恢复后全量同步，并支持版本冲突以服务端为准。与架构文档设计完全一致。

9. **POM 依赖管理规范**: 使用 `<properties>` 集中管理第三方 SDK 版本号（weixin-java-miniapp、hutool），Spring Boot 版本通过 parent POM 统一管理。

10. **数据库索引设计到位**: 除 `merge_log` 缺少联合索引外（已列入 P1），其余表的索引设计符合业务查询模式（唯一索引、覆盖联合索引、按时间排序索引），与架构文档的设计说明一致。

11. **前端并发请求控制**: `api.js` 实现了 maxConcurrent=5 的并发槽位控制 + 自动重试（3 次，间隔 1s/3s/5s），超时和重试策略符合微信小程序最佳实践。

12. **Storage 封装健壮**: 异常降级（JSON 解析失败自动清除损坏数据）、存储空间不足时自动清理旧数据、按前缀隔离、缓存大小统计，覆盖了边缘场景。

---

## 总结统计

| 维度 | 问题数 | 已修复 | 待修复 |
|------|--------|--------|--------|
| 🔴 P0 安全/功能阻断 | 7 | 0 | 7 |
| 🟡 P1 性能/可靠性 | 7 | 0 | 7 |
| 🟢 P2 工程规范 | 13 | 0 | 13 |
| **合计** | **27** | **0** | **27** |

**最关键的三项**（必须立即修复）：P0-01 (JWT密钥硬编码)、P0-03 (storage.get 方法缺失导致鉴权崩溃)、P0-04 (赠能量绕过 EnergyService)。
