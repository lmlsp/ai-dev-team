package com.chefgame.service;

import com.chefgame.common.GameException;
import com.chefgame.dto.request.ServeOrderRequest;
import com.chefgame.dto.response.OrderResponse;
import com.chefgame.entity.OrderLog;
import com.chefgame.entity.User;
import com.chefgame.repository.OrderLogRepository;
import com.chefgame.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * 订单服务 — 订单生成、上菜、金币结算
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderLogRepository orderLogRepository;
    private final UserRepository userRepository;
    private final LeaderboardService leaderboardService;

    private static final BigDecimal RATING_INCREMENT = new BigDecimal("0.1");
    private static final BigDecimal RATING_DECREMENT = new BigDecimal("-0.1");
    private static final BigDecimal RATING_MAX = new BigDecimal("5.0");
    private static final BigDecimal RATING_MIN = new BigDecimal("1.0");
    private static final BigDecimal TIP_RATING_THRESHOLD = new BigDecimal("4.0");

    /**
     * 获取当前订单队列
     * V1.0 简化：服务端生成模拟订单
     */
    public OrderResponse getOrders(String uid) {
        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "用户不存在"));

        // 生成模拟订单（实际应由服务端订单生成器管理）
        List<OrderResponse.OrderItem> orders = new ArrayList<>();
        orders.add(OrderResponse.OrderItem.builder()
                .orderId("ord_1")
                .customerId("c_001")
                .customerName("美食家老王")
                .recipeId("tomato_egg_dish")
                .recipeName("番茄炒蛋")
                .timeoutSeconds(60)
                .createdAt(System.currentTimeMillis())
                .build());
        orders.add(OrderResponse.OrderItem.builder()
                .orderId("ord_2")
                .customerId("c_002")
                .customerName("吃货小美")
                .recipeId("scrambled_egg")
                .recipeName("炒蛋")
                .timeoutSeconds(90)
                .createdAt(System.currentTimeMillis())
                .build());
        orders.add(OrderResponse.OrderItem.builder()
                .orderId("ord_3")
                .customerId("c_003")
                .customerName("厨神阿强")
                .recipeId("mapo_tofu")
                .recipeName("麻婆豆腐")
                .timeoutSeconds(120)
                .createdAt(System.currentTimeMillis())
                .build());

        return OrderResponse.builder()
                .orders(orders)
                .build();
    }

    /**
     * 上菜操作（关键操作）
     */
    @Transactional
    public OrderResponse serveOrder(String uid, String orderId, ServeOrderRequest request) {
        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "用户不存在"));

        // 1. 校验菜品合法性
        validateServedItem(request);

        // 2. 计算金币收益（基于菜品等级）
        int goldEarned = calculateGold(request.getServedItem());
        BigDecimal ratingChange = RATING_INCREMENT;

        // 3. 计算小费（好评度 > 4.0 时概率触发）
        int tipGold = 0;
        if (user.getRating().compareTo(TIP_RATING_THRESHOLD) > 0) {
            // 40% 概率获得小费
            if (Math.random() < 0.4) {
                tipGold = goldEarned / 2; // 小费为菜品价格的一半
            }
        }

        int totalGold = goldEarned + tipGold;
        int newGold = user.getGold() + totalGold;

        // 4. 更新好评度（上限 5.0，下限 1.0）
        BigDecimal newRating = user.getRating().add(ratingChange);
        if (newRating.compareTo(RATING_MAX) > 0) newRating = RATING_MAX;
        if (newRating.compareTo(RATING_MIN) < 0) newRating = RATING_MIN;

        user.setGold(newGold);
        user.setRating(newRating);
        userRepository.save(user);

        // 5. 记录订单日志
        OrderLog logEntry = OrderLog.builder()
                .uid(uid)
                .recipeId(request.getServedItem().getT())
                .goldEarned(totalGold)
                .ratingChange(ratingChange)
                .tipGold(tipGold)
                .build();
        orderLogRepository.save(logEntry);

        // 6. 更新排行榜
        leaderboardService.updateScore(uid, newRating.doubleValue(), user.getRestaurantLevel());

        log.info("上菜成功: uid={}, orderId={}, recipe={}, gold={}, tip={}, rating={}",
                uid, orderId, request.getServedItem().getT(), goldEarned, tipGold, newRating);

        return OrderResponse.builder()
                .goldEarned(goldEarned)
                .ratingChange(ratingChange)
                .tipGold(tipGold)
                .newGold(newGold)
                .newRating(newRating)
                .build();
    }

    /**
     * 历史订单查询
     */
    public OrderResponse getOrderHistory(String uid, int page, int size) {
        Page<OrderLog> logs = orderLogRepository.findByUidOrderByServedAtDesc(
                uid, PageRequest.of(page - 1, size));

        // 返回分页历史（简化版本）
        return OrderResponse.builder().build();
    }

    /**
     * 处理顾客超时（差评）
     */
    @Transactional
    public void handleTimeout(String uid) {
        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "用户不存在"));

        BigDecimal newRating = user.getRating().add(RATING_DECREMENT);
        if (newRating.compareTo(RATING_MIN) < 0) newRating = RATING_MIN;

        user.setRating(newRating);
        userRepository.save(user);

        log.info("订单超时: uid={}, rating={}", uid, newRating);
    }

    private void validateServedItem(ServeOrderRequest request) {
        if (request.getServedItem() == null || request.getServedItem().getT() == null) {
            throw new GameException(12001, "上菜失败：菜品信息不完整");
        }
        if (request.getBoardIdx() == null || request.getBoardIdx() < 0) {
            throw new GameException(12001, "上菜失败：棋盘位置不合法");
        }

        // 校验菜品是否为可上菜的终端产品
        // V1.0 简化：只要菜品类型包含 dish 关键词即可上菜
        String itemType = request.getServedItem().getT();
        if (!itemType.contains("dish") && !itemType.contains("dish_")) {
            log.warn("非成品菜品尝试上菜: {}", itemType);
            throw new GameException(12002, "该物品还不能上菜哦，继续合成试试吧");
        }

        // 时间戳校验
        if (request.getTimestamp() != null) {
            long now = System.currentTimeMillis();
            if (request.getTimestamp() > now + 10000) {
                throw new GameException(20002, "操作时间戳异常");
            }
        }
    }

    /**
     * 计算菜品金币收益
     */
    private int calculateGold(ServeOrderRequest.CellItem item) {
        // 基础价格 + 等级加成
        int basePrice = 10;
        int level = item.getL() != null ? item.getL() : 0;
        return basePrice + level * 5;
    }
}
