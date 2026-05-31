package com.chefgame.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 广告观看日志实体
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "ad_watch_log")
public class AdWatchLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 用户UID */
    @Column(nullable = false, length = 32)
    private String uid;

    /** 场景: energy / speedup / double_gold / extend_time */
    @Column(nullable = false, length = 32)
    private String scene;

    /** 平台: ylh / csj */
    @Column(nullable = false, length = 16)
    private String platform;

    /** 广告平台交易ID（去重用） */
    @Column(name = "trans_id", length = 128)
    private String transId;

    /** 是否已发放奖励 */
    @Column(nullable = false)
    @Builder.Default
    private Boolean rewarded = false;

    /** 观看时间 */
    @Column(name = "watched_at", nullable = false)
    private LocalDateTime watchedAt;

    @PrePersist
    protected void onCreate() {
        if (this.watchedAt == null) {
            this.watchedAt = LocalDateTime.now();
        }
    }
}
