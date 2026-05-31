package com.chefgame.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 合成日志实体 — 用于反作弊审计和数据分析
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "merge_log")
public class MergeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户UID */
    @Column(nullable = false, length = 32)
    private String uid;

    /** 合成前第一个物品类型 */
    @Column(name = "from_item_type", nullable = false, length = 32)
    private String fromItemType;

    /** 合成前第一个物品等级 */
    @Column(name = "from_level", nullable = false)
    private Integer fromLevel;

    /** 合成前第二个物品类型 */
    @Column(name = "to_item_type", nullable = false, length = 32)
    private String toItemType;

    /** 合成前第二个物品等级 */
    @Column(name = "to_level", nullable = false)
    private Integer toLevel;

    /** 合成结果物品类型 */
    @Column(name = "result_type", nullable = false, length = 32)
    private String resultType;

    /** 合成结果物品等级 */
    @Column(name = "result_level", nullable = false)
    private Integer resultLevel;

    /** 创建时间 */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
