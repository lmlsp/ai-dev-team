package com.chefgame.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单日志实体
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "order_log")
public class OrderLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户UID */
    @Column(nullable = false, length = 32)
    private String uid;

    /** 菜品ID */
    @Column(name = "recipe_id", nullable = false, length = 32)
    private String recipeId;

    /** 获得金币 */
    @Column(name = "gold_earned", nullable = false)
    @Builder.Default
    private Integer goldEarned = 0;

    /** 好评度变化 */
    @Column(name = "rating_change", precision = 3, scale = 1, nullable = false)
    @Builder.Default
    private BigDecimal ratingChange = BigDecimal.ZERO;

    /** 小费金币 */
    @Column(name = "tip_gold", nullable = false)
    @Builder.Default
    private Integer tipGold = 0;

    /** 上菜时间 */
    @Column(name = "served_at", nullable = false)
    private LocalDateTime servedAt;

    @PrePersist
    protected void onCreate() {
        if (this.servedAt == null) {
            this.servedAt = LocalDateTime.now();
        }
    }
}
