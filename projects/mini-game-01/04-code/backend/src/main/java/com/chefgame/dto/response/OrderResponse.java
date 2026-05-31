package com.chefgame.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * 订单相关响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {

    /** 获得金币 */
    private Integer goldEarned;

    /** 好评度变化 */
    private BigDecimal ratingChange;

    /** 小费金币 */
    private Integer tipGold;

    /** 当前总金币 */
    private Integer newGold;

    /** 当前好评度 */
    private BigDecimal newRating;

    /** 订单队列（用于 GET /orders） */
    private List<OrderItem> orders;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItem {
        private String orderId;
        private String customerId;
        private String customerName;
        private String recipeId;
        private String recipeName;
        private Integer timeoutSeconds;
        private Long createdAt;
    }
}
