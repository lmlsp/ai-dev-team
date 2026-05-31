package com.chefgame.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 棋盘状态实体
 * cells 字段为 MySQL JSON 类型，存储棋盘格子数据
 * 格式: [{"t":"tomato","l":0,"i":1}, null, ...]
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "board_state")
public class BoardState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户UID */
    @Column(nullable = false, length = 32, unique = true)
    private String uid;

    /** 棋盘格子数据（JSON） */
    @Column(columnDefinition = "json", nullable = false)
    private String cells;

    /** 棋盘行数 */
    @Column(nullable = false)
    @Builder.Default
    private Integer rows = 6;

    /** 棋盘列数 */
    @Column(nullable = false)
    @Builder.Default
    private Integer cols = 5;

    /** 乐观锁版本号 */
    @Column(nullable = false)
    @Builder.Default
    private Integer version = 0;

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
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
