package com.chefgame.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户实体
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "`user`")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 业务UID（user_前缀+雪花ID） */
    @Column(nullable = false, length = 32, unique = true)
    private String uid;

    /** 微信openid */
    @Column(nullable = false, length = 64, unique = true)
    private String openid;

    /** 微信unionid */
    @Column(length = 64)
    private String unionid;

    /** 昵称 */
    @Column(name = "nick_name", length = 64)
    @Builder.Default
    private String nickName = "小厨神";

    /** 头像URL */
    @Column(name = "avatar_url", length = 512)
    private String avatarUrl;

    /** 金币 */
    @Column(nullable = false)
    @Builder.Default
    private Integer gold = 100;

    /** 当前能量 */
    @Column(nullable = false)
    @Builder.Default
    private Integer energy = 100;

    /** 上次能量变更时间戳（毫秒） */
    @Column(name = "energy_ts", nullable = false)
    @Builder.Default
    private Long energyTs = 0L;

    /** 好评度 */
    @Column(precision = 3, scale = 1, nullable = false)
    @Builder.Default
    private BigDecimal rating = new BigDecimal("3.0");

    /** 餐厅等级 */
    @Column(name = "restaurant_level", nullable = false)
    @Builder.Default
    private Integer restaurantLevel = 1;

    /** 是否新用户 */
    @Column(name = "is_new_user", nullable = false)
    @Builder.Default
    private Boolean isNewUser = true;

    /** 创建时间 */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** 更新时间 */
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        if (this.energyTs == 0) {
            this.energyTs = System.currentTimeMillis();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
