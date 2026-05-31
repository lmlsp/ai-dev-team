package com.chefgame.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 餐厅实体
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "restaurant")
public class Restaurant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户UID */
    @Column(nullable = false, length = 32, unique = true)
    private String uid;

    /** 餐厅等级 (1-5) */
    @Column(nullable = false)
    @Builder.Default
    private Integer level = 1;

    /** 餐厅名称 */
    @Column(length = 64)
    @Builder.Default
    private String name = "街边小摊";

    /** 解锁时间 */
    @Column(name = "unlocked_at", nullable = false)
    private LocalDateTime unlockedAt;

    /** 升级时间 */
    @Column(name = "upgraded_at")
    private LocalDateTime upgradedAt;

    @PrePersist
    protected void onCreate() {
        if (this.unlockedAt == null) {
            this.unlockedAt = LocalDateTime.now();
        }
    }
}
